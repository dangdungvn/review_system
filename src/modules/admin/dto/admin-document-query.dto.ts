import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentStatus } from '../../documents/entities/document.entity';

export class AdminDocumentQueryDto {
  @ApiPropertyOptional({ description: 'Tìm theo tiêu đề hoặc tên file' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: DocumentStatus })
  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @ApiPropertyOptional({ description: 'Ngày upload từ, ISO date' })
  @IsOptional()
  @IsDateString()
  uploadedFrom?: string;

  @ApiPropertyOptional({ description: 'Ngày upload đến, ISO date' })
  @IsOptional()
  @IsDateString()
  uploadedTo?: string;

  @ApiPropertyOptional({ description: 'Kích thước file nhỏ nhất, bytes' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minSize?: number;

  @ApiPropertyOptional({ description: 'Kích thước file lớn nhất, bytes' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxSize?: number;

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
