import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { DisputeService } from './dispute.service';
import type { CreateDisputeDto, AddEvidenceDto, AddCommentDto, CastVoteDto, ResolveDisputeDto, EscalateDisputeDto } from './dispute.service';
import { FileUploadService } from './file-upload.service';

@Controller('disputes')
@UseGuards(JwtAuthGuard)
export class DisputeController {
  constructor(
    private readonly disputeService: DisputeService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  /**
   * File a new dispute
   */
  @Post()
  async fileDispute(@Req() req: any, @Body() dto: CreateDisputeDto) {
    return this.disputeService.fileDispute(req.user.id, dto);
  }

  /**
   * Get dispute by ID
   */
  @Get(':id')
  async getDispute(@Req() req: any, @Param('id') id: string) {
    return this.disputeService.getDispute(id, req.user.id);
  }

  /**
   * Get disputes for a chama
   */
  @Get('chama/:chamaId')
  async getChamaDisputes(
    @Req() req: any,
    @Param('chamaId') chamaId: string,
    @Query('status') status?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.disputeService.getChamaDisputes(
      chamaId,
      req.user.id,
      status as any,
      limit || 50,
      offset || 0,
    );
  }

  /**
   * Get user's disputes
   */
  @Get('user/my-disputes')
  async getUserDisputes(
    @Req() req: any,
    @Query('chamaId') chamaId?: string,
    @Query('status') status?: string,
  ) {
    return this.disputeService.getUserDisputes(
      req.user.id,
      chamaId,
      status as any,
    );
  }

  /**
   * Get dispute statistics for a chama
   */
  @Get('chama/:chamaId/stats')
  async getChamaDisputeStats(
    @Req() req: any,
    @Param('chamaId') chamaId: string,
  ) {
    return this.disputeService.getChamaDisputeStats(chamaId, req.user.id);
  }

  /**
   * Add evidence to dispute (with file upload)
   */
  @Post(':id/evidence')
  @UseInterceptors(FileInterceptor('file'))
  async addEvidence(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: AddEvidenceDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    // If file is provided, upload it first
    if (file) {
      const uploadResult = await this.fileUploadService.uploadFile(
        file,
        `disputes/${id}/evidence`,
        ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        10 * 1024 * 1024, // 10MB
      );
      dto.fileUrl = uploadResult.url;
      dto.fileType = file.mimetype;
      dto.fileSize = file.size;
    }

    return this.disputeService.addEvidence(req.user.id, id, dto);
  }

  /**
   * Get dispute evidence
   */
  @Get(':id/evidence')
  async getDisputeEvidence(@Req() req: any, @Param('id') id: string) {
    return this.disputeService.getDisputeEvidence(id, req.user.id);
  }

  /**
   * Add comment to dispute
   */
  @Post(':id/comments')
  async addComment(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: AddCommentDto,
  ) {
    return this.disputeService.addComment(req.user.id, id, dto);
  }

  /**
   * Get dispute comments
   */
  @Get(':id/comments')
  async getDisputeComments(@Req() req: any, @Param('id') id: string) {
    return this.disputeService.getDisputeComments(id, req.user.id);
  }

  /**
   * Start discussion phase
   */
  @Put(':id/start-discussion')
  async startDiscussion(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { discussionDeadline: string },
  ) {
    return this.disputeService.startDiscussion(
      req.user.id,
      id,
      new Date(body.discussionDeadline),
    );
  }

  /**
   * Start voting phase
   */
  @Put(':id/start-voting')
  async startVoting(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { votingDeadline: string; requiredVotes?: number },
  ) {
    return this.disputeService.startVoting(
      req.user.id,
      id,
      new Date(body.votingDeadline),
      body.requiredVotes,
    );
  }

  /**
   * Cast vote on dispute
   */
  @Post(':id/votes')
  async castVote(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: CastVoteDto,
  ) {
    return this.disputeService.castVote(req.user.id, id, dto);
  }

  /**
   * Get dispute votes
   */
  @Get(':id/votes')
  async getDisputeVotes(@Req() req: any, @Param('id') id: string) {
    return this.disputeService.getDisputeVotes(id, req.user.id);
  }

  /**
   * Resolve dispute
   */
  @Put(':id/resolve')
  async resolveDispute(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.disputeService.resolveDispute(req.user.id, id, dto);
  }

  /**
   * Escalate dispute to platform
   */
  @Post(':id/escalate')
  async escalateDispute(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: EscalateDisputeDto,
  ) {
    return this.disputeService.escalateDispute(req.user.id, id, dto);
  }

  /**
   * Update dispute status (admin/treasurer only)
   */
  @Put(':id/status')
  async updateDisputeStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.disputeService.updateDisputeStatus(
      req.user.id,
      id,
      body.status as any,
    );
  }
}

