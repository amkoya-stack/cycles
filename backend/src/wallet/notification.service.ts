/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import axios from 'axios';

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

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    this.initializeEmailTransporter();
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
   * Send generic email (for reminders, notifications, etc.)
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

    try {
      const mailOptions = {
        from: this.config.get<string>('SMTP_FROM') || 'noreply@cycle.app',
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent to ${options.to}`);
    } catch (error: any) {
      this.logger.error(`Failed to send email: ${error.message}`, error.stack);
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

    try {
      await this.transporter.sendMail({
        from:
          this.config.get<string>('SMTP_FROM') ||
          '"Cycle Platform" <noreply@cycle.co.ke>',
        to: receipt.to,
        subject: receipt.subject,
        html: htmlContent,
      });

      this.logger.log(`Email receipt sent to ${receipt.to}`);
    } catch (error) {
      this.logger.error(
        `Failed to send email receipt: ${error.message}`,
        error.stack,
      );
    }
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
