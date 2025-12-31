/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
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
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);
  private livekitClient: RoomServiceClient;
  private livekitApiKey: string;
  private livekitApiSecret: string;
  private livekitUrl: string;

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {
    this.livekitApiKey = this.config.get<string>('LIVEKIT_API_KEY') || '';
    this.livekitApiSecret = this.config.get<string>('LIVEKIT_API_SECRET') || '';
    this.livekitUrl = this.config.get<string>('LIVEKIT_URL') || '';

    if (this.livekitApiKey && this.livekitApiSecret && this.livekitUrl) {
      this.livekitClient = new RoomServiceClient(
        this.livekitUrl,
        this.livekitApiKey,
        this.livekitApiSecret,
      );
      this.logger.log('Livekit client initialized');
    } else {
      this.logger.warn('Livekit credentials not configured');
    }
  }

  /**
   * Create a new meeting
   */
  async createMeeting(userId: string, dto: CreateMeetingDto) {
    // Verify user is an active chama member
    const member = await this.db.query(
      `SELECT role FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND status = 'active'`,
      [dto.chamaId, userId],
    );

    if (member.rowCount === 0) {
      throw new ForbiddenException(
        'You must be an active chama member to create meetings',
      );
    }

    // All active members can create meetings - no role restriction
    // This allows members to have private discussions without leadership

    // Idempotency check: prevent duplicate meetings
    // Check if user created a meeting with same title in last 5 minutes
    const recentMeeting = await this.db.query(
      `SELECT * FROM meetings 
       WHERE chama_id = $1 
         AND host_user_id = $2 
         AND title = $3 
         AND created_at > NOW() - INTERVAL '5 minutes'
         AND status IN ('scheduled', 'in_progress')
       ORDER BY created_at DESC 
       LIMIT 1`,
      [dto.chamaId, userId, dto.title],
    );

    if (recentMeeting.rowCount > 0) {
      this.logger.log(
        `Returning existing meeting (idempotency): ${recentMeeting.rows[0].id}`,
      );
      return recentMeeting.rows[0];
    }

    // Validate times
    const start = new Date(dto.scheduledStart);
    const end = new Date(dto.scheduledEnd);
    if (end <= start) {
      throw new BadRequestException('End time must be after start time');
    }

    return await this.db.transactionAsSystem(async (client) => {
      // Generate unique Livekit room name
      const roomName = `chama-${dto.chamaId}-${Date.now()}`;

      // Create meeting
      const meetingResult = await client.query(
        `INSERT INTO meetings (
          chama_id, host_user_id, title, description, agenda_document_id,
          scheduled_start, scheduled_end, meeting_type, is_recording_enabled,
          require_approval, max_participants, livekit_room_name, settings
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          dto.chamaId,
          userId,
          dto.title,
          dto.description,
          dto.agendaDocumentId,
          dto.scheduledStart,
          dto.scheduledEnd,
          dto.meetingType || 'audio',
          dto.isRecordingEnabled || false,
          dto.requireApproval || false,
          dto.maxParticipants || 100,
          roomName,
          JSON.stringify(dto.settings || {}),
        ],
      );

      const meeting = meetingResult.rows[0];

      // Add host as participant
      await client.query(
        `INSERT INTO meeting_participants (
          meeting_id, user_id, invited_by, is_host, can_share_screen, can_unmute, status
        ) VALUES ($1, $2, $3, true, true, true, 'invited')`,
        [meeting.id, userId, userId],
      );

      // If requireApproval is false ("everyone" can join), invite all chama members
      if (!dto.requireApproval) {
        // Get all active chama members except the host
        const members = await client.query(
          `SELECT user_id FROM chama_members 
           WHERE chama_id = $1 AND user_id != $2 AND status = 'active'`,
          [dto.chamaId, userId],
        );

        // Invite all members
        for (const member of members.rows) {
          await client.query(
            `INSERT INTO meeting_participants (
              meeting_id, user_id, invited_by, can_share_screen, can_unmute, status
            ) VALUES ($1, $2, $3, true, true, 'invited')`,
            [meeting.id, member.user_id, userId],
          );
        }

        this.logger.log(
          `Auto-invited ${members.rowCount} chama members to meeting ${meeting.id}`,
        );
      }

      // Create Livekit room
      if (this.livekitClient) {
        try {
          await this.livekitClient.createRoom({
            name: roomName,
            maxParticipants: dto.maxParticipants || 100,
            emptyTimeout: 300, // 5 minutes
          });
          this.logger.log(`Created Livekit room: ${roomName}`);
        } catch (error) {
          this.logger.error(`Failed to create Livekit room: ${error.message}`);
        }
      }

      return meeting;
    });
  }

  /**
   * Get meeting details
   */
  async getMeeting(userId: string, meetingId: string) {
    const result = await this.db.query(
      `SELECT m.*, 
        u.full_name as host_name,
        u.profile_photo_url as host_avatar,
        ch.name as chama_name,
        COUNT(DISTINCT mp.id) as participant_count,
        COUNT(DISTINCT CASE WHEN mp.status = 'joined' THEN mp.id END) as joined_count
       FROM meetings m
       JOIN users u ON m.host_user_id = u.id
       JOIN chamas ch ON m.chama_id = ch.id
       LEFT JOIN meeting_participants mp ON m.id = mp.meeting_id
       WHERE m.id = $1
       GROUP BY m.id, u.id, ch.id`,
      [meetingId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException('Meeting not found');
    }

    const meeting = result.rows[0];

    // Check if user has access
    const hasAccess = await this.db.query(
      `SELECT 1 FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND status = 'active'`,
      [meeting.chama_id, userId],
    );

    if (hasAccess.rowCount === 0) {
      throw new ForbiddenException('You do not have access to this meeting');
    }

    return meeting;
  }

  /**
   * Get chama meetings
   */
  async getChamaMeetings(
    userId: string,
    chamaId: string,
    status?: MeetingStatus,
  ) {
    // Verify user is chama member
    const member = await this.db.query(
      `SELECT 1 FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND status = 'active'`,
      [chamaId, userId],
    );

    if (member.rowCount === 0) {
      throw new ForbiddenException('You are not a member of this chama');
    }

    let query = `
      SELECT m.*, 
        u.full_name as host_name,
        COUNT(DISTINCT mp.id) as participant_count
      FROM meetings m
      JOIN users u ON m.host_user_id = u.id
      LEFT JOIN meeting_participants mp ON m.id = mp.meeting_id
      WHERE m.chama_id = $1
    `;

    const params: any[] = [chamaId];

    if (status) {
      query += ` AND m.status = $${params.length + 1}`;
      params.push(status);
    }

    query += `
      GROUP BY m.id, u.id
      ORDER BY m.scheduled_start DESC
    `;

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Update meeting
   */
  async updateMeeting(
    userId: string,
    meetingId: string,
    dto: UpdateMeetingDto,
  ) {
    const meeting = await this.getMeeting(userId, meetingId);

    // Only host can update meeting
    if (meeting.host_user_id !== userId) {
      throw new ForbiddenException('Only the host can update this meeting');
    }

    // Cannot update completed or cancelled meetings
    if (['completed', 'cancelled'].includes(meeting.status)) {
      throw new BadRequestException(`Cannot update ${meeting.status} meeting`);
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (dto.title) {
      updates.push(`title = $${paramIndex++}`);
      values.push(dto.title);
    }
    if (dto.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(dto.description);
    }
    if (dto.agendaDocumentId !== undefined) {
      updates.push(`agenda_document_id = $${paramIndex++}`);
      values.push(dto.agendaDocumentId);
    }
    if (dto.scheduledStart) {
      updates.push(`scheduled_start = $${paramIndex++}`);
      values.push(dto.scheduledStart);
    }
    if (dto.scheduledEnd) {
      updates.push(`scheduled_end = $${paramIndex++}`);
      values.push(dto.scheduledEnd);
    }
    if (dto.status) {
      updates.push(`status = $${paramIndex++}`);
      values.push(dto.status);
    }
    if (dto.settings) {
      updates.push(`settings = $${paramIndex++}`);
      values.push(JSON.stringify(dto.settings));
    }

    if (updates.length === 0) {
      return meeting;
    }

    values.push(meetingId);
    const query = `UPDATE meetings SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  /**
   * Cancel meeting
   */
  async cancelMeeting(
    userId: string,
    meetingId: string,
    dto: CancelMeetingDto,
  ) {
    const meeting = await this.getMeeting(userId, meetingId);

    if (meeting.host_user_id !== userId) {
      throw new ForbiddenException('Only the host can cancel this meeting');
    }

    if (meeting.status === 'cancelled') {
      throw new BadRequestException('Meeting is already cancelled');
    }

    const result = await this.db.query(
      `UPDATE meetings 
       SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = $1, cancellation_reason = $2
       WHERE id = $3
       RETURNING *`,
      [userId, dto.reason, meetingId],
    );

    // Close Livekit room if exists
    if (this.livekitClient && meeting.livekit_room_name) {
      try {
        await this.livekitClient.deleteRoom(meeting.livekit_room_name);
      } catch (error) {
        this.logger.warn(`Failed to delete Livekit room: ${error.message}`);
      }
    }

    return result.rows[0];
  }

  /**
   * Invite participants to meeting
   */
  async inviteParticipants(
    userId: string,
    meetingId: string,
    dto: InviteParticipantsDto,
  ) {
    const meeting = await this.getMeeting(userId, meetingId);

    // Only host or chama admins can invite
    const isHost = meeting.host_user_id === userId;
    const isAdmin = await this.db.query(
      `SELECT 1 FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND role = 'admin' AND status = 'active'`,
      [meeting.chama_id, userId],
    );

    if (!isHost && isAdmin.rowCount === 0) {
      throw new ForbiddenException(
        'Only the host or chama admins can invite participants',
      );
    }

    // Verify all users are chama members
    const members = await this.db.query(
      `SELECT user_id FROM chama_members 
       WHERE chama_id = $1 AND user_id = ANY($2) AND status = 'active'`,
      [meeting.chama_id, dto.userIds],
    );

    if (members.rowCount !== dto.userIds.length) {
      throw new BadRequestException(
        'All participants must be active chama members',
      );
    }

    return await this.db.transactionAsSystem(async (client) => {
      const invited: any[] = [];

      for (const participantId of dto.userIds) {
        // Skip if already invited
        const existing = await client.query(
          `SELECT id FROM meeting_participants WHERE meeting_id = $1 AND user_id = $2`,
          [meetingId, participantId],
        );

        if (existing.rowCount > 0) {
          continue;
        }

        const result = await client.query(
          `INSERT INTO meeting_participants (meeting_id, user_id, invited_by)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [meetingId, participantId, userId],
        );

        invited.push(result.rows[0]);

        // Create reminders
        await client.query(`SELECT create_meeting_reminders($1)`, [meetingId]);
      }

      return invited;
    });
  }

  /**
   * Generate Livekit token for joining meeting
   */
  async generateJoinToken(
    userId: string,
    meetingId: string,
    dto: JoinMeetingDto,
  ) {
    const meeting = await this.getMeeting(userId, meetingId);

    // Check if user is invited OR if meeting allows everyone (requireApproval = false)
    let participant = await this.db.query(
      `SELECT * FROM meeting_participants 
       WHERE meeting_id = $1 AND user_id = $2`,
      [meetingId, userId],
    );

    // If not invited but meeting allows everyone, auto-add participant
    if (participant.rowCount === 0) {
      if (!meeting.require_approval) {
        // Verify user is a chama member
        const isMember = await this.db.query(
          `SELECT 1 FROM chama_members 
           WHERE chama_id = $1 AND user_id = $2 AND status = 'active'`,
          [meeting.chama_id, userId],
        );

        if (isMember.rowCount === 0) {
          throw new ForbiddenException(
            'You must be a chama member to join this meeting',
          );
        }

        // Auto-add as participant
        const newParticipant = await this.db.query(
          `INSERT INTO meeting_participants (
            meeting_id, user_id, invited_by, can_share_screen, can_unmute, status
          ) VALUES ($1, $2, $3, true, true, 'invited')
          RETURNING *`,
          [meetingId, userId, meeting.host_user_id],
        );

        participant = newParticipant;
        this.logger.log(
          `Auto-added user ${userId} to meeting ${meetingId} (requireApproval=false)`,
        );
      } else {
        throw new ForbiddenException('You are not invited to this meeting');
      }
    }

    // Check if meeting is joinable
    if (meeting.status === 'cancelled') {
      throw new BadRequestException('This meeting has been cancelled');
    }

    if (!this.livekitClient) {
      throw new BadRequestException('Livekit is not configured');
    }

    // Get user details
    const user = await this.db.query(
      `SELECT full_name, profile_photo_url FROM users WHERE id = $1`,
      [userId],
    );

    const displayName = dto.displayName || user.rows[0].full_name;

    // Generate Livekit access token
    const at = new AccessToken(this.livekitApiKey, this.livekitApiSecret, {
      identity: userId,
      name: displayName,
      metadata: JSON.stringify({
        userId,
        meetingId,
        chamaId: meeting.chama_id,
        avatar: user.rows[0].profile_photo_url,
      }),
    });

    at.addGrant({
      roomJoin: true,
      room: meeting.livekit_room_name,
      canPublish: participant.rows[0].can_unmute,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    // Log attendance
    await this.db.transactionAsSystem(async (client) => {
      // Update participant status
      const joinedAt = new Date();
      const isLate = await client.query(
        `SELECT check_participant_late($1, $2, $3) as is_late`,
        [participant.rows[0].id, meetingId, joinedAt],
      );

      await client.query(
        `UPDATE meeting_participants 
         SET status = 'joined', joined_at = $1, is_late = $2
         WHERE id = $3`,
        [joinedAt, isLate.rows[0].is_late, participant.rows[0].id],
      );

      // Log join event
      await client.query(
        `INSERT INTO meeting_attendance_log (meeting_id, participant_id, user_id, event_type)
         VALUES ($1, $2, $3, 'joined')`,
        [meetingId, participant.rows[0].id, userId],
      );

      // Update meeting status to in_progress if first participant
      if (meeting.status === 'scheduled') {
        await client.query(
          `UPDATE meetings SET status = 'in_progress', actual_start = NOW() WHERE id = $1`,
          [meetingId],
        );
      }
    });

    return {
      token,
      url: this.livekitUrl,
      roomName: meeting.livekit_room_name,
      meeting,
    };
  }

  /**
   * Leave meeting
   */
  async leaveMeeting(userId: string, meetingId: string) {
    const participant = await this.db.query(
      `SELECT * FROM meeting_participants 
       WHERE meeting_id = $1 AND user_id = $2`,
      [meetingId, userId],
    );

    if (participant.rowCount === 0) {
      throw new NotFoundException('Participant not found');
    }

    await this.db.transactionAsSystem(async (client) => {
      // Log leave event
      await client.query(
        `INSERT INTO meeting_attendance_log (meeting_id, participant_id, user_id, event_type)
         VALUES ($1, $2, $3, 'left')`,
        [meetingId, participant.rows[0].id, userId],
      );

      // Duration will be calculated by trigger
    });

    return { success: true };
  }

  /**
   * Get meeting participants
   */
  async getMeetingParticipants(userId: string, meetingId: string) {
    await this.getMeeting(userId, meetingId); // Check access

    const result = await this.db.query(
      `SELECT 
        mp.*,
        u.full_name,
        u.profile_photo_url,
        u.email,
        (SELECT COUNT(*) FROM meeting_attendance_log 
         WHERE participant_id = mp.id AND event_type = 'joined') as join_count
       FROM meeting_participants mp
       JOIN users u ON mp.user_id = u.id
       WHERE mp.meeting_id = $1
       ORDER BY mp.is_host DESC, mp.joined_at ASC NULLS LAST`,
      [meetingId],
    );

    return result.rows;
  }

  /**
   * Get attendance report
   */
  async getAttendanceReport(userId: string, meetingId: string) {
    const meeting = await this.getMeeting(userId, meetingId);

    // Only host or chama admins can view attendance
    const isHost = meeting.host_user_id === userId;
    const isAdmin = await this.db.query(
      `SELECT 1 FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND role IN ('admin', 'secretary') AND status = 'active'`,
      [meeting.chama_id, userId],
    );

    if (!isHost && isAdmin.rowCount === 0) {
      throw new ForbiddenException(
        'Only the host or chama admins can view attendance',
      );
    }

    const participants = await this.db.query(
      `SELECT 
        mp.*,
        u.full_name,
        u.email,
        u.phone,
        mp.duration_seconds / 60.0 as duration_minutes,
        CASE 
          WHEN mp.status = 'joined' OR mp.status = 'left' THEN 'attended'
          ELSE 'not_attended'
        END as attendance_status,
        (SELECT COUNT(*) FROM meeting_attendance_log 
         WHERE participant_id = mp.id) as event_count
       FROM meeting_participants mp
       JOIN users u ON mp.user_id = u.id
       WHERE mp.meeting_id = $1
       ORDER BY mp.joined_at ASC NULLS LAST`,
      [meetingId],
    );

    const summary = {
      total_invited: participants.rowCount,
      total_attended: participants.rows.filter((p) => p.joined_at).length,
      total_late: participants.rows.filter((p) => p.is_late).length,
      average_duration_minutes:
        participants.rows.reduce(
          (sum, p) => sum + (p.duration_minutes || 0),
          0,
        ) / participants.rowCount,
    };

    return {
      meeting,
      participants: participants.rows,
      summary,
    };
  }

  /**
   * Send chat message during meeting
   */
  async sendChatMessage(
    userId: string,
    meetingId: string,
    dto: SendChatMessageDto,
  ) {
    // Verify user is participant
    const participant = await this.db.query(
      `SELECT * FROM meeting_participants 
       WHERE meeting_id = $1 AND user_id = $2 AND status = 'joined'`,
      [meetingId, userId],
    );

    if (participant.rowCount === 0) {
      throw new ForbiddenException(
        'You must be in the meeting to send messages',
      );
    }

    const result = await this.db.query(
      `INSERT INTO meeting_chat_messages (meeting_id, user_id, content, message_type, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *,
       (SELECT full_name FROM users WHERE id = $2) as sender_name`,
      [
        meetingId,
        userId,
        dto.content,
        dto.messageType || 'text',
        JSON.stringify(dto.metadata || {}),
      ],
    );

    // Update participant message count
    if (dto.messageType === 'text') {
      await this.db.query(
        `UPDATE meeting_participants 
         SET messages_sent = messages_sent + 1
         WHERE id = $1`,
        [participant.rows[0].id],
      );
    }

    // Track hand raises
    if (dto.messageType === 'hand_raised') {
      await this.db.query(
        `UPDATE meeting_participants 
         SET hand_raised_count = hand_raised_count + 1
         WHERE id = $1`,
        [participant.rows[0].id],
      );
    }

    return result.rows[0];
  }

  /**
   * Get meeting chat messages
   */
  async getChatMessages(userId: string, meetingId: string) {
    // Verify access
    await this.getMeeting(userId, meetingId);

    const result = await this.db.query(
      `SELECT 
        mcm.*,
        u.full_name as sender_name,
        u.profile_photo_url as sender_avatar
       FROM meeting_chat_messages mcm
       JOIN users u ON mcm.user_id = u.id
       WHERE mcm.meeting_id = $1
       ORDER BY mcm.created_at ASC`,
      [meetingId],
    );

    return result.rows;
  }

  /**
   * Get meeting recordings
   */
  async getMeetingRecordings(userId: string, meetingId: string) {
    const meeting = await this.getMeeting(userId, meetingId);

    // Check if user has access to recordings
    const member = await this.db.query(
      `SELECT role FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND status = 'active'`,
      [meeting.chama_id, userId],
    );

    const result = await this.db.query(
      `SELECT * FROM meeting_recordings 
       WHERE meeting_id = $1 
         AND (is_public = true OR $2 = ANY(allowed_viewer_roles))
       ORDER BY created_at DESC`,
      [meetingId, member.rows[0]?.role || 'member'],
    );

    return result.rows;
  }

  /**
   * Update recording access
   */
  async updateRecordingAccess(
    userId: string,
    recordingId: string,
    dto: UpdateRecordingAccessDto,
  ) {
    const recording = await this.db.query(
      `SELECT r.*, m.host_user_id, m.chama_id 
       FROM meeting_recordings r
       JOIN meetings m ON r.meeting_id = m.id
       WHERE r.id = $1`,
      [recordingId],
    );

    if (recording.rowCount === 0) {
      throw new NotFoundException('Recording not found');
    }

    // Only host can update access
    if (recording.rows[0].host_user_id !== userId) {
      throw new ForbiddenException('Only the host can update recording access');
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (dto.isPublic !== undefined) {
      updates.push(`is_public = $${paramIndex++}`);
      values.push(dto.isPublic);
    }
    if (dto.allowedViewerRoles) {
      updates.push(`allowed_viewer_roles = $${paramIndex++}`);
      values.push(dto.allowedViewerRoles);
    }

    if (updates.length === 0) {
      return recording.rows[0];
    }

    values.push(recordingId);
    const query = `UPDATE meeting_recordings SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

    const result = await this.db.query(query, values);
    return result.rows[0];
  }
}
