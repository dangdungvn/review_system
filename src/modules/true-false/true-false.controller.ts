import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { TrueFalseService } from './true-false.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/interfaces/jwt-user.interface';

@ApiTags('True/False')
@ApiBearerAuth('JWT')
@Controller('true-false')
export class TrueFalseController {
  constructor(private readonly trueFalseService: TrueFalseService) {}

  @Post('generate/:documentId')
  @ApiOperation({ summary: 'Sinh câu hỏi đúng/sai từ tài liệu' })
  @ApiResponse({ status: 201, description: 'Câu hỏi được tạo thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập tài liệu' })
  generate(
    @Param('documentId', ParseIntPipe) documentId: number,
    @CurrentUser() user: JwtUser,
  ) {
    return this.trueFalseService.generate(documentId, user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách câu đúng/sai của tôi theo tài liệu' })
  @ApiQuery({ name: 'documentId', required: true, type: Number })
  @ApiResponse({ status: 200, description: 'Danh sách câu hỏi' })
  findByDocument(
    @Query('documentId', ParseIntPipe) documentId: number,
    @CurrentUser() user: JwtUser,
  ) {
    return this.trueFalseService.findByDocument(documentId, user.userId);
  }
}
