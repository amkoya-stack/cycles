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
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ChamaService } from './chama.service';

@Controller('chama')
export class ChamaController {
  constructor(private readonly chamaService: ChamaService) {}

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
   * Get chama details
   * GET /api/chama/:id
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getChamaDetails(@Req() req: any, @Param('id') chamaId: string) {
    return this.chamaService.getChamaDetails(req.user.id, chamaId);
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
   * Join public chama (auto-accept)
   * POST /api/chama/:id/invite/accept-public
   */
  @Post(':id/invite/accept-public')
  @UseGuards(JwtAuthGuard)
  async joinPublicChama(@Req() req: any, @Param('id') chamaId: string) {
    return this.chamaService.joinPublicChama(req.user.id, chamaId);
  }

  /**
   * Request to join private chama
   * POST /api/chama/:id/invite/request
   */
  @Post(':id/invite/request')
  @UseGuards(JwtAuthGuard)
  async requestToJoin(@Req() req: any, @Param('id') chamaId: string) {
    return this.chamaService.requestToJoin(req.user.id, chamaId);
  }

  /**
   * List pending join requests (admin only)
   * GET /api/chama/:id/invite/requests
   */
  @Get(':id/invite/requests')
  @UseGuards(JwtAuthGuard)
  async listJoinRequests(@Req() req: any, @Param('id') chamaId: string) {
    return this.chamaService.listJoinRequests(req.user.id, chamaId);
  }

  /**
   * Respond to join request (admin only)
   * POST /api/chama/invite/:inviteId/respond
   */
  @Post('invite/:inviteId/respond')
  @UseGuards(JwtAuthGuard)
  async respondToJoinRequest(
    @Req() req: any,
    @Param('inviteId') inviteId: string,
    @Body() dto: { action: 'accept' | 'reject' },
  ) {
    return this.chamaService.respondToJoinRequest(
      req.user.id,
      inviteId,
      dto.action,
    );
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
   * Get contribution history
   * GET /api/chama/:id/contributions
   */
  @Get(':id/contributions')
  @UseGuards(JwtAuthGuard)
  async getContributionHistory(@Req() req: any, @Param('id') chamaId: string) {
    return this.chamaService.getContributionHistory(req.user.id, chamaId);
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
}
