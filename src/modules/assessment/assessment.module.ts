import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssessmentController } from './assessment.controller';
import {
  AssessmentService,
  BayesianKnowledgeTracingService,
  ItemResponseTheoryService,
  AIService,
  RecommendationService,
} from './services';
import {
  UserExamAttempt,
  UserAnswer,
  UserKnowledgeState,
  UserAbility,
  QuestionIRTParams,
  UserLearningProfile,
  UserMisconception,
  UserTrueFalseAttempt,
  UserFlashcardProgress,
} from './entities';
import { Exam } from '../exams/entities/exam.entity';
import { ExamQuestion } from '../exams/entities/exam-question.entity';
import { Flashcard } from '../flashcards/entities/flashcard.entity';
import { FlashcardSet } from '../flashcards/entities/flashcard-set.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Assessment entities
      UserExamAttempt,
      UserAnswer,
      UserKnowledgeState,
      UserAbility,
      QuestionIRTParams,
      UserLearningProfile,
      UserMisconception,
      UserTrueFalseAttempt,
      UserFlashcardProgress,
      // External entities
      Exam,
      ExamQuestion,
      Flashcard,
      FlashcardSet,
    ]),
  ],
  controllers: [AssessmentController],
  providers: [
    AssessmentService,
    BayesianKnowledgeTracingService,
    ItemResponseTheoryService,
    AIService,
    RecommendationService,
  ],
  exports: [
    AssessmentService,
    BayesianKnowledgeTracingService,
    ItemResponseTheoryService,
    RecommendationService,
  ],
})
export class AssessmentModule {}
