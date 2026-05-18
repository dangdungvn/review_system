import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { TrueFalseService } from './true-false.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('True/False')
@ApiBearerAuth('JWT')
@Controller('true-false')
export class TrueFalseController {
  constructor(private readonly trueFalseService: TrueFalseService) {}

  @Post('generate/:documentId')
  @ApiOperation({ summary: 'Sinh câu hỏi đúng/sai từ tài liệu' })
  generate(
    @Param('documentId', ParseIntPipe) documentId: number,
    @CurrentUser() user: any,
  ) {
    return this.trueFalseService.generate(documentId, user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách câu đúng/sai theo tài liệu' })
  @ApiQuery({ name: 'documentId', required: true, type: Number })
  findByDocument(
    @Query('documentId', ParseIntPipe) documentId: number,
    @CurrentUser() user: any,
  ) {
    return this.trueFalseService.findByDocument(documentId, user.userId);
  }
}
