export class TrueFalseResponseDto {
  id: number;
  documentId: number;
  userId: string | null;
  questionNumber: number;
  content: string;
  correctAnswer: boolean;
  explanation: string;
  createdAt: Date;
}
