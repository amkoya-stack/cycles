import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req,
  UseGuards,
  Param,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ChatService } from './chat.service';
import type {
  SendMessageDto,
  GetConversationsDto,
  GetMessagesDto,
} from './chat.service';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * Send a message
   * POST /api/chat/messages
   */
  @Post('messages')
  async sendMessage(@Req() req: any, @Body() dto: SendMessageDto) {
    console.log('POST /api/chat/messages called by user:', req.user?.id);
    console.log('Message DTO:', dto);
    try {
      const result = await this.chatService.sendMessage(req.user.id, dto);
      console.log('sendMessage successful');
      return result;
    } catch (error) {
      console.error('sendMessage failed:', error);
      throw error;
    }
  }

  /**
   * Get conversations (chat list)
   * GET /api/chat/conversations?chamaId=optional
   */
  @Get('conversations')
  async getConversations(@Req() req: any, @Query() dto: GetConversationsDto) {
    console.log('GET /api/chat/conversations called by user:', req.user?.id);
    console.log('Query params:', dto);
    try {
      const result = await this.chatService.getConversations(req.user.id, dto);
      console.log('getConversations successful, count:', result?.length || 0);
      return result;
    } catch (error) {
      console.error('getConversations failed:', error);
      throw error;
    }
  }

  /**
   * Get messages in a conversation
   * GET /api/chat/conversations/:id/messages?limit=50&offset=0
   */
  @Get('conversations/:id/messages')
  async getMessages(
    @Req() req: any,
    @Param('id') conversationId: string,
    @Query() query: { limit?: string; offset?: string },
  ) {
    const dto: GetMessagesDto = {
      conversationId,
      limit: query.limit ? parseInt(query.limit) : 50,
      offset: query.offset ? parseInt(query.offset) : 0,
    };
    return this.chatService.getMessages(req.user.id, dto);
  }

  /**
   * Get chama members available for chat
   * GET /api/chat/chamas/:id/members
   */
  @Get('chamas/:id/members')
  async getChamaMembers(@Req() req: any, @Param('id') chamaId: string) {
    return this.chatService.getChamaMembers(req.user.id, chamaId);
  }

  /**
   * Get unread message count
   * GET /api/chat/unread?chamaId=optional
   */
  @Get('unread')
  async getUnreadCount(@Req() req: any, @Query('chamaId') chamaId?: string) {
    return {
      unread_count: await this.chatService.getUnreadCount(req.user.id, chamaId),
    };
  }
}
