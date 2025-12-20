/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CommunityService } from './community.service';
import {
  CreatePostDto,
  CreateReplyDto,
  UpdatePostDto,
} from './dto/community.dto';

@Controller('chama/:chamaId/community')
@UseGuards(JwtAuthGuard)
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  /**
   * Get all posts for a chama
   */
  @Get('posts')
  async getPosts(
    @Param('chamaId') chamaId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Req() req: any,
  ) {
    return this.communityService.getPosts(
      chamaId,
      req.user.id,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  /**
   * Create a new post
   */
  @Post('posts')
  async createPost(
    @Param('chamaId') chamaId: string,
    @Body() dto: CreatePostDto,
    @Req() req: any,
  ) {
    return this.communityService.createPost(chamaId, req.user.id, dto.content);
  }

  /**
   * Update a post
   */
  @Put('posts/:postId')
  async updatePost(
    @Param('chamaId') chamaId: string,
    @Param('postId') postId: string,
    @Body() dto: UpdatePostDto,
    @Req() req: any,
  ) {
    return this.communityService.updatePost(
      chamaId,
      postId,
      req.user.id,
      dto.content,
    );
  }

  /**
   * Delete a post
   */
  @Delete('posts/:postId')
  async deletePost(
    @Param('chamaId') chamaId: string,
    @Param('postId') postId: string,
    @Req() req: any,
  ) {
    await this.communityService.deletePost(chamaId, postId, req.user.id);
    return { success: true };
  }

  /**
   * Toggle like on a post
   */
  @Post('posts/:postId/like')
  async togglePostLike(
    @Param('chamaId') chamaId: string,
    @Param('postId') postId: string,
    @Req() req: any,
  ) {
    return this.communityService.togglePostLike(chamaId, postId, req.user.id);
  }

  /**
   * Create a reply to a post
   */
  @Post('posts/:postId/replies')
  async createReply(
    @Param('chamaId') chamaId: string,
    @Param('postId') postId: string,
    @Body() dto: CreateReplyDto,
    @Req() req: any,
  ) {
    return this.communityService.createReply(
      chamaId,
      postId,
      req.user.id,
      dto.content,
      dto.parentReplyId,
    );
  }

  /**
   * Toggle like on a reply
   */
  @Post('replies/:replyId/like')
  async toggleReplyLike(
    @Param('chamaId') chamaId: string,
    @Param('replyId') replyId: string,
    @Req() req: any,
  ) {
    return this.communityService.toggleReplyLike(chamaId, replyId, req.user.id);
  }

  /**
   * Delete a reply
   */
  @Delete('replies/:replyId')
  async deleteReply(
    @Param('chamaId') chamaId: string,
    @Param('replyId') replyId: string,
    @Req() req: any,
  ) {
    await this.communityService.deleteReply(chamaId, replyId, req.user.id);
    return { success: true };
  }

  /**
   * Pin/unpin a post
   */
  @Post('posts/:postId/pin')
  async togglePin(
    @Param('chamaId') chamaId: string,
    @Param('postId') postId: string,
    @Req() req: any,
  ) {
    return this.communityService.togglePin(chamaId, postId, req.user.id);
  }
}
