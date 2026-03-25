import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ExamsService } from './exams.service';

@ApiTags('Exams')
@Controller('exams')
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Post('generate/:documentId')
  @ApiOperation({ summary: 'Sinh đề thi trắc nghiệm 50 câu từ tài liệu' })
  generate(@Param('documentId', ParseIntPipe) documentId: number) {
    return this.examsService.generate(documentId);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách đề thi theo tài liệu' })
  @ApiQuery({ name: 'documentId', required: true, type: Number })
  findByDocument(@Query('documentId', ParseIntPipe) documentId: number) {
    return this.examsService.findByDocument(documentId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết đề thi (kèm câu hỏi)' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.examsService.findOne(id);
  }
}
