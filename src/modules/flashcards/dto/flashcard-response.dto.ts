import { FlashcardSetStatus } from '../entities/flashcard-set.entity';

export class FlashcardSetResponseDto {
  id: number;
  documentId: number;
  title: string;
  totalCards: number;
  status: FlashcardSetStatus;
  createdAt: Date;
}

export class FlashcardResponseDto {
  id: number;
  front: string;
  back: string;
  order: number;
}

export class FlashcardSetDetailResponseDto extends FlashcardSetResponseDto {
  flashcards: FlashcardResponseDto[];
}
