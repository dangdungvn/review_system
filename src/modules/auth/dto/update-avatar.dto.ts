import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAvatarDto {
  @ApiProperty({
    description: 'Avatar dạng data URL base64. Gửi null hoặc chuỗi rỗng để xóa avatar.',
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2_200_000, { message: 'Ảnh avatar tối đa 1.5MB.' })
  avatarUrl?: string | null;
}
