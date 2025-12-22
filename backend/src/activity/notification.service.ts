/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export enum NotificationChannel {
  PUSH = 'push',
  EMAIL = 'email',
  SMS = 'sms',
  IN_APP = 'in_app',
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

interface QueueNotificationParams {
  userId: string;
  chamaId?: string;
  channel: NotificationChannel;
  priority: NotificationPriority;
  title: string;
  message: string;
  activityLogId?: string;
  metadata?: Record<string, any>;
  scheduledFor?: Date;
}

interface GetNotificationsParams {
  userId: string;
  status?: string;
  channel?: NotificationChannel;
  limit?: number;
  offset?: number;
}

@Injectable()
export class NotificationService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Queue a notification for sending
   */
  async queueNotification(
    params: QueueNotificationParams,
  ): Promise<string | null> {
    const {
      userId,
      chamaId,
      channel,
      priority,
      title,
      message,
      activityLogId,
      metadata = {},
      scheduledFor,
    } = params;

    await this.db.setSystemContext();

    try {
      const result = await this.db.query(
        `SELECT queue_notification(
          $1::uuid, $2::uuid, $3::notification_channel, $4::notification_priority,
          $5, $6, $7::uuid, $8::jsonb, $9
        ) as notification_id`,
        [
          userId,
          chamaId || null,
          channel,
          priority,
          title,
          message,
          activityLogId || null,
          JSON.stringify(metadata),
          scheduledFor || new Date(),
        ],
      );

      return result.rows[0].notification_id;
    } finally {
      await this.db.clearContext();
    }
  }

  /**
   * Queue notifications for multiple users (bulk)
   */
  async queueBulkNotifications(
    userIds: string[],
    params: Omit<QueueNotificationParams, 'userId'>,
  ): Promise<string[]> {
    const notificationIds: string[] = [];

    for (const userId of userIds) {
      const notificationId = await this.queueNotification({
        ...params,
        userId,
      });
      if (notificationId) {
        notificationIds.push(notificationId);
      }
    }

    return notificationIds;
  }

  /**
   * Notify all chama members about an activity
   */
  async notifyChamaMembers(
    chamaId: string,
    params: Omit<QueueNotificationParams, 'userId' | 'chamaId'>,
    excludeUserId?: string,
  ): Promise<string[]> {
    // Get all active chama members
    const membersResult = await this.db.query(
      `
      SELECT user_id 
      FROM chama_members 
      WHERE chama_id = $1 AND status = 'active'
      ${excludeUserId ? 'AND user_id != $2' : ''}
      `,
      excludeUserId ? [chamaId, excludeUserId] : [chamaId],
    );

    const userIds = membersResult.rows.map((row) => row.user_id);

    return this.queueBulkNotifications(userIds, {
      ...params,
      chamaId,
    });
  }

  /**
   * Get pending notifications ready to be sent
   */
  async getPendingNotifications(limit = 100) {
    await this.db.setSystemContext();

    try {
      const result = await this.db.query(
        `
        SELECT 
          nq.*,
          u.email,
          u.phone,
          u.full_name
        FROM notification_queue nq
        JOIN users u ON nq.user_id = u.id
        WHERE nq.status = 'pending'
          AND nq.scheduled_for <= NOW()
          AND nq.retry_count < nq.max_retries
        ORDER BY nq.priority DESC, nq.scheduled_for ASC
        LIMIT $1
        `,
        [limit],
      );

      return result.rows;
    } finally {
      await this.db.clearContext();
    }
  }

  /**
   * Mark notification as sent
   */
  async markAsSent(notificationId: string): Promise<void> {
    await this.db.setSystemContext();

    try {
      await this.db.query(
        `
        UPDATE notification_queue
        SET status = 'sent', sent_at = NOW()
        WHERE id = $1
        `,
        [notificationId],
      );
    } finally {
      await this.db.clearContext();
    }
  }

  /**
   * Mark notification as failed
   */
  async markAsFailed(
    notificationId: string,
    errorMessage: string,
  ): Promise<void> {
    await this.db.setSystemContext();

    try {
      await this.db.query(
        `
        UPDATE notification_queue
        SET 
          status = CASE 
            WHEN retry_count + 1 >= max_retries THEN 'failed'
            ELSE 'pending'
          END,
          retry_count = retry_count + 1,
          failed_at = NOW(),
          error_message = $2,
          scheduled_for = CASE 
            WHEN retry_count + 1 < max_retries THEN NOW() + INTERVAL '5 minutes'
            ELSE scheduled_for
          END
        WHERE id = $1
        `,
        [notificationId, errorMessage],
      );
    } finally {
      await this.db.clearContext();
    }
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(params: GetNotificationsParams) {
    const { userId, status, channel, limit = 50, offset = 0 } = params;

    let query = `
      SELECT 
        nq.*,
        al.title as activity_title,
        al.category as activity_category
      FROM notification_queue nq
      LEFT JOIN activity_logs al ON nq.activity_log_id = al.id
      WHERE nq.user_id = $1
    `;
    const queryParams: any[] = [userId];
    let paramIndex = 2;

    if (status) {
      query += ` AND nq.status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    if (channel) {
      query += ` AND nq.channel = $${paramIndex}::notification_channel`;
      queryParams.push(channel);
      paramIndex++;
    }

    query += ` ORDER BY nq.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const result = await this.db.query(query, queryParams);
    return result.rows;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.db.setUserContext(userId);

    try {
      await this.db.query(
        `UPDATE notification_queue 
         SET status = 'read', read_at = NOW() 
         WHERE id = $1 AND user_id = $2 AND status = 'pending'`,
        [notificationId, userId],
      );
    } finally {
      await this.db.clearContext();
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string, chamaId?: string): Promise<void> {
    await this.db.setUserContext(userId);

    try {
      let query = `UPDATE notification_queue 
                   SET status = 'read', read_at = NOW() 
                   WHERE user_id = $1 AND status = 'pending'`;
      const params = [userId];

      if (chamaId) {
        query += ' AND chama_id = $2';
        params.push(chamaId);
      }

      await this.db.query(query, params);
    } finally {
      await this.db.clearContext();
    }
  }

  /**
   * Create a test notification (for development/testing)
   */
  async createTestNotification(userId: string): Promise<string | null> {
    return this.queueNotification({
      userId,
      channel: NotificationChannel.IN_APP,
      priority: NotificationPriority.MEDIUM,
      title: 'Test Notification',
      message: 'This is a test notification to verify the system is working.',
      metadata: { test: true, timestamp: new Date().toISOString() },
    });
  }

  /**
   * Get or create notification preferences for user/chama
   */
  async getNotificationPreferences(userId: string, chamaId?: string) {
    const result = await this.db.query(
      `
      SELECT *
      FROM notification_preferences
      WHERE user_id = $1 AND (chama_id = $2 OR ($2 IS NULL AND chama_id IS NULL))
      ORDER BY chama_id DESC NULLS LAST
      LIMIT 1
      `,
      [userId, chamaId || null],
    );

    if (result.rows.length > 0) {
      return result.rows[0];
    }

    // Create default preferences if not exists
    const insertResult = await this.db.query(
      `
      INSERT INTO notification_preferences (user_id, chama_id)
      VALUES ($1, $2)
      RETURNING *
      `,
      [userId, chamaId || null],
    );

    return insertResult.rows[0];
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(
    userId: string,
    chamaId: string | null,
    preferences: {
      pushEnabled?: boolean;
      emailEnabled?: boolean;
      smsEnabled?: boolean;
      activityPreferences?: Record<string, any>;
      dailyDigest?: boolean;
      weeklyDigest?: boolean;
      digestTime?: string;
    },
  ) {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (preferences.pushEnabled !== undefined) {
      fields.push(`push_enabled = $${paramIndex}`);
      values.push(preferences.pushEnabled);
      paramIndex++;
    }

    if (preferences.emailEnabled !== undefined) {
      fields.push(`email_enabled = $${paramIndex}`);
      values.push(preferences.emailEnabled);
      paramIndex++;
    }

    if (preferences.smsEnabled !== undefined) {
      fields.push(`sms_enabled = $${paramIndex}`);
      values.push(preferences.smsEnabled);
      paramIndex++;
    }

    if (preferences.activityPreferences) {
      fields.push(`activity_preferences = $${paramIndex}::jsonb`);
      values.push(JSON.stringify(preferences.activityPreferences));
      paramIndex++;
    }

    if (preferences.dailyDigest !== undefined) {
      fields.push(`daily_digest = $${paramIndex}`);
      values.push(preferences.dailyDigest);
      paramIndex++;
    }

    if (preferences.weeklyDigest !== undefined) {
      fields.push(`weekly_digest = $${paramIndex}`);
      values.push(preferences.weeklyDigest);
      paramIndex++;
    }

    if (preferences.digestTime) {
      fields.push(`digest_time = $${paramIndex}::time`);
      values.push(preferences.digestTime);
      paramIndex++;
    }

    if (fields.length === 0) {
      return this.getNotificationPreferences(userId, chamaId ?? undefined);
    }

    values.push(userId, chamaId);

    const result = await this.db.query(
      `
      UPDATE notification_preferences
      SET ${fields.join(', ')}
      WHERE user_id = $${paramIndex} AND (chama_id = $${paramIndex + 1} OR ($${paramIndex + 1} IS NULL AND chama_id IS NULL))
      RETURNING *
      `,
      values,
    );

    if (result.rows.length === 0) {
      // Preferences don't exist, create them
      return this.getNotificationPreferences(userId, chamaId ?? undefined);
    }

    return result.rows[0];
  }

  /**
   * Process notification based on channel (stub for actual sending)
   */
  async processNotification(notification: any): Promise<boolean> {
    try {
      switch (notification.channel) {
        case NotificationChannel.PUSH:
          await this.sendPushNotification(notification);
          break;
        case NotificationChannel.EMAIL:
          await this.sendEmailNotification(notification);
          break;
        case NotificationChannel.SMS:
          await this.sendSmsNotification(notification);
          break;
        case NotificationChannel.IN_APP:
          // In-app notifications are handled by querying the table
          break;
      }

      await this.markAsSent(notification.id);
      return true;
    } catch (error) {
      await this.markAsFailed(
        notification.id,
        error.message || 'Unknown error',
      );
      return false;
    }
  }

  /**
   * Send push notification (stub - integrate with FCM/APNS)
   */
  private async sendPushNotification(notification: any): Promise<void> {
    // TODO: Integrate with Firebase Cloud Messaging or Apple Push Notification Service
    console.log('Sending push notification:', notification.title);
  }

  /**
   * Send email notification (stub - integrate with email service)
   */
  private async sendEmailNotification(notification: any): Promise<void> {
    // TODO: Integrate with email service (already have EmailService in auth module)
    console.log('Sending email notification:', notification.title);
  }

  /**
   * Send SMS notification (stub - integrate with Africa's Talking)
   */
  private async sendSmsNotification(notification: any): Promise<void> {
    // TODO: Integrate with Africa's Talking SMS API
    console.log('Sending SMS notification:', notification.title);
  }
}
