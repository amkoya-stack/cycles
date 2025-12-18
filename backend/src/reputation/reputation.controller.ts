/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ReputationService } from './reputation.service';
import { BadgeService } from './badge.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('reputation')
@UseGuards(JwtAuthGuard)
export class ReputationController {
  constructor(
    private reputationService: ReputationService,
    private badgeService: BadgeService,
  ) {}

  /**
   * Calculate reputation for a user in a chama
   */
  @Post(':chamaId/calculate/:userId')
  async calculateReputation(
    @Param('chamaId') chamaId: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    // Verify user is a member of the chama or is the user themselves
    const requestingUserId = req.user.id;

    if (requestingUserId !== userId) {
      // Check if requesting user is admin of the chama
      const memberCheckResult = await this.reputationService['db'].query(
        `SELECT role FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND status = 'active'`,
        [chamaId, requestingUserId],
      );

      if (
        memberCheckResult.rows.length === 0 ||
        !['admin', 'chairperson'].includes(memberCheckResult.rows[0].role)
      ) {
        throw new BadRequestException(
          'Only admins can calculate reputation for other users',
        );
      }
    }

    const reputation = await this.reputationService.calculateUserReputation(
      userId,
      chamaId,
    );

    // Check and award badges
    await this.badgeService.checkAndAwardBadges(userId, chamaId);

    return {
      success: true,
      reputation,
    };
  }

  /**
   * Get user reputation
   */
  @Get(':chamaId/user/:userId')
  async getUserReputation(
    @Param('chamaId') chamaId: string,
    @Param('userId') userId: string,
  ) {
    const reputation = await this.reputationService.getUserReputation(
      userId,
      chamaId,
    );

    if (!reputation) {
      throw new BadRequestException('Reputation not found');
    }

    return {
      success: true,
      reputation,
    };
  }

  /**
   * Get my reputation in a chama
   */
  @Get(':chamaId/me')
  async getMyReputation(@Param('chamaId') chamaId: string, @Req() req: any) {
    const userId = req.user.id;
    let reputation = await this.reputationService.getUserReputation(
      userId,
      chamaId,
    );

    // If no reputation exists, calculate it
    if (!reputation) {
      reputation = await this.reputationService.calculateUserReputation(
        userId,
        chamaId,
      );
      await this.badgeService.checkAndAwardBadges(userId, chamaId);
    }

    return {
      success: true,
      reputation,
    };
  }

  /**   * Check loan eligibility (FRAUD PREVENTION)
   */
  @Get(':chamaId/loan-eligibility/:requestedAmount')
  async checkLoanEligibility(
    @Param('chamaId') chamaId: string,
    @Param('requestedAmount') requestedAmount: string,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    const amount = parseFloat(requestedAmount);

    if (isNaN(amount) || amount <= 0) {
      throw new BadRequestException('Invalid loan amount');
    }

    const eligibility = await this.reputationService.getLoanEligibility(
      userId,
      chamaId,
      amount,
    );

    return {
      success: true,
      data: eligibility,
    };
  }

  /**   * Get chama leaderboard
   */
  @Get(':chamaId/leaderboard')
  async getChamaLeaderboard(
    @Param('chamaId') chamaId: string,
    @Query('limit') limit?: string,
  ) {
    const leaderboard = await this.reputationService.getChamaLeaderboard(
      chamaId,
      limit ? parseInt(limit) : 50,
    );

    return {
      success: true,
      leaderboard,
    };
  }

  /**
   * Get user reputation history
   */
  @Get(':chamaId/history/:userId')
  async getUserReputationHistory(
    @Param('chamaId') chamaId: string,
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    const history = await this.reputationService.getUserReputationHistory(
      userId,
      chamaId,
      limit ? parseInt(limit) : 50,
    );

    return {
      success: true,
      history,
    };
  }

  /**
   * Batch calculate reputation for entire chama
   */
  @Post(':chamaId/calculate-all')
  async calculateChamaReputation(
    @Param('chamaId') chamaId: string,
    @Req() req: any,
  ) {
    // Verify user is admin of the chama
    const requestingUserId = req.user.id;
    const memberCheckResult = await this.reputationService['db'].query(
      `SELECT role FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND status = 'active'`,
      [chamaId, requestingUserId],
    );

    if (
      memberCheckResult.rows.length === 0 ||
      !['admin', 'chairperson'].includes(memberCheckResult.rows[0].role)
    ) {
      throw new BadRequestException(
        'Only admins can calculate reputation for all members',
      );
    }

    await this.reputationService.calculateChamaReputation(chamaId);

    return {
      success: true,
      message: 'Reputation calculated for all chama members',
    };
  }

  /**
   * Get all badges
   */
  @Get('badges/all')
  async getAllBadges() {
    const badges = await this.badgeService.getAllBadges();

    return {
      success: true,
      badges,
    };
  }

  /**
   * Get user badges
   */
  @Get(':chamaId/badges/:userId')
  async getUserBadges(
    @Param('chamaId') chamaId: string,
    @Param('userId') userId: string,
  ) {
    const badges = await this.badgeService.getUserBadges(userId, chamaId);
    const summary = await this.badgeService.getUserBadgeSummary(
      userId,
      chamaId,
    );

    return {
      success: true,
      badges,
      summary,
    };
  }

  /**
   * Get my badges
   */
  @Get(':chamaId/badges/me')
  async getMyBadges(@Param('chamaId') chamaId: string, @Req() req: any) {
    const userId = req.user.id;
    const badges = await this.badgeService.getUserBadges(userId, chamaId);
    const summary = await this.badgeService.getUserBadgeSummary(
      userId,
      chamaId,
    );

    return {
      success: true,
      badges,
      summary,
    };
  }
}
