import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AiContentType,
  AiGenerationStatus,
} from '../../ai/entities/ai-generation-log.entity';

export class AdminAiLogQueryDto {
  @ApiPropertyOptional({ enum: AiContentType })
  @IsOptional()
  @IsEnum(AiContentType)
  contentType?: AiContentType;

  @ApiPropertyOptional({ enum: AiGenerationStatus })
  @IsOptional()
  @IsEnum(AiGenerationStatus)
  status?: AiGenerationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  documentId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

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

export class UpdateAiSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  maxInputChars?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  examTotalQuestions?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  trueFalseTotalQuestions?: number;

  @ApiPropertyOptional({ description: 'Prompt override, dùng {{totalQuestions}} nếu cần' })
  @IsOptional()
  @IsString()
  examPrompt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  flashcardPrompt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  summaryPrompt?: string;

  @ApiPropertyOptional({ description: 'Prompt override, dùng {{totalQuestions}} nếu cần' })
  @IsOptional()
  @IsString()
  trueFalsePrompt?: string;
}

export class UpdateAiApiKeyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  apiKey: string;
}
