import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SummariesService } from './summaries.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Summaries')
@ApiBearerAuth('JWT')
@Controller('summaries')
export class SummariesController {
  constructor(private readonly summariesService: SummariesService) {}

  @Post('generate/:documentId')
  @ApiOperation({ summary: 'Sinh tóm tắt tài liệu từ nội dung PDF đã upload' })
  generate(
    @Param('documentId', ParseIntPipe) documentId: number,
    @CurrentUser() user: any,
  ) {
    return this.summariesService.generate(documentId, user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách tóm tắt theo tài liệu' })
  @ApiQuery({ name: 'documentId', required: true, type: Number })
  findByDocument(
    @Query('documentId', ParseIntPipe) documentId: number,
    @CurrentUser() user: any,
  ) {
    return this.summariesService.findByDocument(documentId, user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết tóm tắt tài liệu' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.summariesService.findOne(id, user.userId);
  }
}
