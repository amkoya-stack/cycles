import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { mapQueryRow } from '../database/mapper.util';
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
import { TokenizationService } from '../common/services/tokenization.service';
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
    private readonly tokenization: TokenizationService,
  ) {}

  async register(dto: RegisterDto) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('email or phone is required');
    }
    const { email, phone, password } = dto;

    // Check if user exists and their verification status
    // Tokenize inputs to match what's stored in DB
    const tokenizedEmailForCheck = email ? await this.tokenization.tokenize(email, 'email') : null;
    const tokenizedPhoneForCheck = phone ? await this.tokenization.tokenize(phone, 'phone') : null;
    
    const existing = await this.db.query(
      'SELECT id, email_verified, phone_verified FROM users WHERE (email = $1 AND $1 IS NOT NULL) OR (phone = $2 AND $2 IS NOT NULL) LIMIT 1',
      [tokenizedEmailForCheck, tokenizedPhoneForCheck],
    );

    const existingUser = mapQueryRow<{ emailVerified: boolean; phoneVerified: boolean }>(existing, {
      booleanFields: ['emailVerified', 'phoneVerified'],
    });
    if (existingUser) {
      const isEmailVerified = existingUser.emailVerified;
      const isPhoneVerified = existingUser.phoneVerified;

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
    // Tokenize sensitive data before storing
    const passwordHash = await hashPassword(password);
    const fullName =
      `${dto.firstName || ''} ${dto.lastName || ''}`.trim() || null;
    const tokenizedEmail = email ? await this.tokenization.tokenize(email, 'email') : null;
    const tokenizedPhone = phone ? await this.tokenization.tokenize(phone, 'phone') : null;
    
    const res = await this.db.query<{ id: string }>(
      'INSERT INTO users (email, phone, password_hash, full_name) VALUES ($1, $2, $3, $4) RETURNING id',
      [tokenizedEmail, tokenizedPhone, passwordHash, fullName],
    );
    const user = mapQueryRow<{ id: string }>(res);
    if (!user) {
      throw new BadRequestException('Failed to create user');
    }
    const userId = user.id;

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
    
    // Find tokens for the input values (using reverse lookup)
    // This allows us to match against tokenized values in the database
    const tokenizedEmail = email ? await this.tokenization.findToken(email, 'email') : null;
    const tokenizedPhone = phone ? await this.tokenization.findToken(phone, 'phone') : null;
    
    // If tokens not found in Redis, try to find user by detokenizing all records
    // This handles cases where Redis cache expired or user was created before reverse lookup was added
    let res;
    if (tokenizedEmail || tokenizedPhone) {
      // Use tokenized values for lookup
      res = await this.db.query(
        'SELECT id, password_hash, two_factor_enabled, phone, email FROM users WHERE (email = $1 AND $1 IS NOT NULL) OR (phone = $2 AND $2 IS NOT NULL) LIMIT 1',
        [tokenizedEmail, tokenizedPhone],
      );
    }
    
    // Fallback: if not found with tokens, try brute-force detokenization
    // This is less efficient but handles edge cases
    if (!res || res.rowCount === 0) {
      // Get all users and check by detokenizing (only if we have email or phone)
      const allUsers = await this.db.query(
        'SELECT id, password_hash, two_factor_enabled, phone, email FROM users WHERE email IS NOT NULL OR phone IS NOT NULL',
      );
      
      for (const user of allUsers.rows) {
        const detokenizedEmail = user.email ? await this.tokenization.detokenize(user.email, 'email') : null;
        const detokenizedPhone = user.phone ? await this.tokenization.detokenize(user.phone, 'phone') : null;
        
        if ((email && detokenizedEmail === email) || (phone && detokenizedPhone === phone)) {
          res = { rowCount: 1, rows: [user] };
          break;
        }
      }
    }
    
    if (!res || res.rowCount === 0) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (res.rowCount === 0) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const user = mapQueryRow<any>(res);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    
    // Detokenize sensitive fields for 2FA
    const detokenizedPhone = user.phone ? await this.tokenization.detokenize(user.phone, 'phone') : null;
    const detokenizedEmail = user.email ? await this.tokenization.detokenize(user.email, 'email') : null;
    
    // Check if 2FA is enabled
    if (user.two_factor_enabled) {
      const destination = detokenizedPhone || detokenizedEmail;
      if (!destination) {
        throw new BadRequestException('Phone or email required for 2FA');
      }
      const channel = detokenizedPhone ? 'sms' : 'email';
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
    const row = mapQueryRow<any>(res);
    if (!row) {
      throw new BadRequestException('Invalid or expired OTP');
    }
    const ok = await verifyOtpHash(dto.code, row.code as string);
    if (!ok) {
      throw new BadRequestException('Invalid or expired OTP');
    }
    const otpId = row.id as string;
    const userId = row.user_id as string | null;
    
    // Tokenize destination to match what's stored in DB
    const tokenizedDestination = dto.destination.includes('@')
      ? await this.tokenization.tokenize(dto.destination, 'email')
      : await this.tokenization.tokenize(dto.destination, 'phone');
    
    await this.db.transaction(async (client) => {
      await client.query('UPDATE otp_codes SET used_at = now() WHERE id = $1', [
        otpId,
      ]);
      if (dto.purpose === 'phone_verification') {
        await client.query(
          'UPDATE users SET phone_verified = TRUE WHERE (phone = $1) OR (id = $2)',
          [tokenizedDestination, userId],
        );
      } else if (dto.purpose === 'email_verification') {
        await client.query(
          'UPDATE users SET email_verified = TRUE WHERE (email = $1) OR (id = $2)',
          [tokenizedDestination, userId],
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
    const dest = mapQueryRow<{ phone: string | null; email: string | null }>(destRes);
    if (!dest) {
      throw new NotFoundException('User not found');
    }
    const { phone: tokenizedPhone, email: tokenizedEmail } = dest;
    
    // Detokenize for sending OTP
    const phone = tokenizedPhone ? await this.tokenization.detokenize(tokenizedPhone, 'phone') : null;
    const email = tokenizedEmail ? await this.tokenization.detokenize(tokenizedEmail, 'email') : null;
    
    const destination = phone || email;
    if (destination) {
      const channel = phone ? 'sms' : 'email';
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
    const r = mapQueryRow<any>(res);
    if (!r) {
      throw new BadRequestException('Invalid or expired 2FA code');
    }
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
    
    // Tokenize destination to match what's stored in DB
    const tokenizedEmail = dto.destination.includes('@')
      ? await this.tokenization.tokenize(dto.destination, 'email')
      : null;
    const tokenizedPhone = !dto.destination.includes('@')
      ? await this.tokenization.tokenize(dto.destination, 'phone')
      : null;
    
    await this.db.query(
      'UPDATE users SET password_hash = $1 WHERE (email = $2) OR (phone = $3)',
      [passwordHash, tokenizedEmail, tokenizedPhone],
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
    const row = mapQueryRow<any>(res);
    if (!row) {
      throw new BadRequestException('Invalid or expired OTP');
    }
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
              website, facebook, twitter, linkedin, profile_photo_url,
              email_verified, phone_verified, two_factor_enabled, created_at 
       FROM users WHERE id = $1`,
      [userId],
    );

    if (result.rows.length === 0) {
      throw new BadRequestException('User not found');
    }

    const user = mapQueryRow<any>(result);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    // Detokenize sensitive fields
    if (user.email) {
      user.email = await this.tokenization.detokenize(user.email, 'email');
    }
    if (user.phone) {
      user.phone = await this.tokenization.detokenize(user.phone, 'phone');
    }
    if (user.id_number) {
      user.id_number = await this.tokenization.detokenize(user.id_number, 'id_number');
    }

    return user;
  }

  async getProfile(userId: string) {
    const result = await this.db.query(
      'SELECT id, email, phone, full_name, email_verified, phone_verified, two_factor_enabled, profile_photo_url FROM users WHERE id = $1',
      [userId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('User not found');
    }

    const user = mapQueryRow<any>(result);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    // Detokenize sensitive fields
    if (user.email) {
      user.email = await this.tokenization.detokenize(user.email, 'email');
    }
    if (user.phone) {
      user.phone = await this.tokenization.detokenize(user.phone, 'phone');
    }

    return user;
  }

  async uploadProfilePhoto(userId: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Validate file type
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only images are allowed.',
      );
    }

    // Convert file to base64 for storage or use a file storage service
    // For now, we'll use a simple approach and store as base64 data URL
    const base64 = file.buffer.toString('base64');
    const dataUrl = `data:${file.mimetype};base64,${base64}`;

    // Update user profile with the image
    await this.db.query(
      'UPDATE users SET profile_photo_url = $1 WHERE id = $2',
      [dataUrl, userId],
    );

    return {
      profile_photo_url: dataUrl,
      message: 'Profile photo uploaded successfully',
    };
  }

  async removeProfilePhoto(userId: string) {
    await this.db.query(
      'UPDATE users SET profile_photo_url = NULL WHERE id = $1',
      [userId],
    );
    return { message: 'Profile photo removed' };
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
