import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  async getUserProfile(@Param('id') userId: string) {
    console.log('UsersController.getUserProfile - Received userId:', userId);
    return this.usersService.getUserProfile(userId);
  }
}
