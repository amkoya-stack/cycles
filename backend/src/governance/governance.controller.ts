/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  GovernanceService,
  ProposalType,
  VotingType,
  VoteChoice,
} from './governance.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('governance')
@UseGuards(JwtAuthGuard)
export class GovernanceController {
  constructor(private readonly governanceService: GovernanceService) {}

  /**
   * Create a proposal
   * POST /api/governance/proposals
   */
  @Post('proposals')
  async createProposal(@Req() req: any, @Body() dto: any) {
    return this.governanceService.createProposal({
      chamaId: dto.chamaId,
      createdBy: req.user.id,
      proposalType: dto.proposalType as ProposalType,
      title: dto.title,
      description: dto.description,
      metadata: dto.metadata,
      votingType: dto.votingType as VotingType,
      requiredPercentage: dto.requiredPercentage,
      anonymous: dto.anonymous,
      allowVoteChange: dto.allowVoteChange,
      deadlineHours: dto.deadlineHours,
    });
  }

  /**
   * Get chama proposals
   * GET /api/governance/chama/:chamaId/proposals
   */
  @Get('chama/:chamaId/proposals')
  async getChamaProposals(
    @Req() req: any,
    @Param('chamaId') chamaId: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.governanceService.getChamaProposals({
      chamaId,
      userId: req.user.id,
      status: status as any,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });
  }

  /**
   * Get proposal details
   * GET /api/governance/proposals/:proposalId
   */
  @Get('proposals/:proposalId')
  async getProposal(@Req() req: any, @Param('proposalId') proposalId: string) {
    return this.governanceService.getProposal(proposalId, req.user.id);
  }

  /**
   * Cast a vote
   * POST /api/governance/proposals/:proposalId/vote
   */
  @Post('proposals/:proposalId/vote')
  async castVote(
    @Req() req: any,
    @Param('proposalId') proposalId: string,
    @Body() dto: any,
  ) {
    return this.governanceService.castVote({
      proposalId,
      userId: req.user.id,
      vote: dto.vote as VoteChoice,
      reason: dto.reason,
      delegateId: dto.delegateId,
    });
  }

  /**
   * Add discussion comment
   * POST /api/governance/proposals/:proposalId/discuss
   */
  @Post('proposals/:proposalId/discuss')
  async addDiscussion(
    @Req() req: any,
    @Param('proposalId') proposalId: string,
    @Body() dto: any,
  ) {
    return this.governanceService.addDiscussion({
      proposalId,
      userId: req.user.id,
      comment: dto.comment,
      parentId: dto.parentId,
    });
  }

  /**
   * Close proposal and calculate results
   * POST /api/governance/proposals/:proposalId/close
   */
  @Post('proposals/:proposalId/close')
  async closeProposal(
    @Req() req: any,
    @Param('proposalId') proposalId: string,
  ) {
    return this.governanceService.closeProposal(proposalId, req.user.id);
  }

  /**
   * Execute a passed proposal
   * POST /api/governance/proposals/:proposalId/execute
   */
  @Post('proposals/:proposalId/execute')
  async executeProposal(
    @Req() req: any,
    @Param('proposalId') proposalId: string,
  ) {
    return this.governanceService.executeProposal(proposalId, req.user.id);
  }

  /**
   * Check and execute all proposals that have reached majority
   * POST /api/governance/check-and-execute-majority
   */
  @Post('check-and-execute-majority')
  async checkAndExecuteMajorityProposals(@Req() req: any) {
    return this.governanceService.checkAndExecuteAllMajorityProposals(
      req.user.id,
    );
  }

  /**
   * Get voting statistics
   * GET /api/governance/chama/:chamaId/stats
   */
  @Get('chama/:chamaId/stats')
  async getVotingStats(@Req() req: any, @Param('chamaId') chamaId: string) {
    return this.governanceService.getVotingStats(chamaId, req.user.id);
  }

  /**
   * Cancel/delete a proposal
   * DELETE /api/governance/proposals/:proposalId
   */
  @Delete('proposals/:proposalId')
  async cancelProposal(
    @Req() req: any,
    @Param('proposalId') proposalId: string,
  ) {
    return this.governanceService.cancelProposal(proposalId, req.user.id);
  }
}
