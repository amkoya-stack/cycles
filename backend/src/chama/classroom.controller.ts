import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Body,
  Req,
} from '@nestjs/common';
import { FileInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ClassroomService, CourseDTO } from './classroom.service';

@Controller({ path: 'chama/:chamaId/classroom', version: '1' })
@UseGuards(JwtAuthGuard)
export class ClassroomController {
  constructor(private readonly classroomService: ClassroomService) {}

  /**
   * Get all courses for a chama
   * GET /api/v1/chama/:chamaId/classroom/courses
   */
  @Get('courses')
  async getCourses(@Param('chamaId') chamaId: string, @Req() req: any) {
    return this.classroomService.getCourses(chamaId, req.user.id);
  }

  /**
   * Upload a new course
   * POST /api/v1/chama/:chamaId/classroom/courses
   */
  @Post('courses')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'file', maxCount: 1 },
      { name: 'thumbnail', maxCount: 1 },
    ])
  )
  async uploadCourse(
    @Param('chamaId') chamaId: string,
    @UploadedFiles()
    files: {
      file?: Express.Multer.File[];
      thumbnail?: Express.Multer.File[];
    },
    @Body() body: { 
      title: string; 
      description?: string; 
      fileType: string;
      lockType?: 'none' | 'reputation' | 'price' | 'both';
      requiredReputationTier?: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
      unlockPrice?: string;
    },
    @Req() req: any,
  ) {
    const dto: CourseDTO = {
      title: body.title,
      description: body.description,
      fileType: body.fileType as 'pdf' | 'audio' | 'video',
      file: files.file?.[0],
      thumbnail: files.thumbnail?.[0],
      lockType: body.lockType || 'none',
      requiredReputationTier: body.requiredReputationTier,
      unlockPrice: body.unlockPrice ? parseFloat(body.unlockPrice) : undefined,
    };

    return this.classroomService.uploadCourse(chamaId, req.user.id, dto);
  }

  /**
   * Unlock a course
   * POST /api/v1/chama/:chamaId/classroom/courses/:courseId/unlock
   */
  @Post('courses/:courseId/unlock')
  async unlockCourse(
    @Param('chamaId') chamaId: string,
    @Param('courseId') courseId: string,
    @Body() body: { unlockMethod: 'reputation' | 'purchase' },
    @Req() req: any,
  ) {
    return this.classroomService.unlockCourse(
      chamaId,
      courseId,
      req.user.id,
      body.unlockMethod,
    );
  }

  /**
   * Delete a course
   * DELETE /api/v1/chama/:chamaId/classroom/courses/:courseId
   */
  @Delete('courses/:courseId')
  async deleteCourse(
    @Param('chamaId') chamaId: string,
    @Param('courseId') courseId: string,
    @Req() req: any,
  ) {
    return this.classroomService.deleteCourse(chamaId, courseId, req.user.id);
  }
}

