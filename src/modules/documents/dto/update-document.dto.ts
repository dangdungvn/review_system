import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateDocumentDto {
  @ApiPropertyOptional({ description: 'Tên tài liệu / môn học' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;
}
