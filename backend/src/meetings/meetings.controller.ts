/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { MeetingsService } from './meetings.service';
import {
  CreateMeetingDto,
  UpdateMeetingDto,
  InviteParticipantsDto,
  JoinMeetingDto,
  SendChatMessageDto,
  CancelMeetingDto,
  UpdateRecordingAccessDto,
  MeetingStatus,
} from './dto/meeting.dto';

@Controller('meetings')
@UseGuards(JwtAuthGuard)
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  /**
   * Create a new meeting
   * POST /api/meetings
   */
  @Post()
  async createMeeting(@Req() req: any, @Body() dto: CreateMeetingDto) {
    return this.meetingsService.createMeeting(req.user.id, dto);
  }

  /**
   * Get chama meetings
   * GET /api/meetings/chama/:chamaId?status=scheduled
   */
  @Get('chama/:chamaId')
  async getChamaMeetings(
    @Req() req: any,
    @Param('chamaId') chamaId: string,
    @Query('status') status?: MeetingStatus,
  ) {
    return this.meetingsService.getChamaMeetings(req.user.id, chamaId, status);
  }

  /**
   * Get meeting details
   * GET /api/meetings/:id
   */
  @Get(':id')
  async getMeeting(@Req() req: any, @Param('id') id: string) {
    return this.meetingsService.getMeeting(req.user.id, id);
  }

  /**
   * Update meeting
   * PUT /api/meetings/:id
   */
  @Put(':id')
  async updateMeeting(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateMeetingDto,
  ) {
    return this.meetingsService.updateMeeting(req.user.id, id, dto);
  }

  /**
   * Cancel meeting
   * POST /api/meetings/:id/cancel
   */
  @Post(':id/cancel')
  async cancelMeeting(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: CancelMeetingDto,
  ) {
    return this.meetingsService.cancelMeeting(req.user.id, id, dto);
  }

  /**
   * Invite participants
   * POST /api/meetings/:id/invite
   */
  @Post(':id/invite')
  async inviteParticipants(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: InviteParticipantsDto,
  ) {
    return this.meetingsService.inviteParticipants(req.user.id, id, dto);
  }

  /**
   * Generate join token
   * POST /api/meetings/:id/join
   */
  @Post(':id/join')
  async joinMeeting(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: JoinMeetingDto,
  ) {
    return this.meetingsService.generateJoinToken(req.user.id, id, dto);
  }

  /**
   * Leave meeting
   * POST /api/meetings/:id/leave
   */
  @Post(':id/leave')
  async leaveMeeting(@Req() req: any, @Param('id') id: string) {
    return this.meetingsService.leaveMeeting(req.user.id, id);
  }

  /**
   * Get participants
   * GET /api/meetings/:id/participants
   */
  @Get(':id/participants')
  async getParticipants(@Req() req: any, @Param('id') id: string) {
    return this.meetingsService.getMeetingParticipants(req.user.id, id);
  }

  /**
   * Get attendance report
   * GET /api/meetings/:id/attendance
   */
  @Get(':id/attendance')
  async getAttendanceReport(@Req() req: any, @Param('id') id: string) {
    return this.meetingsService.getAttendanceReport(req.user.id, id);
  }

  /**
   * Send chat message
   * POST /api/meetings/:id/chat
   */
  @Post(':id/chat')
  async sendChatMessage(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: SendChatMessageDto,
  ) {
    return this.meetingsService.sendChatMessage(req.user.id, id, dto);
  }

  /**
   * Get chat messages
   * GET /api/meetings/:id/chat
   */
  @Get(':id/chat')
  async getChatMessages(@Req() req: any, @Param('id') id: string) {
    return this.meetingsService.getChatMessages(req.user.id, id);
  }

  /**
   * Get recordings
   * GET /api/meetings/:id/recordings
   */
  @Get(':id/recordings')
  async getRecordings(@Req() req: any, @Param('id') id: string) {
    return this.meetingsService.getMeetingRecordings(req.user.id, id);
  }

  /**
   * Update recording access
   * PUT /api/meetings/recordings/:recordingId/access
   */
  @Put('recordings/:recordingId/access')
  async updateRecordingAccess(
    @Req() req: any,
    @Param('recordingId') recordingId: string,
    @Body() dto: UpdateRecordingAccessDto,
  ) {
    return this.meetingsService.updateRecordingAccess(
      req.user.id,
      recordingId,
      dto,
    );
  }
}
