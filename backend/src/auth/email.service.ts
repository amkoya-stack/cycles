/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';

export interface OtpEmailData {
  email: string;
  code: string;
  purpose:
    | 'email_verification'
    | 'phone_verification'
    | 'password_reset'
    | 'two_factor';
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private resend: Resend | null = null;
  private useResend = false;
  private initialized = false;

  constructor(private readonly config: ConfigService) {}

  /**
   * Initialize email transporter (lazy initialization)
   * Uses Resend in production, Ethereal Mail for development
   */
  private async initializeTransporter() {
    if (this.initialized) return;

    const resendApiKey = this.config.get<string>('RESEND_API_KEY');
    const nodeEnv = this.config.get<string>('NODE_ENV');

    // Use Resend if API key is available (preferred for production)
    if (resendApiKey) {
      this.resend = new Resend(resendApiKey);
      this.useResend = true;
      this.logger.log('✅ Resend email service initialized');
      this.initialized = true;
      return;
    }

    const smtpHost =
      this.config.get<string>('EMAIL_HOST') ||
      this.config.get<string>('SMTP_HOST');
    const smtpPort =
      this.config.get<number>('EMAIL_PORT') ||
      this.config.get<number>('SMTP_PORT');
    const smtpUser =
      this.config.get<string>('EMAIL_USER') ||
      this.config.get<string>('SMTP_USER');
    const smtpPass =
      this.config.get<string>('EMAIL_PASSWORD') ||
      this.config.get<string>('SMTP_PASS');

    // If production and no email config, fail
    if (
      nodeEnv === 'production' &&
      !resendApiKey &&
      (!smtpHost || !smtpUser || !smtpPass)
    ) {
      this.logger.error(
        'Email credentials required for production. Email service disabled.',
      );
      this.initialized = true;
      return;
    }

    // If development and no SMTP config, use Ethereal Mail
    if (!smtpHost || !smtpUser || !smtpPass) {
      this.logger.log('Creating Ethereal Mail test account...');
      try {
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: testAccount.smtp.host,
          port: testAccount.smtp.port,
          secure: testAccount.smtp.secure,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
          tls: {
            rejectUnauthorized: false,
          },
        });
        this.logger.log(`✅ Ethereal Mail initialized: ${testAccount.user}`);
        this.logger.log(`📧 View emails at: https://ethereal.email/messages`);
        this.initialized = true;
        return;
      } catch (error) {
        this.logger.error('Failed to create Ethereal Mail account:', error);
        this.initialized = true;
        return;
      }
    }

    // Use configured SMTP
    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort || 587,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: {
        rejectUnauthorized: nodeEnv === 'production',
      },
    });

    this.logger.log(`Email transporter initialized: ${smtpHost}`);
    this.initialized = true;
  }

  /**
   * Send OTP verification email
   */
  async sendOtpEmail(data: OtpEmailData): Promise<boolean> {
    await this.initializeTransporter();

    const purposeLabels = {
      email_verification: 'Email Verification',
      phone_verification: 'Phone Verification',
      password_reset: 'Password Reset',
      two_factor: 'Two-Factor Authentication',
    };

    const subject = `${purposeLabels[data.purpose]} - Cycle Platform`;
    const html = this.generateOtpEmailHtml(
      data.code,
      purposeLabels[data.purpose],
    );

    // Use Resend if available
    if (this.useResend && this.resend) {
      try {
        const { error } = await this.resend.emails.send({
          from: 'Cycle Platform <onboarding@resend.dev>',
          to: data.email,
          subject,
          html,
        });

        if (error) {
          this.logger.error(`Resend error for ${data.email}:`, error);
          return false;
        }

        this.logger.log(`📧 Email sent via Resend to ${data.email}`);
        return true;
      } catch (error) {
        this.logger.error(
          `Failed to send email via Resend to ${data.email}:`,
          error,
        );
        return false;
      }
    }

    // Fallback to nodemailer
    if (!this.transporter) {
      this.logger.warn('Email transporter not available. OTP not sent.');
      return false;
    }

    try {
      const info = await this.transporter.sendMail({
        from: '"Cycle Platform" <noreply@cycle.com>',
        to: data.email,
        subject,
        html,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        this.logger.log(`📧 Email preview: ${previewUrl}`);
      }

      this.logger.log(`Email sent to ${data.email}: ${info.messageId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${data.email}:`, error);
      return false;
    }
  }

  /**
   * Generate HTML template for OTP email
   */
  private generateOtpEmailHtml(code: string, purpose: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .header {
            background: #083232;
            color: white;
            padding: 30px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
          }
          .content {
            padding: 40px 30px;
          }
          .content h2 {
            color: #083232;
            margin: 0 0 20px 0;
            font-size: 22px;
          }
          .otp-box {
            background: #f8f9fa;
            border: 2px solid #083232;
            border-radius: 8px;
            padding: 25px;
            margin: 30px 0;
            text-align: center;
          }
          .otp-code {
            font-size: 36px;
            font-weight: bold;
            letter-spacing: 8px;
            color: #083232;
            font-family: 'Courier New', monospace;
            margin: 0;
          }
          .otp-label {
            font-size: 14px;
            color: #666;
            margin-top: 10px;
          }
          .warning {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            font-size: 14px;
          }
          .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
          }
          .footer a {
            color: #083232;
            text-decoration: none;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔄 Cycle Platform</h1>
          </div>
          
          <div class="content">
            <h2>${purpose}</h2>
            <p>Your verification code is:</p>
            
            <div class="otp-box">
              <div class="otp-code">${code}</div>
              <div class="otp-label">Enter this code to continue</div>
            </div>
            
            <p>This code will expire in <strong>10 minutes</strong>.</p>
            
            <div class="warning">
              <strong>⚠️ Security Notice:</strong> Never share this code with anyone. 
              Cycle Platform will never ask for your verification code via phone or email.
            </div>
            
            <p style="color: #666; font-size: 14px;">
              If you didn't request this code, please ignore this email or contact our support team.
            </p>
          </div>
          
          <div class="footer">
            <p>
              <strong>Cycle Platform</strong> - #1 Social Fintech in Kenya<br>
              Join thousands benefiting from the power of numbers
            </p>
            <p>
              <a href="#">About Us</a> • 
              <a href="#">Support</a> • 
              <a href="#">Contact</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
