import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UploadDocumentDto {
  @ApiPropertyOptional({ description: 'Tên tài liệu (nếu không truyền sẽ lấy tên file)' })
  @IsOptional()
  @IsString()
  title?: string;
}
