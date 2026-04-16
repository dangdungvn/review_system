import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { FlashcardsService } from './flashcards.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/interfaces/jwt-user.interface';

@ApiTags('Flashcards')
@ApiBearerAuth('JWT')
@Controller('flashcard-sets')
export class FlashcardsController {
  constructor(private readonly flashcardsService: FlashcardsService) {}

  @Post('generate/:documentId')
  @ApiOperation({ summary: 'Sinh bộ flashcard từ tài liệu' })
  @ApiResponse({ status: 201, description: 'Bộ flashcard được tạo thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập tài liệu' })
  generate(
    @Param('documentId', ParseIntPipe) documentId: number,
    @CurrentUser() user: JwtUser,
  ) {
    return this.flashcardsService.generate(documentId, user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách bộ flashcard của tôi theo tài liệu' })
  @ApiQuery({ name: 'documentId', required: true, type: Number })
  @ApiResponse({ status: 200, description: 'Danh sách bộ flashcard' })
  findByDocument(
    @Query('documentId', ParseIntPipe) documentId: number,
    @CurrentUser() user: JwtUser,
  ) {
    return this.flashcardsService.findByDocument(documentId, user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết bộ flashcard (kèm các card)' })
  @ApiResponse({ status: 200, description: 'Chi tiết bộ flashcard' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtUser,
  ) {
    return this.flashcardsService.findOne(id, user.userId);
  }
}
