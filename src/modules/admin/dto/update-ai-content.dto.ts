import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ExamStatus } from '../../exams/entities/exam.entity';
import { FlashcardSetStatus } from '../../flashcards/entities/flashcard-set.entity';

export class UpdateExamDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ enum: ExamStatus })
  @IsOptional()
  @IsEnum(ExamStatus)
  status?: ExamStatus;
}

export class UpdateExamQuestionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  questionNumber?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  optionA?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  optionB?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  optionC?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  optionD?: string;

  @ApiPropertyOptional({ enum: ['A', 'B', 'C', 'D'] })
  @IsOptional()
  @IsIn(['A', 'B', 'C', 'D'])
  correctAnswer?: 'A' | 'B' | 'C' | 'D';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  explanation?: string;
}

export class UpdateFlashcardSetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ enum: FlashcardSetStatus })
  @IsOptional()
  @IsEnum(FlashcardSetStatus)
  status?: FlashcardSetStatus;
}

export class UpdateFlashcardDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  front?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  back?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  order?: number;
}

export class UpdateSummaryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  overview?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  keyPoints?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  sections?: Array<{ heading: string; content: string }>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  suggestedQuestions?: string[];
}

export class UpdateTrueFalseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  questionNumber?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  correctAnswer?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  explanation?: string;
}
