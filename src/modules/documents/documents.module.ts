import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './entities/document.entity';
import { Exam } from '../exams/entities/exam.entity';
import { FlashcardSet } from '../flashcards/entities/flashcard-set.entity';
import { DocumentSummary } from '../summaries/entities/document-summary.entity';
import { TrueFalseQuiz } from '../true-false/entities/true-false-quiz.entity';
import { DocumentConversionService } from './document-conversion.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Document,
      Exam,
      FlashcardSet,
      DocumentSummary,
      TrueFalseQuiz,
    ]),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentConversionService],
  exports: [DocumentsService, DocumentConversionService],
})
export class DocumentsModule {}
