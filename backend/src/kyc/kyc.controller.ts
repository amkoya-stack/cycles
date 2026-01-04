import {
  Controller,
  Post,
  Get,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  Body,
  Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { KycService } from './kyc.service';
import type { BiometricRegistration, AddressVerification } from './kyc.service';
import { RateLimit } from '../common/decorators/rate-limit.decorator';

@Controller('kyc')
@UseGuards(JwtAuthGuard)
export class KycController {
  constructor(private readonly kycService: KycService) {}

  /**
   * Upload KYC document (ID front/back, selfie, address proof)
   */
  @Post('documents')
  @UseInterceptors(FileInterceptor('file'))
  @RateLimit({ max: 10, window: 3600 }) // 10 uploads per hour
  async uploadDocument(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body('documentType') documentType: string,
  ) {
    if (!file) {
      throw new Error('No file uploaded');
    }

    if (!['id_front', 'id_back', 'selfie', 'address_proof'].includes(documentType)) {
      throw new Error('Invalid document type');
    }

    return this.kycService.uploadDocument(req.user.id, {
      documentType: documentType as any,
      file,
    });
  }

  /**
   * Register biometric authentication
   */
  @Post('biometric')
  @RateLimit({ max: 5, window: 3600 }) // 5 registrations per hour
  async registerBiometric(
    @Req() req: any,
    @Body() biometric: BiometricRegistration,
  ) {
    return this.kycService.registerBiometric(req.user.id, biometric);
  }

  /**
   * Verify biometric authentication
   */
  @Post('biometric/verify')
  @RateLimit({ max: 20, window: 60 }) // 20 verifications per minute
  async verifyBiometric(
    @Req() req: any,
    @Body() body: {
      biometricType: 'fingerprint' | 'face_id' | 'voice';
      templateHash: string;
      deviceId: string;
    },
  ) {
    return this.kycService.verifyBiometric(
      req.user.id,
      body.biometricType,
      body.templateHash,
      body.deviceId,
    );
  }

  /**
   * Submit address for verification
   */
  @Post('address')
  @RateLimit({ max: 5, window: 3600 }) // 5 submissions per hour
  async submitAddress(
    @Req() req: any,
    @Body() address: AddressVerification,
  ) {
    return this.kycService.submitAddress(req.user.id, address);
  }

  /**
   * Get KYC status
   */
  @Get('status')
  async getKycStatus(@Req() req: any) {
    return this.kycService.getKycStatus(req.user.id);
  }
}

