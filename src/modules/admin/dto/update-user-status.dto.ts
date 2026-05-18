import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserStatusDto {
  @ApiProperty({ description: 'true để mở khóa, false để khóa tài khoản' })
  @IsBoolean()
  isActive: boolean;
}
