import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  UserExamAttempt,
  UserAnswer,
  UserLearningProfile,
} from '../entities';
import { Exam } from '../../exams/entities/exam.entity';
import { ExamQuestion } from '../../exams/entities/exam-question.entity';
import {
  SubmitExamAttemptDto,
  ExamResultDto,
  UserProgressDto,
} from '../dto';
import { BayesianKnowledgeTracingService } from './bayesian-knowledge-tracing.service';
import { ItemResponseTheoryService } from './item-response-theory.service';
import { AIService } from './ai.service';
import { ConfidenceLevel } from '../enums';
import type { ExamBehavioralData } from '../interfaces/behavioral-data.interface';

@Injectable()
export class AssessmentService {
  private readonly logger = new Logger(AssessmentService.name);

  constructor(
    @InjectRepository(UserExamAttempt)
    private attemptRepo: Repository<UserExamAttempt>,
    @InjectRepository(UserAnswer)
    private answerRepo: Repository<UserAnswer>,
    @InjectRepository(Exam)
    private examRepo: Repository<Exam>,
    @InjectRepository(UserLearningProfile)
    private profileRepo: Repository<UserLearningProfile>,
    private dataSource: DataSource,
    private bktService: BayesianKnowledgeTracingService,
    private irtService: ItemResponseTheoryService,
    private aiService: AIService,
  ) {}

  /**
   * Submit exam attempt with full behavioral tracking
   */
  async submitExamAttempt(
    userId: string,
    examId: number,
    dto: SubmitExamAttemptDto,
  ): Promise<ExamResultDto> {
    return await this.dataSource.transaction(async (manager) => {
      // 1. Get exam with questions
      const exam = await manager.findOne(Exam, {
        where: { id: examId },
        relations: ['questions', 'document'],
      });

      if (!exam || exam.document?.userId !== userId) {
        throw new NotFoundException('Exam not found');
      }

      // 2. Calculate attempt number
      const previousAttempts = await manager.count(UserExamAttempt, {
        where: { userId, examId },
      });
      const attemptNumber = previousAttempts + 1;
      const isFirstAttempt = attemptNumber === 1;

      // 3. Process answers and calculate metrics
      const metrics = this.calculateMetrics(exam, dto);

      // 4. Extract behavioral signals
      const behavioralData = this.extractBehavioralSignals(
        dto,
        metrics,
        attemptNumber,
      );

      // 5. Create attempt record
      const attempt = manager.create(UserExamAttempt, {
        userId,
        examId,
        attemptNumber,
        score: metrics.score,
        correctAnswers: metrics.correctAnswers,
        totalQuestions: exam.totalQuestions,
        totalTimeSpentSeconds: dto.totalTimeSpentSeconds,
        averageTimePerQuestion:
          dto.totalTimeSpentSeconds / exam.totalQuestions,
        confidentCorrect: metrics.confidentCorrect,
        uncertainCorrect: metrics.uncertainCorrect,
        guessingCorrect: metrics.guessingCorrect,
        behavioralData,
        isCompleted: true,
        completedAt: new Date(),
      });

      await manager.save(attempt);

      // 6. Save individual answers
      const userAnswers: UserAnswer[] = [];
      for (const answerDto of dto.answers) {
        const question = exam.questions.find(
          (q) => q.id === answerDto.questionId,
        );
        if (!question) continue;

        const isCorrect = answerDto.answer === question.correctAnswer;

        userAnswers.push(
          manager.create(UserAnswer, {
            attemptId: attempt.id,
            questionId: question.id,
            userAnswer: answerDto.answer,
            correctAnswer: question.correctAnswer,
            isCorrect,
            confidence: answerDto.confidence,
            timeSpentSeconds: answerDto.timeSpentSeconds || 0,
            wasChanged: answerDto.wasChanged || false,
            backtrackCount: answerDto.backtrackCount || 0,
            sequenceOrder: answerDto.sequenceOrder || null,
          }),
        );
      }

      await manager.save(userAnswers);

      // 7. Get user profile for feedback
      const profile = await manager.findOne(UserLearningProfile, {
        where: { userId },
      });

      // 8. Generate AI feedback
      const feedback = await this.aiService.generateFeedback(
        attempt,
        profile || undefined,
      );

      // === ASYNC UPDATES (don't block response) ===
      // Run in background
      this.updateKnowledgeStatesAsync(userId, attempt.id, userAnswers).catch(
        (err) => this.logger.error('BKT update failed', err),
      );

      this.updateUserAbilityAsync(userId, userAnswers).catch((err) =>
        this.logger.error('IRT update failed', err),
      );

      this.updateQuestionParamsAsync(userAnswers).catch((err) =>
        this.logger.error('Question IRT update failed', err),
      );

      this.updateLearningProfileAsync(userId).catch((err) =>
        this.logger.error('Profile update failed', err),
      );

      // 9. Return result
      return {
        attemptId: attempt.id,
        correctAnswers: metrics.correctAnswers,
        totalQuestions: exam.totalQuestions,
        accuracy: metrics.score,
        timeSpent: dto.totalTimeSpentSeconds,
        feedback,
        confidentCorrect: metrics.confidentCorrect,
        uncertainCorrect: metrics.uncertainCorrect,
        guessingCorrect: metrics.guessingCorrect,
      };
    });
  }

  /**
   * Calculate basic metrics
   */
  private calculateMetrics(
    exam: Exam,
    dto: SubmitExamAttemptDto,
  ): {
    correctAnswers: number;
    score: number;
    confidentCorrect: number;
    uncertainCorrect: number;
    guessingCorrect: number;
  } {
    let correctAnswers = 0;
    let confidentCorrect = 0;
    let uncertainCorrect = 0;
    let guessingCorrect = 0;

    for (const answerDto of dto.answers) {
      const question = exam.questions.find(
        (q) => q.id === answerDto.questionId,
      );
      if (!question) continue;

      const isCorrect = answerDto.answer === question.correctAnswer;

      if (isCorrect) {
        correctAnswers++;

        switch (answerDto.confidence) {
          case ConfidenceLevel.CONFIDENT:
            confidentCorrect++;
            break;
          case ConfidenceLevel.UNCERTAIN:
            uncertainCorrect++;
            break;
          case ConfidenceLevel.GUESSING:
            guessingCorrect++;
            break;
        }
      }
    }

    const score = (correctAnswers / exam.totalQuestions) * 100;

    return {
      correctAnswers,
      score,
      confidentCorrect,
      uncertainCorrect,
      guessingCorrect,
    };
  }

  /**
   * Extract behavioral signals
   */
  private extractBehavioralSignals(
    dto: SubmitExamAttemptDto,
    metrics: any,
    attemptNumber: number,
  ): ExamBehavioralData {
    const avgTime = dto.totalTimeSpentSeconds / dto.answers.length;
    const timeDistribution = dto.answers.map((a) => a.timeSpentSeconds || 0);

    // Detect patterns
    const rushingPattern = timeDistribution.filter((t) => t < 10).length >= 5;
    const overthinkingPattern = timeDistribution.filter((t) => t > 300).length >= 3;

    const changedAnswers = dto.answers.filter((a) => a.wasChanged).length;
    const totalBacktracking = dto.answers.reduce(
      (sum, a) => sum + (a.backtrackCount || 0),
      0,
    );

    const now = new Date();
    const hour = now.getHours();
    let timeOfDay = 'morning';
    if (hour >= 12 && hour < 18) timeOfDay = 'afternoon';
    else if (hour >= 18) timeOfDay = 'evening';

    return {
      totalTimeSpent: dto.totalTimeSpentSeconds,
      averageTimePerQuestion: avgTime,
      timeDistribution,
      rushingPattern,
      overthinkingPattern,
      correctCount: metrics.correctAnswers,
      incorrectCount: dto.answers.length - metrics.correctAnswers,
      skippedCount: 0,
      changedAnswers,
      confidentCorrect: metrics.confidentCorrect,
      uncertainCorrect: metrics.uncertainCorrect,
      guessingCorrect: metrics.guessingCorrect,
      confidenceCalibration:
        metrics.confidentCorrect > 0
          ? metrics.confidentCorrect /
            (metrics.confidentCorrect +
              metrics.uncertainCorrect +
              metrics.guessingCorrect)
          : 0,
      errorTypes: {
        conceptualErrors: 0,
        carelessErrors: 0,
        partialUnderstanding: 0,
      },
      questionSequence: dto.answers.map((a) => a.sequenceOrder || 0),
      backtrackingCount: totalBacktracking,
      firstAttemptAccuracy: metrics.score,
      timeOfDay,
      dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
      deviceType: dto.deviceType,
      sessionNumber: 1,
      isRetry: attemptNumber > 1,
      retryNumber: attemptNumber,
    };
  }

  /**
   * Update knowledge states (BKT) - async
   */
  private async updateKnowledgeStatesAsync(
    userId: string,
    attemptId: string,
    answers: UserAnswer[],
  ): Promise<void> {
    for (const answer of answers) {
      // Map question to skill (simplified: use examId as skill)
      const skillId = `exam_question_${answer.questionId}`;

      await this.bktService.updateKnowledgeState(userId, skillId, {
        timestamp: answer.answeredAt,
        questionId: answer.questionId,
        isCorrect: answer.isCorrect,
        confidence: answer.confidence,
        timeSpent: answer.timeSpentSeconds,
        contextualFactors: {
          difficulty: 0, // TODO: get from IRT
          timeOfDay: 'morning',
          isRetry: false,
        },
      });
    }
  }

  /**
   * Update user ability (IRT) - async
   */
  private async updateUserAbilityAsync(
    userId: string,
    answers: UserAnswer[],
  ): Promise<void> {
    for (const answer of answers) {
      await this.irtService.updateAbility(userId, answer);
    }
  }

  /**
   * Update question IRT params - async
   */
  private async updateQuestionParamsAsync(
    answers: UserAnswer[],
  ): Promise<void> {
    // Get user ability first
    const userId = answers[0]?.attempt?.userId;
    if (!userId) return;

    const ability = await this.irtService.getUserAbility(userId);
    const theta = ability ? Number(ability.globalTheta) : 0;

    for (const answer of answers) {
      await this.irtService.updateQuestionParams(
        answer.questionId,
        'exam',
        answer.isCorrect,
        answer.timeSpentSeconds,
        theta,
      );
    }
  }

  /**
   * Update learning profile - async
   */
  private async updateLearningProfileAsync(userId: string): Promise<void> {
    // TODO: Implement learning style classification
    // For now, just ensure profile exists
    let profile = await this.profileRepo.findOne({ where: { userId } });

    if (!profile) {
      profile = this.profileRepo.create({
        userId,
      });
      await this.profileRepo.save(profile);
    }
  }

  /**
   * Get user progress
   */
  async getUserProgress(userId: string): Promise<UserProgressDto> {
    const examsCompleted = await this.attemptRepo.count({
      where: { userId, isCompleted: true },
    });

    // TODO: Get actual flashcard mastery count
    const flashcardsMastered = 0;

    // TODO: Calculate actual streak
    const currentStreak = 0;

    const motivationalMessage =
      await this.aiService.generateMotivationalMessage(
        examsCompleted,
        currentStreak,
      );

    return {
      examsCompleted,
      flashcardsMastered,
      currentStreak,
      motivationalMessage,
    };
  }
  async getReviewActivities(userId: string) {
    const [examAttempts, trueFalseAttempts, flashcardProgress] =
      await Promise.all([
        this.dataSource.query(
          `
            SELECT
              attempt.id,
              attempt.examId,
              attempt.score,
              attempt.correctAnswers,
              attempt.totalQuestions,
              attempt.totalTimeSpentSeconds,
              attempt.created_at,
              attempt.completedAt,
              exam.title AS exerciseTitle,
              document.id AS documentId,
              document.title AS subjectTitle
            FROM user_exam_attempts attempt
            INNER JOIN exams exam ON exam.id = attempt.examId
            INNER JOIN documents document ON document.id = exam.documentId
            WHERE attempt.userId = ?
            ORDER BY COALESCE(attempt.completedAt, attempt.created_at) DESC
          `,
          [userId],
        ),
        this.dataSource.query(
          `
            SELECT
              attempt.id,
              attempt.quizId,
              attempt.isCorrect,
              attempt.reactionTimeMs,
              attempt.answered_at,
              quiz.questionNumber,
              document.id AS documentId,
              document.title AS subjectTitle
            FROM user_true_false_attempts attempt
            INNER JOIN true_false_quizzes quiz ON quiz.id = attempt.quizId
            INNER JOIN documents document ON document.id = quiz.documentId
            WHERE attempt.userId = ?
            ORDER BY attempt.answered_at DESC
          `,
          [userId],
        ),
        this.dataSource.query(
          `
            SELECT
              progress.id,
              progress.flashcardId,
              progress.correctCount,
              progress.totalReviews,
              progress.masteryLevel,
              progress.lastReviewedAt,
              progress.updated_at,
              flashcardSet.id AS flashcardSetId,
              flashcardSet.title AS exerciseTitle,
              document.id AS documentId,
              document.title AS subjectTitle
            FROM user_flashcard_progress progress
            INNER JOIN flashcards flashcard ON flashcard.id = progress.flashcardId
            INNER JOIN flashcard_sets flashcardSet ON flashcardSet.id = flashcard.flashcardSetId
            INNER JOIN documents document ON document.id = flashcardSet.documentId
            WHERE progress.userId = ?
            ORDER BY COALESCE(progress.lastReviewedAt, progress.updated_at) DESC
          `,
          [userId],
        ),
      ]);

    const activities = [
      ...examAttempts.map((attempt: any) => {
        const completedAt = attempt.completedAt ?? attempt.created_at;
        const durationSeconds = Number(attempt.totalTimeSpentSeconds) || 0;
        const startedAt = new Date(
          new Date(completedAt).getTime() - durationSeconds * 1000,
        );
        const correctCount = Number(attempt.correctAnswers) || 0;
        const totalItems = Number(attempt.totalQuestions) || 0;

        return {
          id: `exam-attempt-${attempt.id}`,
          type: 'quiz',
          subjectId: String(attempt.documentId),
          subjectTitle: attempt.subjectTitle,
          exerciseId: String(attempt.examId),
          exerciseTitle: attempt.exerciseTitle,
          documentId: String(attempt.documentId),
          startedAt: startedAt.toISOString(),
          completedAt: new Date(completedAt).toISOString(),
          durationSeconds,
          progress: 100,
          score: Number(attempt.score) || 0,
          correctCount,
          wrongCount: Math.max(0, totalItems - correctCount),
          blankCount: 0,
          totalItems,
        };
      }),
      ...trueFalseAttempts.map((attempt: any) => {
        const isCorrect = Boolean(Number(attempt.isCorrect));

        return {
          id: `true-false-attempt-${attempt.id}`,
          type: 'quiz',
          subjectId: String(attempt.documentId),
          subjectTitle: attempt.subjectTitle,
          exerciseId: String(attempt.quizId),
          exerciseTitle: `Câu dúng/sai ${attempt.questionNumber}`,
          documentId: String(attempt.documentId),
          startedAt: new Date(attempt.answered_at).toISOString(),
          completedAt: new Date(attempt.answered_at).toISOString(),
          durationSeconds: Math.max(
            1,
            Math.round((Number(attempt.reactionTimeMs) || 0) / 1000),
          ),
          progress: 100,
          score: isCorrect ? 100 : 0,
          correctCount: isCorrect ? 1 : 0,
          wrongCount: isCorrect ? 0 : 1,
          blankCount: 0,
          totalItems: 1,
        };
      }),
      ...flashcardProgress.map((progress: any) => {
        const completedAt = progress.lastReviewedAt ?? progress.updated_at;
        const totalItems = Number(progress.totalReviews) || 0;
        const correctCount = Number(progress.correctCount) || 0;

        return {
          id: `flashcard-progress-${progress.id}`,
          type: 'flashcard',
          subjectId: String(progress.documentId),
          subjectTitle: progress.subjectTitle,
          exerciseId: String(progress.flashcardSetId),
          exerciseTitle: progress.exerciseTitle,
          documentId: String(progress.documentId),
          startedAt: new Date(completedAt).toISOString(),
          completedAt: new Date(completedAt).toISOString(),
          durationSeconds: Math.max(30, totalItems * 45),
          progress: Math.round((Number(progress.masteryLevel) || 0) * 100),
          score: Math.round((Number(progress.masteryLevel) || 0) * 100),
          correctCount,
          wrongCount: Math.max(0, totalItems - correctCount),
          blankCount: 0,
          totalItems,
        };
      }),
    ];

    return activities.sort(
      (left, right) =>
        new Date(right.completedAt).getTime() -
        new Date(left.completedAt).getTime(),
    );
  }
}