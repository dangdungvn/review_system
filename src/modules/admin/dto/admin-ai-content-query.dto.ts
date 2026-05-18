import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ExamStatus } from '../../exams/entities/exam.entity';
import { FlashcardSetStatus } from '../../flashcards/entities/flashcard-set.entity';

export class AdminAiContentQueryDto {
  @ApiPropertyOptional({ description: 'Lọc theo documentId' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  documentId?: number;

  @ApiPropertyOptional({ description: 'Tìm theo tiêu đề/nội dung' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: ExamStatus })
  @IsOptional()
  @IsEnum(ExamStatus)
  examStatus?: ExamStatus;

  @ApiPropertyOptional({ enum: FlashcardSetStatus })
  @IsOptional()
  @IsEnum(FlashcardSetStatus)
  flashcardStatus?: FlashcardSetStatus;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
