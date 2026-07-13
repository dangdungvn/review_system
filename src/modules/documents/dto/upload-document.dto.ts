import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UploadDocumentDto {
  @ApiPropertyOptional({ description: 'Tên tài liệu (nếu không truyền sẽ lấy tên file)' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Mô tả tài liệu / môn học' })
  @IsOptional()
  @IsString()
  description?: string;
}
