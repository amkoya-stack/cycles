import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { signJwt } from './jwt.util';
import {
  hashPassword,
  hashOtp,
  verifyOtp as verifyOtpHash,
  verifyPassword,
} from './crypto.util';
import { UsersService } from '../users/users.service';
import { LedgerService } from '../ledger/ledger.service';
import { EmailService } from './email.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { BasicKycDto } from './dto/basic-kyc.dto';
import { NextOfKinDto } from './dto/next-of-kin.dto';
import { ProfileDto } from './dto/profile.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly ledger: LedgerService,
    private readonly emailService: EmailService,
  ) {}

  async register(dto: RegisterDto) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('email or phone is required');
    }
    const { email, phone, password } = dto;

    // Check if user exists and their verification status
    const existing = await this.db.query(
      'SELECT id, email_verified, phone_verified FROM users WHERE (email = $1 AND $1 IS NOT NULL) OR (phone = $2 AND $2 IS NOT NULL) LIMIT 1',
      [email || null, phone || null],
    );

    if (existing.rowCount > 0) {
      const user = existing.rows[0] as any;
      const isEmailVerified = user.email_verified;
      const isPhoneVerified = user.phone_verified;

      // If user exists and is verified, don't allow re-registration
      if (isEmailVerified || isPhoneVerified) {
        throw new BadRequestException('User already exists');
      }

      // User exists but not verified - resend OTP and allow them to verify
      const userId = user.id as string;

      // Update password in case they forgot what they used before
      const passwordHash = await hashPassword(password);
      await this.db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
        passwordHash,
        userId,
      ]);

      // Resend OTP codes
      if (phone) {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        await this.createOtp(userId, 'sms', phone, 'phone_verification', code);
      }
      if (email) {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        await this.createOtp(
          userId,
          'email',
          email,
          'email_verification',
          code,
        );
      }

      return { userId, message: 'Verification code resent' };
    }

    // New user - create account
    const passwordHash = await hashPassword(password);
    const fullName =
      `${dto.firstName || ''} ${dto.lastName || ''}`.trim() || null;
    const res = await this.db.query<{ id: string }>(
      'INSERT INTO users (email, phone, password_hash, full_name) VALUES ($1, $2, $3, $4) RETURNING id',
      [email || null, phone || null, passwordHash, fullName],
    );
    const userId = res.rows[0].id;

    // ✨ Auto-create personal wallet for user
    try {
      const userName = fullName || 'User';
      await this.ledger.createUserWallet(userId, userName);
    } catch (error) {
      // Log error but don't fail registration (wallet can be created later)
      console.error(`Failed to create wallet for user ${userId}:`, error);
    }

    // Auto-generate OTP for phone/email verification if provided
    if (phone) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      await this.createOtp(userId, 'sms', phone, 'phone_verification', code);
    }
    if (email) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      await this.createOtp(userId, 'email', email, 'email_verification', code);
    }
    return { userId };
  }

  async login(dto: LoginDto) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('email or phone is required');
    }
    const { email, phone, password } = dto;
    const res = await this.db.query(
      'SELECT id, password_hash, two_factor_enabled, phone, email FROM users WHERE (email = $1 AND $1 IS NOT NULL) OR (phone = $2 AND $2 IS NOT NULL) LIMIT 1',
      [email || null, phone || null],
    );
    if (res.rowCount === 0) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const user = res.rows[0] as any;
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    // Check if 2FA is enabled
    if (user.two_factor_enabled) {
      const destination = user.phone || user.email;
      const channel = user.phone ? 'sms' : 'email';
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      await this.createOtp(user.id, channel, destination, 'two_factor', code);
      const devEcho =
        (this.config.get<string>('NODE_ENV') || 'development') ===
          'development' &&
        (this.config.get<string>('ALLOW_DEV_OTP_RETURN') || 'true') === 'true';
      return {
        requires2fa: true,
        destination,
        ...(devEcho && { code }),
      };
    }
    // Issue tokens directly if 2FA is not enabled
    const tokens = await this.issueTokens(user.id);
    return { ...tokens, userId: user.id };
  }

  async sendOtp(dto: SendOtpDto) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await this.createOtp(null, dto.channel, dto.destination, dto.purpose, code);
    const devEcho =
      (this.config.get<string>('NODE_ENV') || 'development') ===
        'development' &&
      (this.config.get<string>('ALLOW_DEV_OTP_RETURN') || 'true') === 'true';
    return devEcho ? { status: 'sent', code } : { status: 'sent' };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const now = new Date();
    const res = await this.db.query(
      `SELECT id, user_id, code FROM otp_codes
       WHERE channel = $1 AND destination = $2 AND purpose = $3
         AND used_at IS NULL AND expires_at > $4
       ORDER BY created_at DESC LIMIT 1`,
      [dto.channel, dto.destination, dto.purpose, now],
    );
    if (res.rowCount === 0) {
      throw new BadRequestException('Invalid or expired OTP');
    }
    const row = res.rows[0] as any;
    const ok = await verifyOtpHash(dto.code, row.code as string);
    if (!ok) {
      throw new BadRequestException('Invalid or expired OTP');
    }
    const otpId = row.id as string;
    const userId = row.user_id as string | null;
    await this.db.transaction(async (client) => {
      await client.query('UPDATE otp_codes SET used_at = now() WHERE id = $1', [
        otpId,
      ]);
      if (dto.purpose === 'phone_verification') {
        await client.query(
          'UPDATE users SET phone_verified = TRUE WHERE (phone = $1) OR (id = $2)',
          [dto.destination, userId],
        );
      } else if (dto.purpose === 'email_verification') {
        await client.query(
          'UPDATE users SET email_verified = TRUE WHERE (email = $1) OR (id = $2)',
          [dto.destination, userId],
        );
      }
    });
    const tokens = await this.issueTokens(userId);
    return { status: 'verified', ...tokens };
  }

  async basicKycWithUser(userId: string, dto: BasicKycDto) {
    return this.users.updateBasicKyc(userId, dto);
  }

  async nextOfKinWithUser(userId: string, dto: NextOfKinDto) {
    return this.users.addNextOfKin(userId, dto);
  }

  async profileWithUser(userId: string, dto: ProfileDto) {
    return this.users.updateProfile(userId, dto);
  }

  async enable2fa(userId: string) {
    await this.db.query(
      'UPDATE users SET two_factor_enabled = TRUE WHERE id = $1',
      [userId],
    );
    // Send initial 2FA OTP to phone/email if available
    const destRes = await this.db.query(
      'SELECT phone, email FROM users WHERE id = $1',
      [userId],
    );
    const { phone, email } = destRes.rows[0] as any;
    const destination = phone || email;
    const channel = phone ? 'sms' : 'email';
    if (destination) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      await this.createOtp(userId, channel, destination, 'two_factor', code);
    }
    return { status: '2fa_enabled' };
  }

  async verify2fa(destination: string, code: string) {
    const res = await this.db.query(
      `SELECT user_id, code FROM otp_codes WHERE destination = $1 AND purpose = 'two_factor' AND used_at IS NULL AND expires_at > now() ORDER BY created_at DESC LIMIT 1`,
      [destination],
    );
    if (res.rowCount === 0)
      throw new BadRequestException('Invalid or expired 2FA code');
    const r = res.rows[0] as any;
    const ok = await verifyOtpHash(code, r.code as string);
    if (!ok) throw new BadRequestException('Invalid or expired 2FA code');
    const userId = r.user_id as string;
    await this.db.query(
      'UPDATE otp_codes SET used_at = now() WHERE destination = $1 AND code = $2',
      [destination, r.code],
    );
    const tokens = await this.issueTokens(userId);
    return { status: '2fa_verified', ...tokens };
  }

  async disable2fa(userId: string) {
    await this.db.query(
      'UPDATE users SET two_factor_enabled = FALSE WHERE id = $1',
      [userId],
    );
    return { status: '2fa_disabled' };
  }

  async resetPassword(dto: {
    destination: string;
    otp: string;
    newPassword: string;
  }) {
    await this.verifyOtp({
      channel: dto.destination.includes('@') ? 'email' : 'sms',
      destination: dto.destination,
      code: dto.otp,
      purpose: 'password_reset',
    });
    const passwordHash = await hashPassword(dto.newPassword);
    await this.db.query(
      'UPDATE users SET password_hash = $1 WHERE (email = $2) OR (phone = $3)',
      [
        passwordHash,
        dto.destination.includes('@') ? dto.destination : null,
        dto.destination.includes('@') ? null : dto.destination,
      ],
    );
    await this.db.query(
      'UPDATE auth_tokens SET revoked = TRUE WHERE user_id IN (SELECT id FROM users WHERE email = $1 OR phone = $2)',
      [
        dto.destination.includes('@') ? dto.destination : null,
        dto.destination.includes('@') ? null : dto.destination,
      ],
    );
    return { status: 'password_reset' };
  }

  async verifyEmail(dto: { email: string; otp: string }) {
    const result = await this.verifyOtp({
      channel: 'email',
      destination: dto.email,
      code: dto.otp,
      purpose: 'email_verification',
    });
    return result;
  }

  async refreshToken(refreshToken: string) {
    const res = await this.db.query(
      'SELECT user_id, id FROM auth_tokens WHERE token = $1 AND revoked = FALSE AND expires_at > now()',
      [refreshToken],
    );
    if (res.rowCount === 0) {
      throw new BadRequestException('Invalid refresh token');
    }
    const row = res.rows[0] as any;
    const userId = row.user_id as string;
    const tokenId = row.id as string;
    await this.db.query('UPDATE auth_tokens SET revoked = TRUE WHERE id = $1', [
      tokenId,
    ]);
    const tokens = await this.issueTokens(userId);
    return tokens;
  }

  private async createOtp(
    userId: string | null,
    channel: 'sms' | 'email',
    destination: string,
    purpose:
      | 'phone_verification'
      | 'email_verification'
      | 'password_reset'
      | 'two_factor',
    code: string,
  ) {
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const hashed = await hashOtp(code);
    await this.db.query(
      'INSERT INTO otp_codes (user_id, channel, destination, code, purpose, expires_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [userId, channel, destination, hashed, purpose, expires],
    );

    // Send OTP via email if channel is email
    if (channel === 'email') {
      await this.emailService.sendOtpEmail({
        email: destination,
        code,
        purpose,
      });
    }
    // TODO: Implement SMS sending via Africa's Talking when ready
  }

  async getUserProfile(userId: string) {
    const result = await this.db.query(
      `SELECT id, email, phone, full_name, dob as date_of_birth, id_number, bio,
              website, facebook, twitter, linkedin,
              email_verified, phone_verified, two_factor_enabled, created_at 
       FROM users WHERE id = $1`,
      [userId],
    );

    if (result.rows.length === 0) {
      throw new BadRequestException('User not found');
    }

    return result.rows[0];
  }

  async getProfile(userId: string) {
    const result = await this.db.query(
      'SELECT id, email, phone, full_name, email_verified, phone_verified, two_factor_enabled FROM users WHERE id = $1',
      [userId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('User not found');
    }

    return result.rows[0];
  }

  private async issueTokens(userId: string | null) {
    if (!userId) return { accessToken: null, refreshToken: null };
    const secret = this.config.get<string>('JWT_SECRET') || 'dev-secret';
    const accessToken = signJwt(
      { sub: userId, type: 'access' },
      secret,
      4 * 60 * 60, // 4 hours
    );
    const refreshToken = randomBytes(32).toString('hex');
    const refreshExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    await this.db.query(
      'INSERT INTO auth_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [userId, refreshToken, refreshExpires],
    );
    return { accessToken, refreshToken };
  }
}
