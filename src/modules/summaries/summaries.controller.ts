import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { SummariesService } from './summaries.service';

@ApiTags('Summaries')
@Controller('summaries')
@Public()
export class SummariesController {
  constructor(private readonly summariesService: SummariesService) {}

  @Post('generate/:documentId')
  @ApiOperation({ summary: 'Sinh tóm tắt tài liệu từ nội dung PDF đã upload' })
  generate(@Param('documentId', ParseIntPipe) documentId: number) {
    return this.summariesService.generate(documentId);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách tóm tắt theo tài liệu' })
  @ApiQuery({ name: 'documentId', required: true, type: Number })
  findByDocument(@Query('documentId', ParseIntPipe) documentId: number) {
    return this.summariesService.findByDocument(documentId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết tóm tắt tài liệu' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.summariesService.findOne(id);
  }
}
