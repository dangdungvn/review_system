export class TrueFalseResponseDto {
  id: number;
  documentId: number;
  questionNumber: number;
  content: string;
  correctAnswer: boolean;
  explanation: string;
  createdAt: Date;
}
