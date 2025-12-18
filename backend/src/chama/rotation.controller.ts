import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { DatabaseService } from '../database/database.service';
import { RotationService } from './rotation.service';
import {
  CreateRotationOrderDto,
  SkipRotationPositionDto,
  SwapRotationPositionsDto,
} from './dto/rotation.dto';

@Controller('chama')
@UseGuards(JwtAuthGuard)
export class RotationController {
  constructor(
    private readonly rotationService: RotationService,
    private readonly db: DatabaseService,
  ) {}

  /**
   * Create a new rotation order for a chama
   * Admin only
   */
  @Post(':chamaId/rotation/create')
  @HttpCode(HttpStatus.CREATED)
  async createRotationOrder(
    @Param('chamaId') chamaId: string,
    @Body() dto: CreateRotationOrderDto,
    @Req() req: any,
  ) {
    // Validate user is admin of the chama
    await this.validateChamaAdmin(chamaId, req.user.id);

    return this.rotationService.createRotationOrder(dto);
  }

  /**
   * Get rotation status for a chama
   */
  @Get(':chamaId/rotation')
  async getRotationStatus(@Param('chamaId') chamaId: string, @Req() req: any) {
    // Validate user is member of the chama
    await this.validateChamaMember(chamaId, req.user.id);

    return this.rotationService.getRotationStatus(chamaId);
  }

  /**
   * Get all rotation positions with member details
   */
  @Get(':chamaId/rotation/positions')
  async getRotationPositions(
    @Param('chamaId') chamaId: string,
    @Req() req: any,
  ) {
    // Validate user is member of the chama
    await this.validateChamaMember(chamaId, req.user.id);

    return this.rotationService.getRotationPositions(chamaId);
  }

  /**
   * Get next recipient in rotation
   */
  @Get(':chamaId/rotation/next')
  async getNextRecipient(@Param('chamaId') chamaId: string, @Req() req: any) {
    // Validate user is member of the chama
    await this.validateChamaMember(chamaId, req.user.id);

    // Get active rotation
    const status = await this.rotationService.getRotationStatus(chamaId);

    if (!status.rotation) {
      return { nextRecipient: null, message: 'No active rotation found' };
    }

    const nextRecipient = await this.rotationService.getNextRecipient(
      status.rotation.id,
    );

    return { nextRecipient };
  }

  /**
   * Skip a rotation position
   * Admin only
   */
  @Post(':chamaId/rotation/skip')
  @HttpCode(HttpStatus.OK)
  async skipPosition(
    @Param('chamaId') chamaId: string,
    @Body() dto: SkipRotationPositionDto,
    @Req() req: any,
  ) {
    // Validate user is admin of the chama
    await this.validateChamaAdmin(chamaId, req.user.id);

    return this.rotationService.skipPosition(dto);
  }

  /**
   * Swap two rotation positions
   * Admin only
   */
  @Post(':chamaId/rotation/swap')
  @HttpCode(HttpStatus.OK)
  async swapPositions(
    @Param('chamaId') chamaId: string,
    @Body() dto: SwapRotationPositionsDto,
    @Req() req: any,
  ) {
    // Validate user is admin of the chama
    await this.validateChamaAdmin(chamaId, req.user.id);

    return this.rotationService.swapPositions(dto);
  }

  /**
   * Advance rotation manually (mark current position as completed)
   * Admin only - used when payout is completed outside system
   */
  @Post(':chamaId/rotation/advance')
  @HttpCode(HttpStatus.OK)
  async advanceRotation(
    @Param('chamaId') chamaId: string,
    @Body() body: { positionId: string },
    @Req() req: any,
  ) {
    // Validate user is admin of the chama
    await this.validateChamaAdmin(chamaId, req.user.id);

    // Get active rotation
    const status = await this.rotationService.getRotationStatus(chamaId);

    if (!status.rotation) {
      throw new Error('No active rotation found');
    }

    return this.rotationService.advanceRotation(
      status.rotation.id,
      body.positionId,
    );
  }

  /**
   * Validate user is a member of the chama
   */
  private async validateChamaMember(chamaId: string, userId: string) {
    const result = await this.db.query(
      `SELECT id FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND status = 'active'`,
      [chamaId, userId],
    );

    if (result.rowCount === 0) {
      throw new Error('You are not a member of this chama');
    }
  }

  /**
   * Validate user is admin of the chama
   */
  private async validateChamaAdmin(chamaId: string, userId: string) {
    const result = await this.db.query(
      `SELECT id FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND role = 'admin' AND status = 'active'`,
      [chamaId, userId],
    );

    if (result.rowCount === 0) {
      throw new Error('You must be an admin of this chama');
    }
  }
}
