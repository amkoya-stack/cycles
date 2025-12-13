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
@UseGuards(JwtAuthGuard)
export class ChamaController {
  constructor(private readonly chamaService: ChamaService) {}

  /**
   * Create new chama
   * POST /api/chama
   */
  @Post()
  async createChama(@Req() req: any, @Body() dto: any) {
    return this.chamaService.createChama(req.user.id, dto);
  }

  /**
   * Get user's chamas
   * GET /api/chama
   */
  @Get()
  async listChamas(@Req() req: any) {
    return this.chamaService.listUserChamas(req.user.id);
  }

  /**
   * Get chama details
   * GET /api/chama/:id
   */
  @Get(':id')
  async getChamaDetails(@Req() req: any, @Param('id') chamaId: string) {
    return this.chamaService.getChamaDetails(req.user.id, chamaId);
  }

  /**
   * Update chama
   * PUT /api/chama/:id
   */
  @Put(':id')
  async updateChama(
    @Req() req: any,
    @Param('id') chamaId: string,
    @Body() dto: any,
  ) {
    return this.chamaService.updateChama(req.user.id, chamaId, dto);
  }

  /**
   * Close chama
   * DELETE /api/chama/:id
   */
  @Delete(':id')
  async deleteChama(@Req() req: any, @Param('id') chamaId: string) {
    return this.chamaService.deleteChama(req.user.id, chamaId);
  }

  /**
   * Invite member
   * POST /api/chama/:id/invite
   */
  @Post(':id/invite')
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
  async acceptInvite(@Req() req: any, @Param('inviteId') inviteId: string) {
    return this.chamaService.acceptInvite(req.user.id, inviteId);
  }

  /**
   * List chama members
   * GET /api/chama/:id/members
   */
  @Get(':id/members')
  async listMembers(@Req() req: any, @Param('id') chamaId: string) {
    return this.chamaService.listMembers(req.user.id, chamaId);
  }

  /**
   * Remove member
   * DELETE /api/chama/:id/members/:userId
   */
  @Delete(':id/members/:userId')
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
  async getChamaBalance(@Req() req: any, @Param('id') chamaId: string) {
    const balance = await this.chamaService.getChamaBalance(chamaId);
    return { balance };
  }

  /**
   * Create contribution cycle
   * POST /api/chama/:id/cycles
   */
  @Post(':id/cycles')
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
  async getActiveCycle(@Req() req: any, @Param('id') chamaId: string) {
    return this.chamaService.getActiveCycle(req.user.id, chamaId);
  }

  /**
   * Get cycle history
   * GET /api/chama/:id/cycles
   */
  @Get(':id/cycles')
  async getCycleHistory(@Req() req: any, @Param('id') chamaId: string) {
    return this.chamaService.getCycleHistory(req.user.id, chamaId);
  }

  /**
   * Contribute to chama
   * POST /api/chama/:id/cycles/:cycleId/contribute
   */
  @Post(':id/cycles/:cycleId/contribute')
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
  async getContributionHistory(@Req() req: any, @Param('id') chamaId: string) {
    return this.chamaService.getContributionHistory(req.user.id, chamaId);
  }

  /**
   * Get member contributions
   * GET /api/chama/:id/members/:userId/contributions
   */
  @Get(':id/members/:userId/contributions')
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
}
