import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface SendMessageDto {
  recipientId: string;
  chamaId: string;
  content: string;
  messageType?: 'text' | 'image' | 'file';
}

export interface GetConversationsDto {
  chamaId?: string; // Optional filter by specific chama
}

export interface GetMessagesDto {
  conversationId: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class ChatService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Send a message between two chama members
   */
  async sendMessage(senderId: string, dto: SendMessageDto) {
    try {
      console.log('sendMessage called with:', { senderId, dto });

      // Verify both users are members of the chama
      const membershipCheck = await this.db.query(
        `SELECT user_id FROM chama_members 
         WHERE chama_id = $1 AND user_id = ANY($2) AND status = 'active'`,
        [dto.chamaId, [senderId, dto.recipientId]],
      );

      console.log('Membership check result:', {
        rowCount: membershipCheck.rowCount,
        rows: membershipCheck.rows,
      });

      if (membershipCheck.rowCount !== 2) {
        console.error('Membership validation failed');
        throw new BadRequestException(
          'Both users must be active members of the chama to chat',
        );
      }

      // Check if both sender and recipient have chat enabled
      // First check if the column exists (for backward compatibility)
      try {
        const columnCheck = await this.db.query(
          `SELECT column_name 
           FROM information_schema.columns 
           WHERE table_name = 'notification_preferences' 
           AND column_name = 'chat_enabled'`
        );
        
        if (columnCheck.rows.length > 0) {
          // Column exists, check both sender and recipient settings
          const chatSettingsCheck = await this.db.query(
            `SELECT 
              user_id,
              COALESCE(chat_enabled, true) as chat_enabled
             FROM notification_preferences
             WHERE user_id = ANY($1) AND chama_id = $2`,
            [[senderId, dto.recipientId], dto.chamaId],
          );

          // Check sender's chat setting
          const senderSettings = chatSettingsCheck.rows.find(
            (row) => row.user_id === senderId,
          );
          if (
            senderSettings &&
            senderSettings.chat_enabled === false
          ) {
            throw new BadRequestException(
              'You have disabled chat messages. Please enable chat in Cycle Settings to send messages.',
            );
          }

          // Check recipient's chat setting
          const recipientSettings = chatSettingsCheck.rows.find(
            (row) => row.user_id === dto.recipientId,
          );
          if (
            recipientSettings &&
            recipientSettings.chat_enabled === false
          ) {
            throw new BadRequestException(
              'This member has disabled chat messages from other members',
            );
          }
        }
      } catch (error: any) {
        // If it's our BadRequestException, re-throw it
        if (error instanceof BadRequestException) {
          throw error;
        }
        // Otherwise, log and continue (column might not exist yet)
        console.warn('Could not check chat settings:', error.message);
      }

      // Get or create conversation
      console.log('Getting/creating conversation...');
      const conversationResult = await this.db.query(
        'SELECT get_or_create_conversation($1, $2, $3) as conversation_id',
        [dto.chamaId, senderId, dto.recipientId],
      );

      console.log('Conversation result:', conversationResult.rows);
      const conversationId = conversationResult.rows[0].conversation_id;

      // Insert message
      console.log('Inserting message...');
      const messageResult = await this.db.query(
        `INSERT INTO messages (conversation_id, sender_id, content, message_type)
         VALUES ($1, $2, $3, $4)
         RETURNING *, 
         true as is_sent_by_me,
         (SELECT full_name FROM users WHERE id = $2) as sender_name,
         (SELECT profile_photo_url FROM users WHERE id = $2) as sender_avatar`,
        [conversationId, senderId, dto.content, dto.messageType || 'text'],
      );

      console.log('Message inserted successfully');
      return {
        message: messageResult.rows[0],
        conversationId,
      };
    } catch (error) {
      console.error('Error in sendMessage:', error);
      throw error;
    }
  }

  /**
   * Get user's conversations (chat list)
   */
  async getConversations(userId: string, dto?: GetConversationsDto) {
    try {
      let whereClause = `WHERE (c.participant_1_id = $1 OR c.participant_2_id = $1)`;
      const params: any[] = [userId];

      if (dto?.chamaId) {
        whereClause += ` AND c.chama_id = $2`;
        params.push(dto.chamaId);
      }

      const result = await this.db.query(
        `SELECT 
         c.id as conversation_id,
         c.chama_id,
         ch.name as chama_name,
         CASE 
           WHEN c.participant_1_id = $1 THEN u2.id 
           ELSE u1.id 
         END as other_user_id,
         CASE 
           WHEN c.participant_1_id = $1 THEN u2.full_name
           ELSE u1.full_name
         END as other_user_name,
         CASE 
           WHEN c.participant_1_id = $1 THEN u2.profile_photo_url
           ELSE u1.profile_photo_url
         END as other_user_avatar,
         m.content as last_message,
         m.created_at as last_message_at,
         m.sender_id = $1 as is_sent_by_me,
         COUNT(unread.id) as unread_count,
         c.updated_at
       FROM conversations c
       JOIN users u1 ON c.participant_1_id = u1.id
       JOIN users u2 ON c.participant_2_id = u2.id
       JOIN chamas ch ON c.chama_id = ch.id
       LEFT JOIN LATERAL (
         SELECT content, created_at, sender_id 
         FROM messages 
         WHERE conversation_id = c.id 
         ORDER BY created_at DESC 
         LIMIT 1
       ) m ON true
       LEFT JOIN messages unread ON unread.conversation_id = c.id 
         AND unread.sender_id != $1 
         AND unread.is_read = false
       ${whereClause}
       GROUP BY c.id, u1.id, u2.id, ch.id, m.content, m.created_at, m.sender_id
       ORDER BY c.updated_at DESC`,
        params,
      );

      return result.rows;
    } catch (error) {
      console.error('Error in getConversations:', error);
      throw error;
    }
  }

  /**
   * Get messages in a conversation
   */
  async getMessages(userId: string, dto: GetMessagesDto) {
    const limit = dto.limit || 50;
    const offset = dto.offset || 0;

    // Verify user is participant in conversation
    const participantCheck = await this.db.query(
      'SELECT id FROM conversations WHERE id = $1 AND (participant_1_id = $2 OR participant_2_id = $2)',
      [dto.conversationId, userId],
    );

    if (participantCheck.rowCount === 0) {
      throw new NotFoundException('Conversation not found or access denied');
    }

    const result = await this.db.query(
      `SELECT 
         m.id,
         m.content,
         m.message_type,
         m.sender_id,
         u.full_name as sender_name,
         u.profile_photo_url as sender_avatar,
         m.is_read,
         m.created_at,
         m.sender_id = $1 as is_sent_by_me
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = $2
       ORDER BY m.created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, dto.conversationId, limit, offset],
    );

    // Mark messages as read
    await this.db.query(
      'UPDATE messages SET is_read = true WHERE conversation_id = $1 AND sender_id != $2 AND is_read = false',
      [dto.conversationId, userId],
    );

    // Return messages in ascending order (oldest first)
    return result.rows.reverse();
  }

  /**
   * Get chama members available for chat (excluding current user)
   */
  async getChamaMembers(userId: string, chamaId: string) {
    const result = await this.db.query(
      `SELECT 
         u.id,
         u.full_name,
         u.profile_photo_url as profile_picture,
         cm.role,
         cm.status
       FROM chama_members cm
       JOIN users u ON cm.user_id = u.id
       WHERE cm.chama_id = $1 AND cm.user_id != $2 AND cm.status = 'active'
       ORDER BY u.full_name`,
      [chamaId, userId],
    );

    return result.rows;
  }

  /**
   * Get unread message count for user
   */
  async getUnreadCount(userId: string, chamaId?: string) {
    let query = `
      SELECT COUNT(*) as unread_count
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE m.sender_id != $1 AND m.is_read = false
        AND (c.participant_1_id = $1 OR c.participant_2_id = $1)
    `;
    const params = [userId];

    if (chamaId) {
      query += ` AND c.chama_id = $2`;
      params.push(chamaId);
    }

    const result = await this.db.query(query, params);
    return parseInt(result.rows[0].unread_count);
  }
}
