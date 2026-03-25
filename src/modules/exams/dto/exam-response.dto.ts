import { ExamStatus } from '../entities/exam.entity';

export class ExamResponseDto {
  id: number;
  documentId: number;
  title: string;
  totalQuestions: number;
  status: ExamStatus;
  createdAt: Date;
}

export class ExamQuestionResponseDto {
  id: number;
  questionNumber: number;
  content: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  explanation: string;
}

export class ExamDetailResponseDto extends ExamResponseDto {
  questions: ExamQuestionResponseDto[];
}
