import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { InvestmentService } from './investment.service';
import { LedgerService } from '../ledger/ledger.service';
import { NotificationService } from '../wallet/notification.service';
import { mapQueryRow, mapQueryResult } from '../database/mapper.util';

@Injectable()
export class InvestmentAutomationService {
  private readonly logger = new Logger(InvestmentAutomationService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly investmentService: InvestmentService,
    private readonly ledger: LedgerService,
    private readonly notification: NotificationService,
  ) {}

  /**
   * Daily cron job - Process matured investments
   * Runs daily at 8 AM EAT
   */
  @Cron('0 8 * * *', {
    name: 'process-matured-investments',
    timeZone: 'Africa/Nairobi',
  })
  async processMaturedInvestments() {
    this.logger.log('Starting automated maturity processing...');

    try {
      await this.db.setSystemContext();

      // Get all active investments that have reached maturity date
      const maturedResult = await this.db.query(
        `SELECT i.*, 
                p.name as product_name,
                c.name as chama_name,
                c.id as chama_id
         FROM investments i
         JOIN investment_products p ON i.product_id = p.id
         JOIN chamas c ON i.chama_id = c.id
         WHERE i.status = 'active'
           AND i.maturity_date <= CURRENT_DATE
           AND i.actual_maturity_date IS NULL`,
      );

      const maturedInvestments = mapQueryResult(maturedResult.rows);
      this.logger.log(`Found ${maturedInvestments.length} investments to mature`);

      let processedCount = 0;
      let errorCount = 0;

      for (const investment of maturedInvestments) {
        try {
          // Mark investment as matured
          await this.investmentService.markInvestmentMatured(investment.id);

          // Calculate final returns
          const finalReturn = parseFloat(investment.expected_return) || 0;
          const totalReturn = parseFloat(investment.amount) + finalReturn;

          // Update investment with final returns
          await this.db.query(
            `UPDATE investments 
             SET principal_returned = $1,
                 interest_earned = $2,
                 total_return = $3,
                 updated_at = NOW()
             WHERE id = $4`,
            [
              investment.amount,
              finalReturn,
              totalReturn,
              investment.id,
            ],
          );

          // Transfer principal + interest back to chama wallet
          // Note: This assumes the investment account exists and has the funds
          // In a full implementation, you'd transfer from investment account to chama wallet
          try {
            // Get chama account
            const chamaAccountResult = await this.db.query(
              `SELECT a.id 
               FROM accounts a
               JOIN account_types at ON a.account_type_id = at.id
               WHERE a.chama_id = $1 AND at.code = 'CHAMA_WALLET' AND a.status = 'active'
               LIMIT 1`,
              [investment.chama_id],
            );

            if (chamaAccountResult.rows.length > 0) {
              // In a full implementation, you would:
              // 1. Get investment account for this investment
              // 2. Transfer total_return from investment account to chama wallet
              // For now, we'll log it and the transfer can be done manually or via a separate process
              this.logger.log(
                `Investment ${investment.id} matured. Total return: ${totalReturn} should be transferred to chama ${investment.chama_id}`,
              );
            }
          } catch (transferError) {
            this.logger.warn(
              `Failed to transfer funds for investment ${investment.id}: ${transferError.message}`,
            );
          }

          // Send notification to chama members
          await this.sendMaturityNotification(investment);

          processedCount++;
          this.logger.log(
            `Successfully processed matured investment ${investment.id}`,
          );
        } catch (error: any) {
          errorCount++;
          this.logger.error(
            `Failed to process investment ${investment.id}: ${error.message}`,
            error.stack,
          );
        }
      }

      this.logger.log(
        `Maturity processing completed. Processed: ${processedCount}, Errors: ${errorCount}`,
      );
    } catch (error) {
      this.logger.error('Error in maturity processing:', error);
    } finally {
      await this.db.clearContext();
    }
  }

  /**
   * Monthly cron job - Distribute dividends for active investments
   * Runs on the 1st of each month at 9 AM EAT
   */
  @Cron('0 9 1 * *', {
    name: 'distribute-investment-dividends',
    timeZone: 'Africa/Nairobi',
  })
  async distributeDividends() {
    this.logger.log('Starting automated dividend distribution...');

    try {
      await this.db.setSystemContext();

      // Get active investments that pay monthly dividends
      // This includes investments with compounding_frequency = 'monthly'
      const dividendInvestmentsResult = await this.db.query(
        `SELECT i.*, 
                p.name as product_name,
                p.compounding_frequency,
                c.name as chama_name,
                c.id as chama_id
         FROM investments i
         JOIN investment_products p ON i.product_id = p.id
         JOIN chamas c ON i.chama_id = c.id
         WHERE i.status = 'active'
           AND p.compounding_frequency IN ('monthly', 'quarterly', 'annually')
           AND i.maturity_date > CURRENT_DATE`,
      );

      const investments = mapQueryResult(dividendInvestmentsResult.rows);
      this.logger.log(
        `Found ${investments.length} investments eligible for dividend distribution`,
      );

      let distributedCount = 0;
      let errorCount = 0;

      for (const investment of investments) {
        try {
          const shouldDistribute = this.shouldDistributeDividend(
            investment.compounding_frequency,
          );

          if (!shouldDistribute) {
            continue;
          }

          // Calculate dividend amount for the period
          const dividendAmount = this.calculateDividendAmount(
            investment,
            investment.compounding_frequency,
          );

          if (dividendAmount <= 0) {
            continue;
          }

          // Determine period dates
          const periodEnd = new Date();
          const periodStart = this.getPeriodStart(
            investment.compounding_frequency,
            periodEnd,
          );

          // Distribute dividend
          await this.investmentService.distributeDividend({
            investmentId: investment.id,
            amount: dividendAmount,
            paymentDate: new Date(),
            periodStart,
            periodEnd,
            distributeToWallet: true, // Auto-distribute to wallets
            reinvest: false,
          });

          distributedCount++;
          this.logger.log(
            `Distributed dividend of ${dividendAmount} for investment ${investment.id}`,
          );
        } catch (error: any) {
          errorCount++;
          this.logger.error(
            `Failed to distribute dividend for investment ${investment.id}: ${error.message}`,
            error.stack,
          );
        }
      }

      this.logger.log(
        `Dividend distribution completed. Distributed: ${distributedCount}, Errors: ${errorCount}`,
      );
    } catch (error) {
      this.logger.error('Error in dividend distribution:', error);
    } finally {
      await this.db.clearContext();
    }
  }

  /**
   * Daily cron job - Send maturity reminders
   * Runs daily at 10 AM EAT
   */
  @Cron('0 10 * * *', {
    name: 'send-investment-maturity-reminders',
    timeZone: 'Africa/Nairobi',
  })
  async sendMaturityReminders() {
    this.logger.log('Starting investment maturity reminder processing...');

    try {
      await this.db.setSystemContext();

      // Get investments maturing in 7, 3, and 1 days
      const reminderDays = [7, 3, 1];

      for (const days of reminderDays) {
        const investmentsResult = await this.db.query(
          `SELECT i.*, 
                  p.name as product_name,
                  c.name as chama_name,
                  c.id as chama_id
           FROM investments i
           JOIN investment_products p ON i.product_id = p.id
           JOIN chamas c ON i.chama_id = c.id
           WHERE i.status = 'active'
             AND i.maturity_date = CURRENT_DATE + INTERVAL '${days} days'`,
        );

        const investments = mapQueryResult(investmentsResult.rows);

        for (const investment of investments) {
          await this.sendMaturityReminder(investment, days);
        }
      }

      this.logger.log('Maturity reminder processing completed');
    } catch (error) {
      this.logger.error('Error in maturity reminder processing:', error);
    } finally {
      await this.db.clearContext();
    }
  }

  /**
   * Check if dividend should be distributed based on frequency
   */
  private shouldDistributeDividend(frequency: string): boolean {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth();

    switch (frequency) {
      case 'monthly':
        // Distribute on 1st of each month
        return day === 1;
      case 'quarterly':
        // Distribute on 1st of Jan, Apr, Jul, Oct
        return day === 1 && [0, 3, 6, 9].includes(month);
      case 'annually':
        // Distribute on Jan 1st
        return day === 1 && month === 0;
      default:
        return false;
    }
  }

  /**
   * Calculate dividend amount for the period
   */
  private calculateDividendAmount(
    investment: any,
    frequency: string,
  ): number {
    const principal = parseFloat(investment.amount);
    const annualRate = parseFloat(investment.interest_rate) / 100;

    switch (frequency) {
      case 'monthly':
        return principal * (annualRate / 12);
      case 'quarterly':
        return principal * (annualRate / 4);
      case 'annually':
        return principal * annualRate;
      default:
        return 0;
    }
  }

  /**
   * Get period start date based on frequency
   */
  private getPeriodStart(frequency: string, periodEnd: Date): Date {
    const start = new Date(periodEnd);

    switch (frequency) {
      case 'monthly':
        start.setMonth(start.getMonth() - 1);
        break;
      case 'quarterly':
        start.setMonth(start.getMonth() - 3);
        break;
      case 'annually':
        start.setFullYear(start.getFullYear() - 1);
        break;
    }

    return start;
  }

  /**
   * Send maturity notification to chama members
   */
  private async sendMaturityNotification(investment: any): Promise<void> {
    try {
      // Get chama members
      const membersResult = await this.db.query(
        `SELECT u.id, u.email, u.phone, u.full_name
         FROM chama_members cm
         JOIN users u ON cm.user_id = u.id
         WHERE cm.chama_id = $1 AND cm.status = 'active'`,
        [investment.chama_id],
      );

      const members = mapQueryResult(membersResult.rows);

      for (const member of members) {
        if (member.email) {
          await this.notification.sendEmail({
            to: member.email,
            subject: `Investment Matured - ${investment.product_name}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #083232;">Investment Matured</h2>
                <p>Hi ${member.full_name},</p>
                <p>Your chama's investment has matured!</p>
                <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                  <p style="margin: 5px 0;"><strong>Investment Details:</strong></p>
                  <p style="margin: 5px 0;">Product: ${investment.product_name}</p>
                  <p style="margin: 5px 0;">Chama: ${investment.chama_name}</p>
                  <p style="margin: 5px 0;">Principal: KES ${parseFloat(investment.amount).toLocaleString()}</p>
                  <p style="margin: 5px 0;">Interest Earned: KES ${parseFloat(investment.interest_earned || 0).toLocaleString()}</p>
                  <p style="margin: 5px 0;">Total Return: KES ${parseFloat(investment.total_return || investment.amount).toLocaleString()}</p>
                </div>
                <p>Please log in to your account to view the investment details.</p>
                <p>Best regards,<br>Cycle Platform</p>
              </div>
            `,
          });
        }

        // Send push notification
        await this.notification.sendPushNotification(member.id, {
          title: `Investment Matured - ${investment.product_name}`,
          body: `Your chama's investment has matured. Total return: KES ${parseFloat(investment.total_return || investment.amount).toLocaleString()}`,
          data: {
            type: 'investment_matured',
            investmentId: investment.id,
            chamaId: investment.chama_id,
          },
        });
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to send maturity notification: ${error.message}`,
      );
    }
  }

  /**
   * Send maturity reminder
   */
  private async sendMaturityReminder(
    investment: any,
    daysUntil: number,
  ): Promise<void> {
    try {
      const membersResult = await this.db.query(
        `SELECT u.id, u.email, u.full_name
         FROM chama_members cm
         JOIN users u ON cm.user_id = u.id
         WHERE cm.chama_id = $1 AND cm.status = 'active'`,
        [investment.chama_id],
      );

      const members = mapQueryResult(membersResult.rows);

      for (const member of members) {
        if (member.email) {
          await this.notification.sendEmail({
            to: member.email,
            subject: `Investment Maturity Reminder - ${daysUntil} day${daysUntil > 1 ? 's' : ''} remaining`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #083232;">Investment Maturity Reminder</h2>
                <p>Hi ${member.full_name},</p>
                <p>Your chama's investment is maturing in ${daysUntil} day${daysUntil > 1 ? 's' : ''}!</p>
                <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                  <p style="margin: 5px 0;"><strong>Investment Details:</strong></p>
                  <p style="margin: 5px 0;">Product: ${investment.product_name}</p>
                  <p style="margin: 5px 0;">Chama: ${investment.chama_name}</p>
                  <p style="margin: 5px 0;">Maturity Date: ${new Date(investment.maturity_date).toLocaleDateString()}</p>
                  <p style="margin: 5px 0;">Expected Return: KES ${parseFloat(investment.expected_return || 0).toLocaleString()}</p>
                </div>
                <p>Please log in to your account to view the investment details.</p>
                <p>Best regards,<br>Cycle Platform</p>
              </div>
            `,
          });
        }

        await this.notification.sendPushNotification(member.id, {
          title: `Investment Maturity Reminder`,
          body: `${investment.product_name} matures in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`,
          data: {
            type: 'investment_maturity_reminder',
            investmentId: investment.id,
            chamaId: investment.chama_id,
            daysUntil,
          },
        });
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to send maturity reminder: ${error.message}`,
      );
    }
  }
}

