import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { FlashcardsService } from './flashcards.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Flashcards')
@ApiBearerAuth('JWT')
@Controller('flashcard-sets')
export class FlashcardsController {
  constructor(private readonly flashcardsService: FlashcardsService) {}

  @Post('generate/:documentId')
  @ApiOperation({ summary: 'Sinh bộ flashcard từ tài liệu' })
  generate(
    @Param('documentId', ParseIntPipe) documentId: number,
    @CurrentUser() user: any,
  ) {
    return this.flashcardsService.generate(documentId, user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách bộ flashcard theo tài liệu' })
  @ApiQuery({ name: 'documentId', required: true, type: Number })
  findByDocument(
    @Query('documentId', ParseIntPipe) documentId: number,
    @CurrentUser() user: any,
  ) {
    return this.flashcardsService.findByDocument(documentId, user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết bộ flashcard (kèm các card)' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.flashcardsService.findOne(id, user.userId);
  }
}
