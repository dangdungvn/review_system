import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ExamsService } from './exams.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/interfaces/jwt-user.interface';

@ApiTags('Exams')
@ApiBearerAuth('JWT')
@Controller('exams')
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Post('generate/:documentId')
  @ApiOperation({ summary: 'Sinh đề thi trắc nghiệm 50 câu từ tài liệu' })
  @ApiResponse({ status: 201, description: 'Đề thi được tạo thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập tài liệu' })
  generate(
    @Param('documentId', ParseIntPipe) documentId: number,
    @CurrentUser() user: JwtUser,
  ) {
    return this.examsService.generate(documentId, user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách đề thi của tôi theo tài liệu' })
  @ApiQuery({ name: 'documentId', required: true, type: Number })
  @ApiResponse({ status: 200, description: 'Danh sách đề thi' })
  findByDocument(
    @Query('documentId', ParseIntPipe) documentId: number,
    @CurrentUser() user: JwtUser,
  ) {
    return this.examsService.findByDocument(documentId, user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết đề thi (kèm câu hỏi)' })
  @ApiResponse({ status: 200, description: 'Chi tiết đề thi' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtUser,
  ) {
    return this.examsService.findOne(id, user.userId);
  }
}
