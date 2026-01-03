/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import axios from 'axios';
import * as webPush from 'web-push';
import { DatabaseService } from '../database/database.service';

export interface EmailReceipt {
  to: string;
  subject: string;
  transactionRef: string;
  amount: number;
  type: 'deposit' | 'withdrawal' | 'transfer' | 'contribution' | 'payout';
  status: 'completed' | 'failed';
  timestamp: Date;
  recipientName?: string;
  chamaName?: string; // For contributions and payouts
}

export interface SMSReceipt {
  phoneNumber: string;
  message: string;
}

export interface PushNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, any>;
  requireInteraction?: boolean;
  tag?: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private transporter: nodemailer.Transporter | null = null;
  private vapidKeys: { publicKey: string; privateKey: string } | null = null;
  private lastEmailSentAt = 0;
  private readonly minEmailInterval = 1000; // Minimum 1 second between emails to prevent rate limiting

  constructor(
    private readonly config: ConfigService,
    private readonly db: DatabaseService,
  ) {
    this.initializeEmailTransporter();
    this.initializePushNotifications();
  }

  /**
   * Initialize email transporter
   */
  private initializeEmailTransporter() {
    const smtpHost = this.config.get<string>('SMTP_HOST');
    const smtpPort = this.config.get<number>('SMTP_PORT');
    const smtpUser = this.config.get<string>('SMTP_USER');
    const smtpPass = this.config.get<string>('SMTP_PASS');

    if (!smtpHost || !smtpUser || !smtpPass) {
      this.logger.warn(
        'SMTP credentials not configured. Email notifications disabled.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort || 587,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    this.logger.log('Email transporter initialized');
  }

  /**
   * Initialize Web Push notifications with VAPID keys
   */
  private initializePushNotifications() {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.config.get<string>('VAPID_SUBJECT') || 'mailto:admin@cycle.app';

    if (!publicKey || !privateKey) {
      this.logger.warn(
        'VAPID keys not configured. Push notifications disabled.',
      );
      return;
    }

    this.vapidKeys = { publicKey, privateKey };
    webPush.setVapidDetails(subject, publicKey, privateKey);
    this.logger.log('Web Push notifications initialized');
  }

  /**
   * Get VAPID public key for client-side subscription
   */
  getVapidPublicKey(): string | null {
    return this.vapidKeys?.publicKey || null;
  }

  /**
   * Register a push notification token for a user
   */
  async registerPushToken(
    userId: string,
    token: string,
    platform: 'web' | 'android' | 'ios' = 'web',
    deviceId?: string,
    deviceName?: string,
    appVersion?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      // Check if token already exists
      const existing = await this.db.query(
        'SELECT id FROM push_notification_tokens WHERE user_id = $1 AND token = $2',
        [userId, token],
      );

      if (existing.rows.length > 0) {
        // Update existing token
        await this.db.query(
          `UPDATE push_notification_tokens 
           SET is_active = true, 
               last_used_at = NOW(),
               platform = $3,
               device_id = $4,
               device_name = $5,
               app_version = $6,
               user_agent = $7,
               updated_at = NOW()
           WHERE user_id = $1 AND token = $2`,
          [userId, token, platform, deviceId, deviceName, appVersion, userAgent],
        );
        this.logger.log(`Updated push token for user ${userId}`);
      } else {
        // Insert new token
        await this.db.query(
          `INSERT INTO push_notification_tokens 
           (user_id, token, platform, device_id, device_name, app_version, user_agent, is_active, last_used_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())`,
          [userId, token, platform, deviceId, deviceName, appVersion, userAgent],
        );
        this.logger.log(`Registered new push token for user ${userId}`);
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to register push token: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Unregister a push notification token
   */
  async unregisterPushToken(userId: string, token: string): Promise<void> {
    try {
      await this.db.query(
        'UPDATE push_notification_tokens SET is_active = false, updated_at = NOW() WHERE user_id = $1 AND token = $2',
        [userId, token],
      );
      this.logger.log(`Unregistered push token for user ${userId}`);
    } catch (error: any) {
      this.logger.error(
        `Failed to unregister push token: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get all active push tokens for a user
   */
  async getUserPushTokens(userId: string): Promise<any[]> {
    try {
      const result = await this.db.query(
        'SELECT * FROM push_notification_tokens WHERE user_id = $1 AND is_active = true',
        [userId],
      );
      return result.rows;
    } catch (error: any) {
      this.logger.error(
        `Failed to get push tokens: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Send push notification to a user
   */
  async sendPushNotification(
    userId: string,
    options: PushNotificationOptions,
  ): Promise<void> {
    if (!this.vapidKeys) {
      this.logger.warn('Push notifications not configured. Skipping.');
      return;
    }

    try {
      // Get all active tokens for the user
      const tokens = await this.getUserPushTokens(userId);

      if (tokens.length === 0) {
        this.logger.debug(`No push tokens found for user ${userId}`);
        return;
      }

      const payload = JSON.stringify({
        title: options.title,
        body: options.body,
        icon: options.icon || '/icon-192x192.png',
        badge: options.badge || '/badge-72x72.png',
        data: options.data || {},
        tag: options.tag,
        requireInteraction: options.requireInteraction || false,
      });

      // Send to all user's devices
      const sendPromises = tokens.map(async (tokenRow) => {
        try {
          // Parse the subscription object from the stored token
          const subscription = typeof tokenRow.token === 'string' 
            ? JSON.parse(tokenRow.token) 
            : tokenRow.token;
            
          await webPush.sendNotification(subscription, payload);
          // Update last_used_at
          await this.db.query(
            'UPDATE push_notification_tokens SET last_used_at = NOW() WHERE id = $1',
            [tokenRow.id],
          );
          return { success: true, tokenId: tokenRow.id };
        } catch (error: any) {
          // If token is invalid, mark it as inactive
          if (error.statusCode === 410 || error.statusCode === 404) {
            this.logger.warn(
              `Invalid push token ${tokenRow.id}, marking as inactive`,
            );
            await this.db.query(
              'UPDATE push_notification_tokens SET is_active = false WHERE id = $1',
              [tokenRow.id],
            );
          } else {
            this.logger.error(
              `Failed to send push to token ${tokenRow.id}: ${error.message}`,
            );
          }
          return { success: false, tokenId: tokenRow.id, error: error.message };
        }
      });

      const results = await Promise.allSettled(sendPromises);
      const successCount = results.filter(
        (r) => r.status === 'fulfilled' && r.value.success,
      ).length;

      this.logger.log(
        `Sent push notification to ${successCount}/${tokens.length} devices for user ${userId}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to send push notification: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Send generic email (for reminders, notifications, etc.)
   * Includes retry logic for rate limits
   */
  async sendEmail(options: {
    to: string;
    subject: string;
    html?: string;
    text?: string;
  }): Promise<void> {
    if (!this.transporter) {
      this.logger.warn('Email transporter not initialized. Skipping email.');
      return;
    }

    // Rate limit: ensure minimum interval between emails
    const now = Date.now();
    const timeSinceLastEmail = now - this.lastEmailSentAt;
    if (timeSinceLastEmail < this.minEmailInterval) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.minEmailInterval - timeSinceLastEmail),
      );
    }

    const maxRetries = 3;
    let retryCount = 0;
    let lastError: any;

    while (retryCount < maxRetries) {
      try {
        const mailOptions = {
          from: this.config.get<string>('SMTP_FROM') || 'noreply@cycle.app',
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        };

        await this.transporter.sendMail(mailOptions);
        this.lastEmailSentAt = Date.now();
        this.logger.log(`Email sent to ${options.to}`);
        return;
      } catch (error: any) {
        lastError = error;
        const errorMessage = error.message || '';
        const isRateLimit = errorMessage.includes('429') || errorMessage.includes('Rate limited') || errorMessage.includes('rate limit');

        if (isRateLimit && retryCount < maxRetries - 1) {
          // Exponential backoff: wait 2^retryCount seconds
          const waitTime = Math.pow(2, retryCount) * 1000;
          this.logger.warn(
            `Email rate limited. Retrying in ${waitTime / 1000}s (attempt ${retryCount + 1}/${maxRetries})`,
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          retryCount++;
        } else {
          // Not a rate limit error, or max retries reached
          if (isRateLimit) {
            this.logger.error(
              `Failed to send email after ${maxRetries} attempts due to rate limiting. Consider reducing email frequency.`,
            );
          } else {
            this.logger.error(`Failed to send email: ${error.message}`, error.stack);
          }
          break;
        }
      }
    }

    // If we get here, all retries failed
    if (lastError) {
      this.logger.error(
        `Email sending failed permanently for ${options.to}: ${lastError.message}`,
      );
    }
  }

  /**
   * Send transaction receipt via email
   */
  async sendEmailReceipt(receipt: EmailReceipt): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        'Email transporter not initialized. Skipping email receipt.',
      );
      return;
    }

    const statusEmoji = receipt.status === 'completed' ? '✅' : '❌';
    const typeLabel =
      receipt.type.charAt(0).toUpperCase() + receipt.type.slice(1);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #083232; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .receipt-item { padding: 10px 0; border-bottom: 1px solid #ddd; }
          .receipt-item strong { display: inline-block; width: 150px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .status-completed { color: #28a745; }
          .status-failed { color: #dc3545; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Cycle Platform</h1>
            <h2>Transaction Receipt</h2>
          </div>
          <div class="content">
            <p>Dear member,</p>
            <p>Your transaction has been processed ${statusEmoji}</p>
            
            <div class="receipt-item">
              <strong>Transaction Type:</strong> ${typeLabel}
            </div>
            <div class="receipt-item">
              <strong>Reference:</strong> ${receipt.transactionRef}
            </div>
            <div class="receipt-item">
              <strong>Amount:</strong> KES ${receipt.amount.toFixed(2)}
            </div>
            <div class="receipt-item">
              <strong>Status:</strong> <span class="status-${receipt.status}">${receipt.status.toUpperCase()}</span>
            </div>
            <div class="receipt-item">
              <strong>Date & Time:</strong> ${receipt.timestamp.toLocaleString()}
            </div>
            ${
              receipt.recipientName
                ? `
            <div class="receipt-item">
              <strong>Recipient:</strong> ${receipt.recipientName}
            </div>
            `
                : ''
            }
            ${
              receipt.chamaName
                ? `
            <div class="receipt-item">
              <strong>Chama:</strong> ${receipt.chamaName}
            </div>
            `
                : ''
            }
          </div>
          <div class="footer">
            <p>Thank you for using Cycle Platform</p>
            <p>This is an automated message. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Use the improved sendEmail method which handles rate limits
    await this.sendEmail({
      to: receipt.to,
      subject: receipt.subject,
      html: htmlContent,
    });
  }

  /**
   * Send transaction receipt via SMS (Africa's Talking)
   */
  async sendSMSReceipt(receipt: SMSReceipt): Promise<void> {
    const apiKey = this.config.get<string>('AT_API_KEY');
    const username = this.config.get<string>('AT_USERNAME');
    const senderId = this.config.get<string>('AT_SENDER_ID') || 'Cycle';

    if (!apiKey || !username) {
      this.logger.warn(
        "Africa's Talking credentials not configured. SMS disabled.",
      );
      return;
    }

    try {
      const response = await axios.post(
        'https://api.africastalking.com/version1/messaging',
        new URLSearchParams({
          username,
          to: receipt.phoneNumber,
          message: receipt.message,
          from: senderId,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            apiKey: apiKey,
            Accept: 'application/json',
          },
        },
      );

      this.logger.log(`SMS receipt sent to ${receipt.phoneNumber}`);
    } catch (error) {
      // SMS is non-critical, log as warning only
      this.logger.warn(
        `SMS disabled: ${error.response?.status === 401 ? 'Invalid credentials' : error.message}`,
      );
    }
  }

  /**
   * Send deposit receipt
   */
  async sendDepositReceipt(
    email: string,
    phoneNumber: string,
    amount: number,
    reference: string,
    mpesaReceipt?: string,
  ): Promise<void> {
    // Email receipt
    await this.sendEmailReceipt({
      to: email,
      subject: 'Deposit Receipt - Cycle Platform',
      transactionRef: reference,
      amount,
      type: 'deposit',
      status: 'completed',
      timestamp: new Date(),
    });

    // SMS receipt
    const smsMessage = `Deposit of KES ${amount.toFixed(2)} received. ${mpesaReceipt ? `M-Pesa Ref: ${mpesaReceipt}. ` : ''}New balance available in your Cycle wallet. Ref: ${reference}`;

    await this.sendSMSReceipt({
      phoneNumber,
      message: smsMessage,
    });
  }

  /**
   * Send withdrawal receipt
   */
  async sendWithdrawalReceipt(
    email: string,
    phoneNumber: string,
    amount: number,
    reference: string,
    mpesaReceipt?: string,
  ): Promise<void> {
    await this.sendEmailReceipt({
      to: email,
      subject: 'Withdrawal Receipt - Cycle Platform',
      transactionRef: reference,
      amount,
      type: 'withdrawal',
      status: 'completed',
      timestamp: new Date(),
    });

    const smsMessage = `Withdrawal of KES ${amount.toFixed(2)} processed. ${mpesaReceipt ? `M-Pesa Ref: ${mpesaReceipt}. ` : ''}Ref: ${reference}`;

    await this.sendSMSReceipt({
      phoneNumber,
      message: smsMessage,
    });
  }

  /**
   * Send transfer receipt
   */
  async sendTransferReceipt(
    senderEmail: string,
    senderPhone: string,
    recipientName: string,
    amount: number,
    reference: string,
  ): Promise<void> {
    await this.sendEmailReceipt({
      to: senderEmail,
      subject: 'Transfer Receipt - Cycle Platform',
      transactionRef: reference,
      amount,
      type: 'transfer',
      status: 'completed',
      timestamp: new Date(),
      recipientName,
    });

    const smsMessage = `Transfer of KES ${amount.toFixed(2)} to ${recipientName} completed. Ref: ${reference}`;

    await this.sendSMSReceipt({
      phoneNumber: senderPhone,
      message: smsMessage,
    });
  }

  /**
   * Send contribution receipt
   */
  async sendContributionReceipt(
    email: string,
    phoneNumber: string,
    amount: number,
    reference: string,
    chamaName: string,
    feeAmount?: number,
  ): Promise<void> {
    await this.sendEmailReceipt({
      to: email,
      subject: 'Contribution Receipt - Cycle Platform',
      transactionRef: reference,
      amount,
      type: 'contribution',
      status: 'completed',
      timestamp: new Date(),
      chamaName,
    });

    const feeText = feeAmount ? ` Fee: KES ${feeAmount.toFixed(2)}.` : '';
    const smsMessage = `Contribution of KES ${amount.toFixed(2)} to ${chamaName} received.${feeText} Ref: ${reference}`;

    await this.sendSMSReceipt({
      phoneNumber,
      message: smsMessage,
    });
  }

  /**
   * Send payout receipt
   */
  async sendPayoutReceipt(
    email: string,
    phoneNumber: string,
    amount: number,
    reference: string,
    chamaName: string,
  ): Promise<void> {
    await this.sendEmailReceipt({
      to: email,
      subject: 'Payout Receipt - Cycle Platform',
      transactionRef: reference,
      amount,
      type: 'payout',
      status: 'completed',
      timestamp: new Date(),
      chamaName,
    });

    const smsMessage = `Payout of KES ${amount.toFixed(2)} from ${chamaName} received. Ref: ${reference}`;

    await this.sendSMSReceipt({
      phoneNumber,
      message: smsMessage,
    });
  }
}
