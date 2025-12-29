import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { DatabaseService } from '../database/database.service';
import { PayoutService } from './payout.service';
import {
  SchedulePayoutDto,
  CancelPayoutDto,
  GetPayoutHistoryDto,
} from './dto/payout.dto';

@Controller({ path: 'chama', version: '1' })
@UseGuards(JwtAuthGuard)
export class PayoutController {
  constructor(
    private readonly payoutService: PayoutService,
    private readonly db: DatabaseService,
  ) {}

  /**
   * Schedule a payout for a cycle recipient
   * Admin only
   */
  @Post('payouts/schedule')
  @HttpCode(HttpStatus.CREATED)
  async schedulePayout(@Body() dto: SchedulePayoutDto, @Req() req: any) {
    // Get chama ID from cycle
    const cycleResult = await this.db.query(
      'SELECT chama_id FROM contribution_cycles WHERE id = $1',
      [dto.cycleId],
    );

    if (cycleResult.rowCount === 0) {
      throw new Error('Contribution cycle not found');
    }

    const chamaId = cycleResult.rows[0].chama_id;

    // Validate user is admin
    await this.validateChamaAdmin(chamaId, req.user.id);

    return this.payoutService.schedulePayout(dto);
  }

  /**
   * Execute a scheduled payout
   * Admin only
   */
  @Post('payouts/:id/execute')
  @HttpCode(HttpStatus.OK)
  async executePayout(@Param('id') payoutId: string, @Req() req: any) {
    // Get payout to validate admin access
    const payoutResult = await this.payoutService['db'].query(
      'SELECT chama_id FROM payouts WHERE id = $1',
      [payoutId],
    );

    if (payoutResult.rowCount === 0) {
      throw new Error('Payout not found');
    }

    const chamaId = payoutResult.rows[0].chama_id;

    // Validate user is admin
    await this.validateChamaAdmin(chamaId, req.user.id);

    return this.payoutService.executePayout(payoutId);
  }

  /**
   * Cancel a payout
   * Admin only
   */
  @Post('payouts/:id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelPayout(
    @Param('id') payoutId: string,
    @Body() dto: CancelPayoutDto,
    @Req() req: any,
  ) {
    // Get payout to validate admin access
    const payoutResult = await this.db.query(
      'SELECT chama_id FROM payouts WHERE id = $1',
      [payoutId],
    );

    if (payoutResult.rowCount === 0) {
      throw new Error('Payout not found');
    }

    const chamaId = payoutResult.rows[0].chama_id;

    // Validate user is admin
    await this.validateChamaAdmin(chamaId, req.user.id);

    return this.payoutService.cancelPayout(payoutId, dto.reason);
  }

  /**
   * Retry a failed payout
   * Admin only
   */
  @Post('payouts/:id/retry')
  @HttpCode(HttpStatus.OK)
  async retryPayout(@Param('id') payoutId: string, @Req() req: any) {
    // Get payout to validate admin access
    const payoutResult = await this.payoutService['db'].query(
      'SELECT chama_id FROM payouts WHERE id = $1',
      [payoutId],
    );

    if (payoutResult.rowCount === 0) {
      throw new Error('Payout not found');
    }

    const chamaId = payoutResult.rows[0].chama_id;

    // Validate user is admin
    await this.validateChamaAdmin(chamaId, req.user.id);

    return this.payoutService.retryFailedPayout(payoutId);
  }

  /**
   * Get payout history with filters
   * Members can see payouts for their chamas
   */
  @Get('payouts/history')
  async getPayoutHistory(
    @Query() filters: GetPayoutHistoryDto,
    @Req() req: any,
  ) {
    // If chamaId provided, validate user is member
    if (filters.chamaId) {
      await this.validateChamaMember(filters.chamaId, req.user.id);
    } else {
      // If no chamaId, only show payouts for user's chamas
      // Get all chama IDs where user is a member
      const result = await this.db.query(
        'SELECT chama_id FROM chama_members WHERE user_id = $1 AND status = $2',
        [req.user.id, 'active'],
      );

      if (result.rowCount === 0) {
        return {
          payouts: [],
          pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
        };
      }

      // For simplicity, require chamaId to be specified
      throw new Error('Please specify a chamaId filter');
    }

    return this.payoutService.getPayoutHistory(filters);
  }

  /**
   * Get payout details
   * Members can see payouts for their chamas
   */
  @Get('payouts/:id')
  async getPayoutDetails(@Param('id') payoutId: string, @Req() req: any) {
    // Get payout to validate access
    const payoutResult = await this.db.query(
      'SELECT chama_id FROM payouts WHERE id = $1',
      [payoutId],
    );

    if (payoutResult.rowCount === 0) {
      throw new Error('Payout not found');
    }

    const chamaId = payoutResult.rows[0].chama_id;

    // Validate user is member
    await this.validateChamaMember(chamaId, req.user.id);

    return this.payoutService.getPayoutDetails(payoutId);
  }

  /**
   * Get upcoming payouts for a chama
   */
  @Get(':chamaId/payouts/upcoming')
  async getUpcomingPayouts(@Param('chamaId') chamaId: string, @Req() req: any) {
    // Validate user is member
    await this.validateChamaMember(chamaId, req.user.id);

    return this.payoutService.getUpcomingPayouts(chamaId);
  }

  /**
   * Get payout summary for a chama
   */
  @Get(':chamaId/payouts/summary')
  async getPayoutSummary(@Param('chamaId') chamaId: string, @Req() req: any) {
    // Validate user is member
    await this.validateChamaMember(chamaId, req.user.id);

    // Get summary stats
    const result = await this.db.query(
      `SELECT 
        COUNT(*) as total_payouts,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
        COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0) as total_paid,
        COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) as pending_amount
       FROM payouts
       WHERE chama_id = $1`,
      [chamaId],
    );

    return result.rows[0];
  }

  /**
   * Validate user is a member of the chama
   */
  private async validateChamaMember(chamaId: string, userId: string) {
    const result = await this.db.query(
      `SELECT id FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND status = 'active'`,
      [chamaId, userId],
    );

    if (result.rowCount === 0) {
      throw new Error('You are not a member of this chama');
    }
  }

  /**
   * Validate user is admin of the chama
   */
  private async validateChamaAdmin(chamaId: string, userId: string) {
    const result = await this.db.query(
      `SELECT id FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND role IN ('admin', 'chairperson') AND status = 'active'`,
      [chamaId, userId],
    );

    if (result.rowCount === 0) {
      throw new Error('You must be an admin of this chama');
    }
  }
}
