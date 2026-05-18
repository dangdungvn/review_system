import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ExamsService } from './exams.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Exams')
@ApiBearerAuth('JWT')
@Controller('exams')
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Post('generate/:documentId')
  @ApiOperation({ summary: 'Sinh đề thi trắc nghiệm 50 câu từ tài liệu' })
  generate(
    @Param('documentId', ParseIntPipe) documentId: number,
    @CurrentUser() user: any,
  ) {
    return this.examsService.generate(documentId, user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách đề thi theo tài liệu' })
  @ApiQuery({ name: 'documentId', required: true, type: Number })
  findByDocument(
    @Query('documentId', ParseIntPipe) documentId: number,
    @CurrentUser() user: any,
  ) {
    return this.examsService.findByDocument(documentId, user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết đề thi (kèm câu hỏi)' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.examsService.findOne(id, user.userId);
  }
}
