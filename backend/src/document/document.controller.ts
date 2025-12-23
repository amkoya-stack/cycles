/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Query,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentService } from './document.service';
import type { DocumentDTO, DocumentAccessDTO } from './document.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentController {
  constructor(private documentService: DocumentService) {}

  /**
   * Upload a new document
   */
  @Post(':chamaId/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Param('chamaId') chamaId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: DocumentDTO,
    @Req() req: any,
  ) {
    dto.file = file;
    return this.documentService.uploadDocument(chamaId, req.user.id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  /**
   * Upload new version of document
   */
  @Post(':chamaId/:documentId/version')
  @UseInterceptors(FileInterceptor('file'))
  async uploadVersion(
    @Param('chamaId') chamaId: string,
    @Param('documentId') documentId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { changeDescription?: string },
    @Req() req: any,
  ) {
    return this.documentService.uploadVersion(
      chamaId,
      documentId,
      req.user.id,
      file,
      body.changeDescription,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    );
  }

  /**
   * Grant access to document
   */
  @Post(':chamaId/:documentId/access')
  async grantAccess(
    @Param('chamaId') chamaId: string,
    @Param('documentId') documentId: string,
    @Body() dto: DocumentAccessDTO,
    @Req() req: any,
  ) {
    return this.documentService.grantAccess(
      chamaId,
      documentId,
      req.user.id,
      dto,
    );
  }

  /**
   * Get version history - more specific route must come before generic :documentId
   */
  @Get(':chamaId/:documentId/versions')
  async getVersionHistory(
    @Param('chamaId') chamaId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documentService.getVersionHistory(chamaId, documentId);
  }

  /**
   * Get access logs - more specific route must come before generic :documentId
   */
  @Get(':chamaId/:documentId/logs')
  async getAccessLogs(
    @Param('chamaId') chamaId: string,
    @Param('documentId') documentId: string,
    @Req() req?: any,
  ) {
    const logs = await this.documentService.getAccessLogs(
      chamaId,
      documentId,
      req.user.id,
    );
    return logs.rows;
  }

  /**
   * Delete document
   */
  @Delete(':chamaId/:documentId')
  async deleteDocument(
    @Param('chamaId') chamaId: string,
    @Param('documentId') documentId: string,
    @Req() req: any,
  ) {
    return this.documentService.deleteDocument(
      chamaId,
      documentId,
      req.user.id,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    );
  }

  /**
   * Get document details - generic route comes last
   */
  @Get(':chamaId/:documentId')
  async getDocument(
    @Param('chamaId') chamaId: string,
    @Param('documentId') documentId: string,
    @Req() req: any,
  ) {
    return this.documentService.getDocumentById(
      chamaId,
      documentId,
      req.user.id,
    );
  }

  /**
   * List documents in chama - most generic route comes last
   */
  @Get(':chamaId')
  async listDocuments(
    @Param('chamaId') chamaId: string,
    @Query('type') type?: string,
    @Query('folder') folder?: string,
    @Query('tags') tags?: string,
    @Query('search') search?: string,
    @Query('uploadedBy') uploadedBy?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Req() req?: any,
  ) {
    return this.documentService.listDocuments(chamaId, req.user.id, {
      type,
      folder,
      tags: tags ? tags.split(',') : undefined,
      search,
      uploadedBy,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }
}
