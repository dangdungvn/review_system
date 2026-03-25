import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { TrueFalseService } from './true-false.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('True/False')
@Controller('true-false')
@Public() // Tạm thời public tất cả endpoints
export class TrueFalseController {
  constructor(private readonly trueFalseService: TrueFalseService) {}

  @Post('generate/:documentId')
  @ApiOperation({ summary: 'Sinh câu hỏi đúng/sai từ tài liệu' })
  generate(@Param('documentId', ParseIntPipe) documentId: number) {
    return this.trueFalseService.generate(documentId);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách câu đúng/sai theo tài liệu' })
  @ApiQuery({ name: 'documentId', required: true, type: Number })
  findByDocument(@Query('documentId', ParseIntPipe) documentId: number) {
    return this.trueFalseService.findByDocument(documentId);
  }
}
