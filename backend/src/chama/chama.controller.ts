import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ChamaService } from './chama.service';
import { ChamaReputationService } from './chama-reputation.service';

@Controller('chama')
export class ChamaController {
  constructor(
    private readonly chamaService: ChamaService,
    private readonly reputationService: ChamaReputationService,
  ) {}

  /**
   * Browse all public chamas (no auth required)
   * GET /api/chama/public
   */
  @Get('public')
  async listPublicChamas() {
    return this.chamaService.listPublicChamas();
  }

  /**
   * Get public chama details by slug (no auth required)
   * GET /api/chama/public/slug/:slug
   */
  @Get('public/slug/:slug')
  async getPublicChamaBySlug(@Param('slug') slug: string) {
    return this.chamaService.getPublicChamaDetailsBySlug(slug);
  }

  /**
   * Create new chama
   * POST /api/chama
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  async createChama(@Req() req: any, @Body() dto: any) {
    return this.chamaService.createChama(req.user.id, dto);
  }

  /**
   * Get user's chamas
   * GET /api/chama
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async listChamas(@Req() req: any) {
    console.log('GET /api/chama called for user:', req.user?.id);
    return this.chamaService.listUserChamas(req.user.id);
  }

  /**
   * Get upcoming contributions for user (for wallet alert)
   * GET /api/chama/upcoming-contributions
   * NOTE: Must come BEFORE :id route to avoid UUID parsing error
   */
  @Get('upcoming-contributions')
  @UseGuards(JwtAuthGuard)
  async getUpcomingContributions(@Req() req: any) {
    return this.chamaService.getUpcomingContributions(req.user.id);
  }

  /**
   * Get chama details
   * GET /api/chama/:id
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getChamaDetails(@Req() req: any, @Param('id') chamaId: string) {
    return this.chamaService.getChamaDetails(req.user.id, chamaId);
  }

  /**
   * Update chama settings (admin only)
   * PUT /api/chama/:id/settings
   */
  @Put(':id/settings')
  @UseGuards(JwtAuthGuard)
  async updateChamaSettings(
    @Req() req: any,
    @Param('id') chamaId: string,
    @Body() dto: { settings: any },
  ) {
    console.log('PUT /api/chama/:id/settings - settings:', dto.settings);
    return this.chamaService.updateChama(req.user.id, chamaId, dto);
  }

  /**
   * Manually trigger cycle completion check and payout (admin only)
   * POST /api/chama/:chamaId/cycles/:cycleId/complete
   */
  @Post(':chamaId/cycles/:cycleId/complete')
  @UseGuards(JwtAuthGuard)
  async completeCycle(
    @Req() req: any,
    @Param('chamaId') chamaId: string,
    @Param('cycleId') cycleId: string,
  ) {
    return this.chamaService.manuallyCompleteCycle(
      req.user.id,
      chamaId,
      cycleId,
    );
  }

  /**
   * Update chama
   * PUT /api/chama/:id
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async updateChama(
    @Req() req: any,
    @Param('id') chamaId: string,
    @Body() dto: any,
  ) {
    console.log(
      'PUT /api/chama/:id - coverImage present:',
      !!dto.coverImage,
      'length:',
      dto.coverImage?.length,
    );
    return this.chamaService.updateChama(req.user.id, chamaId, dto);
  }

  /**
   * Close chama
   * DELETE /api/chama/:id
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteChama(@Req() req: any, @Param('id') chamaId: string) {
    return this.chamaService.deleteChama(req.user.id, chamaId);
  }

  /**
   * Invite member
   * POST /api/chama/:id/invite
   */
  @Post(':id/invite')
  @UseGuards(JwtAuthGuard)
  async inviteMember(
    @Req() req: any,
    @Param('id') chamaId: string,
    @Body() dto: any,
  ) {
    return this.chamaService.inviteMember(req.user.id, chamaId, dto);
  }

  /**
   * Accept invitation
   * POST /api/chama/invite/:inviteId/accept
   */
  @Post('invite/:inviteId/accept')
  @UseGuards(JwtAuthGuard)
  async acceptInvite(@Req() req: any, @Param('inviteId') inviteId: string) {
    return this.chamaService.acceptInvite(req.user.id, inviteId);
  }

  /**
   * Get invite details by token (for shareable links)
   * GET /api/chama/invite/token/:token
   */
  @Get('invite/token/:token')
  async getInviteByToken(@Param('token') token: string) {
    return this.chamaService.getInviteByToken(token);
  }

  /**
   * Accept invitation via token (for shareable links)
   * POST /api/chama/invite/token/:token/accept
   */
  @Post('invite/token/:token/accept')
  @UseGuards(JwtAuthGuard)
  async acceptInviteByToken(@Req() req: any, @Param('token') token: string) {
    return this.chamaService.acceptInviteByToken(req.user.id, token);
  }

  /**
   * Join public chama (auto-accept)
   * POST /api/chama/:id/invite/accept-public
   */
  @Post(':id/invite/accept-public')
  @UseGuards(JwtAuthGuard)
  async joinPublicChama(@Req() req: any, @Param('id') chamaId: string) {
    return this.chamaService.joinPublicChama(req.user.id, chamaId);
  }

  /**
   * List pending join requests (admin only)
   * GET /api/chama/:id/invite/requests
   */
  @Get(':id/invite/requests')
  @UseGuards(JwtAuthGuard)
  async listJoinRequests(@Req() req: any, @Param('id') chamaId: string) {
    console.log(
      `[Controller] listJoinRequests called: user=${req.user?.id}, chama=${chamaId}`,
    );
    try {
      const result = await this.chamaService.listJoinRequests(
        req.user.id,
        chamaId,
      );
      console.log(
        `[Controller] listJoinRequests success: found ${result.length} requests`,
      );
      return result;
    } catch (error) {
      console.error(`[Controller] listJoinRequests error:`, error.message);
      throw error;
    }
  }

  /**
   * List chama members
   * GET /api/chama/:id/members
   */
  @Get(':id/members')
  @UseGuards(JwtAuthGuard)
  async listMembers(@Req() req: any, @Param('id') chamaId: string) {
    return this.chamaService.listMembers(req.user.id, chamaId);
  }

  /**
   * Remove member
   * DELETE /api/chama/:id/members/:userId
   */
  @Delete(':id/members/:userId')
  @UseGuards(JwtAuthGuard)
  async removeMember(
    @Req() req: any,
    @Param('id') chamaId: string,
    @Param('userId') memberUserId: string,
  ) {
    return this.chamaService.removeMember(req.user.id, chamaId, memberUserId);
  }

  /**
   * Update member role
   * PUT /api/chama/:id/members/:userId/role
   */
  @Put(':id/members/:userId/role')
  @UseGuards(JwtAuthGuard)
  async updateMemberRole(
    @Req() req: any,
    @Param('id') chamaId: string,
    @Param('userId') memberUserId: string,
    @Body() body: { role: string },
  ) {
    return this.chamaService.updateMemberRole(
      req.user.id,
      chamaId,
      memberUserId,
      body.role,
    );
  }

  /**
   * Get chama balance
   * GET /api/chama/:id/balance
   */
  @Get(':id/balance')
  @UseGuards(JwtAuthGuard)
  async getChamaBalance(@Req() req: any, @Param('id') chamaId: string) {
    const balance = await this.chamaService.getChamaBalance(chamaId);
    return { balance };
  }

  /**
   * Create contribution cycle
   * POST /api/chama/:id/cycles
   */
  @Post(':id/cycles')
  @UseGuards(JwtAuthGuard)
  async createCycle(
    @Req() req: any,
    @Param('id') chamaId: string,
    @Body() dto: any,
  ) {
    return this.chamaService.createContributionCycle(req.user.id, chamaId, dto);
  }

  /**
   * Get active cycle
   * GET /api/chama/:id/cycles/active
   */
  @Get(':id/cycles/active')
  @UseGuards(JwtAuthGuard)
  async getActiveCycle(@Req() req: any, @Param('id') chamaId: string) {
    return this.chamaService.getActiveCycle(req.user.id, chamaId);
  }

  /**
   * Get cycle history
   * GET /api/chama/:id/cycles
   */
  @Get(':id/cycles')
  @UseGuards(JwtAuthGuard)
  async getCycleHistory(@Req() req: any, @Param('id') chamaId: string) {
    return this.chamaService.getCycleHistory(req.user.id, chamaId);
  }

  /**
   * Contribute to chama
   * POST /api/chama/:id/cycles/:cycleId/contribute
   */
  @Post(':id/cycles/:cycleId/contribute')
  @UseGuards(JwtAuthGuard)
  async contribute(
    @Req() req: any,
    @Param('id') chamaId: string,
    @Param('cycleId') cycleId: string,
    @Body() dto: any,
  ) {
    return this.chamaService.contributeToChama(
      req.user.id,
      chamaId,
      cycleId,
      dto,
    );
  }

  /**
   * Get contribution history (legacy)
   * GET /api/chama/:id/contributions
   */
  @Get(':id/contributions')
  @UseGuards(JwtAuthGuard)
  async getContributionHistoryLegacy(
    @Req() req: any,
    @Param('id') chamaId: string,
  ) {
    return this.chamaService.getContributionHistoryLegacy(req.user.id, chamaId);
  }

  /**
   * Get member contributions
   * GET /api/chama/:id/members/:userId/contributions
   */
  @Get(':id/members/:userId/contributions')
  @UseGuards(JwtAuthGuard)
  async getMemberContributions(
    @Req() req: any,
    @Param('id') chamaId: string,
    @Param('userId') memberUserId: string,
  ) {
    return this.chamaService.getMemberContributions(
      req.user.id,
      chamaId,
      memberUserId,
    );
  }

  /**
   * Execute payout
   * POST /api/chama/:id/cycles/:cycleId/payout
   */
  @Post(':id/cycles/:cycleId/payout')
  @UseGuards(JwtAuthGuard)
  async executePayout(
    @Req() req: any,
    @Param('id') chamaId: string,
    @Param('cycleId') cycleId: string,
  ) {
    return this.chamaService.executePayoutCycle(req.user.id, chamaId, cycleId);
  }

  /**
   * Get payout history
   * GET /api/chama/:id/payouts
   */
  @Get(':id/payouts')
  async getPayoutHistory(@Req() req: any, @Param('id') chamaId: string) {
    return this.chamaService.getPayoutHistory(req.user.id, chamaId);
  }

  /**
   * Get all co-members (users from chamas the current user is in)
   * GET /api/chama/co-members/all
   */
  @Get('co-members/all')
  @UseGuards(JwtAuthGuard)
  async getCoMembers(@Req() req: any) {
    return this.chamaService.getCoMembers(req.user.id);
  }

  /**
   * Leave chama
   * POST /api/chama/:id/leave
   */
  @Post(':id/leave')
  @UseGuards(JwtAuthGuard)
  async leaveChama(
    @Req() req: any,
    @Param('id') chamaId: string,
    @Body() dto: any,
  ) {
    return this.chamaService.leaveChama(req.user.id, chamaId, dto);
  }

  // ============================================================================
  // CONTRIBUTION ENDPOINTS (Phase 5A)
  // ============================================================================

  /**
   * Make a contribution to a cycle
   * POST /api/chama/contributions
   */
  @Post('contributions')
  @UseGuards(JwtAuthGuard)
  async createContribution(@Req() req: any, @Body() dto: any) {
    return this.chamaService.createContribution(req.user.id, dto);
  }

  /**
   * Get contribution history - REMOVED: Feature integrated into transaction history
   * GET /api/chama/contributions
   */
  @Get('contributions')
  @UseGuards(JwtAuthGuard)
  async getContributionHistory(@Req() req: any, @Query() query: any) {
    throw new NotFoundException(
      'This endpoint has been removed. View contributions in your transaction history.',
    );
  }

  /**
   * Get cycle contribution summary (dashboard)
   * GET /api/chama/cycles/:cycleId/summary
   */
  @Get('cycles/:cycleId/summary')
  @UseGuards(JwtAuthGuard)
  async getCycleSummary(@Req() req: any, @Param('cycleId') cycleId: string) {
    return this.chamaService.getCycleContributionSummary(cycleId, req.user.id);
  }

  /**
   * Setup auto-debit
   * POST /api/chama/auto-debit
   */
  @Post('auto-debit')
  @UseGuards(JwtAuthGuard)
  async setupAutoDebit(@Req() req: any, @Body() dto: any) {
    return this.chamaService.setupAutoDebit(req.user.id, dto);
  }

  /**
   * Update auto-debit settings
   * PUT /api/chama/auto-debit/:id
   */
  @Put('auto-debit/:id')
  @UseGuards(JwtAuthGuard)
  async updateAutoDebit(
    @Req() req: any,
    @Param('id') autoDebitId: string,
    @Body() dto: any,
  ) {
    return this.chamaService.updateAutoDebit(req.user.id, autoDebitId, dto);
  }

  /**
   * Get member penalties
   * GET /api/chama/penalties
   */
  @Get('penalties')
  @UseGuards(JwtAuthGuard)
  async getMemberPenalties(
    @Req() req: any,
    @Param('chamaId') chamaId?: string,
  ) {
    return this.chamaService.getMemberPenalties(req.user.id, chamaId);
  }

  /**
   * Request penalty waiver
   * POST /api/chama/penalties/waiver
   */
  @Post('penalties/waiver')
  @UseGuards(JwtAuthGuard)
  async requestPenaltyWaiver(@Req() req: any, @Body() dto: any) {
    return this.chamaService.requestPenaltyWaiver(req.user.id, dto);
  }

  /**
   * Vote on penalty waiver
   * POST /api/chama/penalties/waiver/vote
   */
  @Post('penalties/waiver/vote')
  @UseGuards(JwtAuthGuard)
  async votePenaltyWaiver(@Req() req: any, @Body() dto: any) {
    return this.chamaService.votePenaltyWaiver(req.user.id, dto);
  }

  // ================== CHAMA REPUTATION ENDPOINTS ==================

  /**
   * Get chama reputation score and breakdown
   * GET /api/chama/:id/reputation
   */
  @Get(':id/reputation')
  async getChamaReputation(@Param('id') chamaId: string) {
    return this.reputationService.calculateChamaReputation(chamaId);
  }

  /**
   * Get top-rated chamas (leaderboard)
   * GET /api/chama/reputation/leaderboard
   */
  @Get('reputation/leaderboard')
  async getTopRatedChamas(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.reputationService.getTopRatedChamas(limitNum);
  }

  /**
   * Search chamas by reputation criteria
   * GET /api/chama/reputation/search?minScore=500&minTier=silver&maxDefaultRate=5
   */
  @Get('reputation/search')
  async searchByReputation(
    @Query('minScore') minScore?: string,
    @Query('minTier')
    minTier?: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond',
    @Query('maxDefaultRate') maxDefaultRate?: string,
    @Query('minRetentionRate') minRetentionRate?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reputationService.searchByReputation({
      minScore: minScore ? parseInt(minScore, 10) : undefined,
      minTier,
      maxDefaultRate: maxDefaultRate ? parseFloat(maxDefaultRate) : undefined,
      minRetentionRate: minRetentionRate
        ? parseFloat(minRetentionRate)
        : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * Assign role to member (chairperson only)
   * POST /api/chama/:chamaId/members/:userId/assign-role
   */
  @Post(':chamaId/members/:userId/assign-role')
  @UseGuards(JwtAuthGuard)
  async assignRole(
    @Req() req: any,
    @Param('chamaId') chamaId: string,
    @Param('userId') userId: string,
    @Body()
    dto: {
      role: 'chairperson' | 'treasurer' | 'secretary' | 'member';
      reason?: string;
    },
  ) {
    return this.chamaService.assignRole(
      req.user.id,
      chamaId,
      userId,
      dto.role,
      dto.reason,
    );
  }

  /**
   * Request to join chama
   * POST /api/chama/:chamaId/join-request
   */
  @Post(':chamaId/join-request')
  @UseGuards(JwtAuthGuard)
  async requestToJoin(
    @Req() req: any,
    @Param('chamaId') chamaId: string,
    @Body() dto: { message?: string },
  ) {
    return this.chamaService.requestToJoin(req.user.id, chamaId, dto.message);
  }

  /**
   * Respond to join request (chairperson only)
   * POST /api/chama/:chamaId/join-requests/:requestId/respond
   */
  @Post(':chamaId/join-requests/:requestId/respond')
  @UseGuards(JwtAuthGuard)
  async respondToJoinRequest(
    @Req() req: any,
    @Param('chamaId') chamaId: string,
    @Param('requestId') requestId: string,
    @Body() dto: { action: 'approve' | 'reject'; response?: string },
  ) {
    return this.chamaService.respondToJoinRequest(
      req.user.id,
      chamaId,
      requestId,
      dto.action,
      dto.response,
    );
  }

  /**
   * Expel member from chama (chairperson only)
   * POST /api/chama/:chamaId/members/:userId/expel
   */
  @Post(':chamaId/members/:userId/expel')
  @UseGuards(JwtAuthGuard)
  async expelMember(
    @Req() req: any,
    @Param('chamaId') chamaId: string,
    @Param('userId') userId: string,
    @Body() dto: { reason: string },
  ) {
    return this.chamaService.expelMember(
      req.user.id,
      chamaId,
      userId,
      dto.reason,
    );
  }

  /**
   * Get member directory with role information
   * GET /api/chama/:chamaId/members/directory
   */
  @Get(':chamaId/members/directory')
  @UseGuards(JwtAuthGuard)
  async getMemberDirectory(
    @Req() req: any,
    @Param('chamaId') chamaId: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ) {
    const members = await this.chamaService.listMembers(req.user.id, chamaId);

    // Apply filters if provided
    let filteredMembers = members;
    if (role) {
      filteredMembers = filteredMembers.filter((m: any) => m.role === role);
    }
    if (status) {
      filteredMembers = filteredMembers.filter((m: any) => m.status === status);
    }

    return filteredMembers;
  }
}
