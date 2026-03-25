import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { FlashcardsService } from './flashcards.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Flashcards')
@Controller('flashcard-sets')
@Public() // Tạm thời public tất cả endpoints
export class FlashcardsController {
  constructor(private readonly flashcardsService: FlashcardsService) {}

  @Post('generate/:documentId')
  @ApiOperation({ summary: 'Sinh bộ flashcard từ tài liệu' })
  generate(@Param('documentId', ParseIntPipe) documentId: number) {
    return this.flashcardsService.generate(documentId);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách bộ flashcard theo tài liệu' })
  @ApiQuery({ name: 'documentId', required: true, type: Number })
  findByDocument(@Query('documentId', ParseIntPipe) documentId: number) {
    return this.flashcardsService.findByDocument(documentId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết bộ flashcard (kèm các card)' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.flashcardsService.findOne(id);
  }
}
