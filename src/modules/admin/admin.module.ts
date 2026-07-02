import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { DocumentsModule } from '../documents/documents.module';
import { AdminAiContentService } from './admin-ai-content.service';
import { AdminAiMonitoringService } from './admin-ai-monitoring.service';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminController } from './admin.controller';
import { AdminDocumentsService } from './admin-documents.service';
import { AdminUsersService } from './admin-users.service';
import { Document } from '../documents/entities/document.entity';
import {
  UserAbility,
  UserExamAttempt,
  UserFlashcardProgress,
  UserKnowledgeState,
  UserLearningProfile,
  UserTrueFalseAttempt,
} from '../assessment/entities';
import { User } from '../users/entities/user.entity';
import { Exam } from '../exams/entities/exam.entity';
import { ExamQuestion } from '../exams/entities/exam-question.entity';
import { Flashcard } from '../flashcards/entities/flashcard.entity';
import { FlashcardSet } from '../flashcards/entities/flashcard-set.entity';
import { DocumentSummary } from '../summaries/entities/document-summary.entity';
import { TrueFalseQuiz } from '../true-false/entities/true-false-quiz.entity';
import { AiGenerationLog } from '../ai/entities/ai-generation-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Document,
      AiGenerationLog,
      Exam,
      ExamQuestion,
      DocumentSummary,
      Flashcard,
      FlashcardSet,
      TrueFalseQuiz,
      UserExamAttempt,
      UserAbility,
      UserLearningProfile,
      UserKnowledgeState,
      UserFlashcardProgress,
      UserTrueFalseAttempt,
    ]),
    AiModule,
    DocumentsModule,
  ],
  controllers: [AdminController],
  providers: [
    AdminUsersService,
    AdminDashboardService,
    AdminDocumentsService,
    AdminAiContentService,
    AdminAiMonitoringService,
  ],
})
export class AdminModule {}
