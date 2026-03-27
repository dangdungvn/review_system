import { ApiProperty } from '@nestjs/swagger';

export class ExamResultDto {
  @ApiProperty({ description: 'ID của lần làm bài' })
  attemptId: string;

  @ApiProperty({ description: 'Số câu trả lời đúng' })
  correctAnswers: number;

  @ApiProperty({ description: 'Tổng số câu hỏi' })
  totalQuestions: number;

  @ApiProperty({ description: 'Độ chính xác (%)', example: 75.5 })
  accuracy: number;

  @ApiProperty({ description: 'Thời gian làm bài (giây)' })
  timeSpent: number;

  @ApiProperty({ description: 'Phản hồi cá nhân hóa từ hệ thống' })
  feedback: string;

  @ApiProperty({ description: 'Số câu tự tin đúng', required: false })
  confidentCorrect?: number;

  @ApiProperty({ description: 'Số câu không chắc đúng', required: false })
  uncertainCorrect?: number;

  @ApiProperty({ description: 'Số câu đoán đúng', required: false })
  guessingCorrect?: number;
}

export class RecommendationDto {
  @ApiProperty({ description: 'Loại nội dung', enum: ['exam', 'flashcard', 'true_false'] })
  type: 'exam' | 'flashcard' | 'true_false';

  @ApiProperty({ description: 'ID của nội dung' })
  itemId: number;

  @ApiProperty({ description: 'Tiêu đề' })
  title: string;

  @ApiProperty({ description: 'Lý do đề xuất' })
  reason: string;

  @ApiProperty({ description: 'Thời gian ước tính (phút)' })
  estimatedTimeMinutes: number;
}

export class ActivitySuggestionDto {
  @ApiProperty({ description: 'Loại hoạt động' })
  activityType: string;

  @ApiProperty({ description: 'ID hoạt động' })
  activityId: number;

  @ApiProperty({ description: 'Tiêu đề' })
  title: string;

  @ApiProperty({ description: 'Mô tả' })
  description: string;
}

export class UserProgressDto {
  @ApiProperty({ description: 'Số bài thi đã hoàn thành' })
  examsCompleted: number;

  @ApiProperty({ description: 'Số flashcard đã master' })
  flashcardsMastered: number;

  @ApiProperty({ description: 'Chuỗi ngày học liên tiếp' })
  currentStreak: number;

  @ApiProperty({ description: 'Tin nhắn động viên' })
  motivationalMessage: string;

  @ApiProperty({ description: 'Độ chính xác trung bình (%)', required: false })
  averageAccuracy?: number;
}
