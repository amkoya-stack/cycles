/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  IsString,
  IsUUID,
  IsOptional,
  IsBoolean,
  IsInt,
  IsDateString,
  IsEnum,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum MeetingType {
  AUDIO = 'audio',
  VIDEO = 'video',
  SCREEN_SHARE = 'screen_share',
}

export enum MeetingStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export class CreateMeetingDto {
  @IsUUID()
  chamaId: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  agendaDocumentId?: string;

  @IsDateString()
  scheduledStart: string;

  @IsDateString()
  scheduledEnd: string;

  @IsOptional()
  @IsEnum(MeetingType)
  meetingType?: MeetingType;

  @IsOptional()
  @IsBoolean()
  isRecordingEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  requireApproval?: boolean;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(500)
  maxParticipants?: number;

  @IsOptional()
  settings?: {
    allowScreenShare?: boolean;
    allowChat?: boolean;
    allowReactions?: boolean;
    allowRaiseHand?: boolean;
    muteOnJoin?: boolean;
    waitingRoomEnabled?: boolean;
    recordAutomatically?: boolean;
    lateThresholdMinutes?: number;
  };
}

export class UpdateMeetingDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  agendaDocumentId?: string;

  @IsOptional()
  @IsDateString()
  scheduledStart?: string;

  @IsOptional()
  @IsDateString()
  scheduledEnd?: string;

  @IsOptional()
  @IsEnum(MeetingStatus)
  status?: MeetingStatus;

  @IsOptional()
  settings?: {
    allowScreenShare?: boolean;
    allowChat?: boolean;
    allowReactions?: boolean;
    allowRaiseHand?: boolean;
    muteOnJoin?: boolean;
    waitingRoomEnabled?: boolean;
    recordAutomatically?: boolean;
    lateThresholdMinutes?: number;
  };
}

export class InviteParticipantsDto {
  @IsUUID('4', { each: true })
  userIds: string[];
}

export class JoinMeetingDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsBoolean()
  audioEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  videoEnabled?: boolean;
}

export class SendChatMessageDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  messageType?: 'text' | 'reaction' | 'poll' | 'hand_raised';

  @IsOptional()
  metadata?: Record<string, any>;
}

export class CancelMeetingDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateRecordingAccessDto {
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsString({ each: true })
  allowedViewerRoles?: string[];
}
