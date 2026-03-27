import {
  IsInt,
  IsEnum,
  IsOptional,
  ValidateNested,
  IsArray,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ConfidenceLevel } from '../enums';

export class SubmitAnswerDto {
  @ApiProperty({ description: 'ID của câu hỏi', example: 123 })
  @IsInt()
  questionId: number;

  @ApiProperty({
    description: 'Đáp án người dùng chọn',
    enum: ['A', 'B', 'C', 'D'],
    example: 'A',
  })
  @IsEnum(['A', 'B', 'C', 'D'])
  answer: string;

  @ApiProperty({
    description: 'Độ tự tin khi trả lời',
    enum: ConfidenceLevel,
    example: ConfidenceLevel.CONFIDENT,
  })
  @IsEnum(ConfidenceLevel)
  confidence: ConfidenceLevel;

  @ApiProperty({
    description: 'Thời gian trả lời câu này (giây)',
    required: false,
    example: 45,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  timeSpentSeconds?: number;

  @ApiProperty({
    description: 'Người dùng có thay đổi đáp án không',
    required: false,
    example: false,
  })
  @IsOptional()
  wasChanged?: boolean;

  @ApiProperty({
    description: 'Số lần quay lại câu này',
    required: false,
    example: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  backtrackCount?: number;

  @ApiProperty({
    description: 'Thứ tự làm câu này (1, 2, 3...)',
    required: false,
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  sequenceOrder?: number;
}

export class SubmitExamAttemptDto {
  @ApiProperty({
    description: 'Danh sách câu trả lời',
    type: [SubmitAnswerDto],
  })
  @ValidateNested({ each: true })
  @Type(() => SubmitAnswerDto)
  @IsArray()
  answers: SubmitAnswerDto[];

  @ApiProperty({
    description: 'Tổng thời gian làm bài (giây)',
    example: 1800,
  })
  @IsInt()
  @Min(0)
  totalTimeSpentSeconds: number;

  @ApiProperty({
    description: 'Loại thiết bị',
    required: false,
    example: 'desktop',
  })
  @IsOptional()
  deviceType?: string;
}
