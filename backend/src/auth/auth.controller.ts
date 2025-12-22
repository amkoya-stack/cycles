import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from './jwt.guard';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { BasicKycDto } from './dto/basic-kyc.dto';
import { NextOfKinDto } from './dto/next-of-kin.dto';
import { ProfileDto } from './dto/profile.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('otp/send')
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @Post('otp/verify')
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Post('kyc/basic')
  @UseGuards(JwtAuthGuard)
  async basicKyc(@Req() req: any, @Body() dto: BasicKycDto) {
    return this.authService.basicKycWithUser(req.user.id, dto);
  }

  @Post('next-of-kin')
  @UseGuards(JwtAuthGuard)
  async nextOfKin(@Req() req: any, @Body() dto: NextOfKinDto) {
    return this.authService.nextOfKinWithUser(req.user.id, dto);
  }

  @Post('profile')
  @UseGuards(JwtAuthGuard)
  async profile(@Req() req: any, @Body() dto: ProfileDto) {
    return this.authService.profileWithUser(req.user.id, dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: any) {
    return this.authService.getUserProfile(req.user.id);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  async enable2fa(@Req() req: any) {
    return this.authService.enable2fa(req.user.id);
  }

  @Post('2fa/verify')
  async verify2fa(@Body() body: { destination: string; code: string }) {
    return this.authService.verify2fa(body.destination, body.code);
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  async disable2fa(@Req() req: any) {
    return this.authService.disable2fa(req.user.id);
  }

  @Post('password/reset')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('email/verify')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  // Alias endpoints for frontend compatibility
  @Post('verify-email')
  async verifyEmailAlias(@Body() body: { email: string; otp: string }) {
    return this.authService.verifyEmail({ email: body.email, otp: body.otp });
  }

  @Post('verify-phone')
  async verifyPhone(@Body() body: { phone: string; otp: string }) {
    return this.authService.verifyOtp({
      channel: 'sms',
      destination: body.phone,
      code: body.otp,
      purpose: 'phone_verification',
    });
  }

  @Post('token/refresh')
  async refreshToken(@Body() body: { refreshToken: string }) {
    return this.authService.refreshToken(body.refreshToken);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: any) {
    return this.authService.getProfile(req.user.id);
  }

  @Post('upload-profile-photo')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadProfilePhoto(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.authService.uploadProfilePhoto(req.user.id, file);
  }

  @Post('remove-profile-photo')
  @UseGuards(JwtAuthGuard)
  async removeProfilePhoto(@Req() req: any) {
    return this.authService.removeProfilePhoto(req.user.id);
  }
}
