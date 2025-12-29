import { Controller, Get, Param, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { UsersService } from './users.service';
import { Detokenize } from '../common/decorators/tokenize.decorator';
import { TokenizationInterceptor } from '../common/interceptors/tokenization.interceptor';

@Controller({ path: 'users', version: '1' })
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  @UseInterceptors(TokenizationInterceptor)
  @Detokenize(['email', 'phone', 'id_number'])
  async getUserProfile(@Param('id') userId: string) {
    console.log('UsersController.getUserProfile - Received userId:', userId);
    return this.usersService.getUserProfile(userId);
  }
}
