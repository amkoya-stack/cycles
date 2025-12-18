import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { LedgerService } from '../ledger/ledger.service';
import { NotificationService } from '../wallet/notification.service';
import { RotationService } from './rotation.service';
import {
  SchedulePayoutDto,
  ExecutePayoutDto,
  CancelPayoutDto,
  GetPayoutHistoryDto,
} from './dto/payout.dto';
import { v4 as uuidv4 } from 'uuid';

interface Payout {
  id: string;
  chamaId: string;
  cycleId: string;
  recipientMemberId: string;
  recipientUserId: string;
  amount: number;
  status: string;
  scheduledAt: Date;
  rotationPositionId?: string;
}

@Injectable()
export class PayoutService {
  constructor(
    private readonly db: DatabaseService,
    private readonly ledgerService: LedgerService,
    private readonly notificationService: NotificationService,
    private readonly rotationService: RotationService,
  ) {}

  /**
   * Schedule a payout for a cycle recipient
   */
  async schedulePayout(dto: SchedulePayoutDto) {
    return this.db.transaction(async (client) => {
      // Validate cycle exists and is closed
      const cycleResult = await client.query(
        `SELECT cc.*, c.name as chama_name
         FROM contribution_cycles cc
         JOIN chamas c ON cc.chama_id = c.id
         WHERE cc.id = $1`,
        [dto.cycleId],
      );

      if (cycleResult.rowCount === 0) {
        throw new NotFoundException('Contribution cycle not found');
      }

      const cycle = cycleResult.rows[0];

      if (cycle.status !== 'closed') {
        throw new BadRequestException(
          'Can only schedule payout for closed cycles',
        );
      }

      // Validate recipient is a member
      const memberResult = await client.query(
        `SELECT cm.*, u.full_name, u.phone, u.email
         FROM chama_members cm
         JOIN users u ON cm.user_id = u.id
         WHERE cm.id = $1 AND cm.chama_id = $2 AND cm.status = 'active'`,
        [dto.recipientId, cycle.chama_id],
      );

      if (memberResult.rowCount === 0) {
        throw new NotFoundException('Recipient member not found or not active');
      }

      const recipient = memberResult.rows[0];

      // Check if payout already exists for this cycle and recipient
      const existingResult = await client.query(
        `SELECT id FROM payouts 
         WHERE cycle_id = $1 AND recipient_member_id = $2 
         AND status != 'cancelled'`,
        [dto.cycleId, dto.recipientId],
      );

      if (existingResult.rowCount > 0) {
        throw new BadRequestException(
          'Payout already exists for this recipient and cycle',
        );
      }

      // Get rotation position if exists
      const rotationPosResult = await client.query(
        `SELECT rp.id
         FROM rotation_positions rp
         JOIN rotation_orders ro ON rp.rotation_order_id = ro.id
         WHERE ro.chama_id = $1 
         AND rp.member_id = $2 
         AND ro.status = 'active'
         AND rp.status = 'current'`,
        [cycle.chama_id, dto.recipientId],
      );

      const rotationPositionId = rotationPosResult.rows[0]?.id || null;

      // Create payout record
      const payoutResult = await client.query(
        `INSERT INTO payouts (
          chama_id, cycle_id, recipient_member_id, recipient_user_id,
          amount, status, scheduled_at, rotation_position_id,
          notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          cycle.chama_id,
          dto.cycleId,
          dto.recipientId,
          recipient.user_id,
          dto.amount,
          'pending',
          dto.scheduledAt,
          rotationPositionId,
          `Payout for ${cycle.chama_name} - Cycle ${cycle.cycle_number}`,
        ],
      );

      const payout = payoutResult.rows[0];

      // Link contributions to this payout
      await this.linkContributionsToPayout(client, payout.id, dto.cycleId);

      return {
        payout,
        recipient: {
          memberId: recipient.id,
          userId: recipient.user_id,
          fullName: recipient.full_name,
          phone: recipient.phone,
          email: recipient.email,
        },
        cycle: {
          id: cycle.id,
          cycleNumber: cycle.cycle_number,
          chamaName: cycle.chama_name,
        },
        message: 'Payout scheduled successfully',
      };
    });
  }

  /**
   * Execute a scheduled payout via ledger
   */
  async executePayout(payoutId: string) {
    return this.db.transactionAsSystem(async (client) => {
      // Get payout details
      const payoutResult = await client.query(
        `SELECT p.*, cm.user_id as recipient_user_id, u.full_name, u.phone, u.email,
                c.name as chama_name, cc.cycle_number
         FROM payouts p
         JOIN chama_members cm ON p.recipient_member_id = cm.id
         JOIN users u ON cm.user_id = u.id
         JOIN chamas c ON p.chama_id = c.id
         JOIN contribution_cycles cc ON p.cycle_id = cc.id
         WHERE p.id = $1`,
        [payoutId],
      );

      if (payoutResult.rowCount === 0) {
        throw new NotFoundException('Payout not found');
      }

      const payout: Payout = payoutResult.rows[0];

      if (payout.status !== 'pending') {
        throw new BadRequestException(
          `Cannot execute payout with status: ${payout.status}`,
        );
      }

      // Update status to processing
      await client.query(
        `UPDATE payouts SET status = 'processing', updated_at = NOW() WHERE id = $1`,
        [payoutId],
      );

      try {
        // Execute ledger transaction
        // processPayout handles account lookup, balance checks, and double-entry
        const externalReference = `PAYOUT-${payoutId}-${Date.now()}`;

        const transaction = await this.ledgerService.processPayout(
          payout.chamaId,
          payout.recipientUserId,
          payout.amount,
          `Payout to ${payoutResult.rows[0].full_name} - Cycle ${payoutResult.rows[0].cycle_number}`,
          externalReference,
        );

        // Update payout record
        await client.query(
          `UPDATE payouts 
           SET status = 'completed', 
               executed_at = NOW(),
               transaction_id = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [transaction.id, payoutId],
        );

        // Advance rotation if position exists
        if (payout.rotationPositionId) {
          const rotationResult = await client.query(
            'SELECT rotation_order_id FROM rotation_positions WHERE id = $1',
            [payout.rotationPositionId],
          );

          if (rotationResult.rowCount > 0) {
            await this.rotationService.advanceRotation(
              rotationResult.rows[0].rotation_order_id,
              payout.rotationPositionId,
            );
          }
        }

        // Send success notification
        await this.sendPayoutSuccessNotification(payoutResult.rows[0]);

        return {
          success: true,
          payout: {
            id: payout.id,
            amount: payout.amount,
            status: 'completed',
            executedAt: new Date(),
          },
          transaction: {
            id: transaction.id,
            reference: externalReference,
          },
          message: 'Payout executed successfully',
        };
      } catch (error) {
        // Update payout status to failed
        await client.query(
          `UPDATE payouts 
           SET status = 'failed', 
               failed_reason = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [error.message, payoutId],
        );

        // Send failure notification
        await this.sendPayoutFailureNotification(
          payoutResult.rows[0],
          error.message,
        );

        throw error;
      }
    });
  }

  /**
   * Calculate payout amount from cycle contributions
   */
  async calculatePayoutAmount(cycleId: string): Promise<number> {
    const result = await this.db.query(
      `SELECT 
        COALESCE(SUM(amount), 0) as total_contributions,
        COALESCE(SUM(fee_amount), 0) as total_fees
       FROM contributions
       WHERE cycle_id = $1 AND status = 'completed'`,
      [cycleId],
    );

    const totalContributions = parseFloat(result.rows[0].total_contributions);
    const totalFees = parseFloat(result.rows[0].total_fees);

    // Payout is contributions minus fees (fees already deducted during contribution)
    return totalContributions;
  }

  /**
   * Link contributions to a payout for audit trail
   */
  private async linkContributionsToPayout(
    client: any,
    payoutId: string,
    cycleId: string,
  ) {
    // Get all completed contributions for the cycle
    const contributionsResult = await client.query(
      `SELECT id, amount FROM contributions 
       WHERE cycle_id = $1 AND status = 'completed'`,
      [cycleId],
    );

    // Create distribution records
    for (const contribution of contributionsResult.rows) {
      await client.query(
        `INSERT INTO payout_distributions (payout_id, contribution_id, amount)
         VALUES ($1, $2, $3)`,
        [payoutId, contribution.id, contribution.amount],
      );
    }
  }

  /**
   * Cancel a payout
   */
  async cancelPayout(payoutId: string, reason?: string) {
    return this.db.transaction(async (client) => {
      const result = await client.query('SELECT * FROM payouts WHERE id = $1', [
        payoutId,
      ]);

      if (result.rowCount === 0) {
        throw new NotFoundException('Payout not found');
      }

      const payout = result.rows[0];

      if (payout.status === 'completed') {
        throw new BadRequestException('Cannot cancel completed payout');
      }

      if (payout.status === 'cancelled') {
        throw new BadRequestException('Payout already cancelled');
      }

      await client.query(
        `UPDATE payouts 
         SET status = 'cancelled', 
             failed_reason = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [reason || 'Cancelled by admin', payoutId],
      );

      return {
        message: 'Payout cancelled successfully',
        payoutId,
      };
    });
  }

  /**
   * Get payout history with filters
   */
  async getPayoutHistory(filters: GetPayoutHistoryDto) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    const whereConditions = ['1=1'];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.chamaId) {
      whereConditions.push(`p.chama_id = $${paramIndex}`);
      params.push(filters.chamaId);
      paramIndex++;
    }

    if (filters.cycleId) {
      whereConditions.push(`p.cycle_id = $${paramIndex}`);
      params.push(filters.cycleId);
      paramIndex++;
    }

    if (filters.recipientId) {
      whereConditions.push(`p.recipient_member_id = $${paramIndex}`);
      params.push(filters.recipientId);
      paramIndex++;
    }

    if (filters.status) {
      whereConditions.push(`p.status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countResult = await this.db.query(
      `SELECT COUNT(*) as total FROM payouts p WHERE ${whereClause}`,
      params,
    );

    const total = parseInt(countResult.rows[0].total);

    // Get payouts
    const result = await this.db.query(
      `SELECT p.*, 
              cm.user_id as recipient_user_id,
              u.full_name as recipient_name,
              u.phone as recipient_phone,
              c.name as chama_name,
              cc.cycle_number,
              (SELECT COUNT(*) FROM payout_distributions WHERE payout_id = p.id) as contribution_count
       FROM payouts p
       JOIN chama_members cm ON p.recipient_member_id = cm.id
       JOIN users u ON cm.user_id = u.id
       JOIN chamas c ON p.chama_id = c.id
       JOIN contribution_cycles cc ON p.cycle_id = cc.id
       WHERE ${whereClause}
       ORDER BY p.scheduled_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset],
    );

    return {
      payouts: result.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get payout details with distributions
   */
  async getPayoutDetails(payoutId: string) {
    const payoutResult = await this.db.query(
      `SELECT p.*, 
              cm.user_id as recipient_user_id,
              u.full_name as recipient_name,
              u.phone as recipient_phone,
              u.email as recipient_email,
              c.name as chama_name,
              cc.cycle_number,
              cc.expected_amount as cycle_expected_amount
       FROM payouts p
       JOIN chama_members cm ON p.recipient_member_id = cm.id
       JOIN users u ON cm.user_id = u.id
       JOIN chamas c ON p.chama_id = c.id
       JOIN contribution_cycles cc ON p.cycle_id = cc.id
       WHERE p.id = $1`,
      [payoutId],
    );

    if (payoutResult.rowCount === 0) {
      throw new NotFoundException('Payout not found');
    }

    const payout = payoutResult.rows[0];

    // Get distributions
    const distributionsResult = await this.db.query(
      `SELECT pd.*, 
              c.amount as contribution_amount,
              u.full_name as contributor_name
       FROM payout_distributions pd
       JOIN contributions c ON pd.contribution_id = c.id
       JOIN users u ON c.user_id = u.id
       WHERE pd.payout_id = $1
       ORDER BY pd.created_at ASC`,
      [payoutId],
    );

    return {
      payout,
      distributions: distributionsResult.rows,
      summary: {
        totalContributions: distributionsResult.rowCount,
        totalAmount: payout.amount,
        status: payout.status,
      },
    };
  }

  /**
   * Get upcoming payouts for a chama
   */
  async getUpcomingPayouts(chamaId: string) {
    const result = await this.db.query(
      `SELECT p.*, 
              u.full_name as recipient_name,
              cc.cycle_number,
              cc.due_date as cycle_due_date
       FROM payouts p
       JOIN chama_members cm ON p.recipient_member_id = cm.id
       JOIN users u ON cm.user_id = u.id
       JOIN contribution_cycles cc ON p.cycle_id = cc.id
       WHERE p.chama_id = $1 
       AND p.status IN ('pending', 'processing')
       AND p.scheduled_at >= NOW()
       ORDER BY p.scheduled_at ASC
       LIMIT 10`,
      [chamaId],
    );

    return result.rows;
  }

  /**
   * Send payout success notification
   */
  private async sendPayoutSuccessNotification(payout: any) {
    const message = `Congratulations! You have received a payout of KES ${payout.amount.toLocaleString()} from ${payout.chama_name}.`;

    // Send SMS
    await this.notificationService.sendSMSReceipt({
      phoneNumber: payout.phone,
      message,
    });

    // Send email
    const emailHtml = `
      <h2>Payout Received</h2>
      <p>Dear ${payout.full_name},</p>
      <p>You have successfully received a payout from <strong>${payout.chama_name}</strong>.</p>
      <h3>Payout Details:</h3>
      <ul>
        <li><strong>Amount:</strong> KES ${payout.amount.toLocaleString()}</li>
        <li><strong>Cycle:</strong> ${payout.cycle_number}</li>
        <li><strong>Date:</strong> ${new Date().toLocaleDateString()}</li>
      </ul>
      <p>The funds have been credited to your wallet and are available for use.</p>
      <p>Thank you for being part of ${payout.chama_name}!</p>
    `;

    await this.notificationService.sendEmail({
      to: payout.email,
      subject: `Payout Received - ${payout.chama_name}`,
      html: emailHtml,
      text: message,
    });
  }

  /**
   * Send payout failure notification
   */
  private async sendPayoutFailureNotification(payout: any, reason: string) {
    const message = `Payout processing failed for ${payout.chama_name}. Reason: ${reason}. Please contact support.`;

    await this.notificationService.sendSMSReceipt({
      phoneNumber: payout.phone,
      message,
    });
  }

  /**
   * Retry a failed payout
   */
  async retryFailedPayout(payoutId: string) {
    const result = await this.db.query('SELECT * FROM payouts WHERE id = $1', [
      payoutId,
    ]);

    if (result.rowCount === 0) {
      throw new NotFoundException('Payout not found');
    }

    const payout = result.rows[0];

    if (payout.status !== 'failed') {
      throw new BadRequestException('Can only retry failed payouts');
    }

    // Reset to pending status
    await this.db.query(
      `UPDATE payouts 
       SET status = 'pending', failed_reason = NULL, updated_at = NOW()
       WHERE id = $1`,
      [payoutId],
    );

    // Execute the payout
    return this.executePayout(payoutId);
  }
}
