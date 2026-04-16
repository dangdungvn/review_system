import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThanOrEqual } from 'typeorm';
import {
  UserExamAttempt,
  UserAnswer,
  UserLearningProfile,
  UserFlashcardProgress,
} from '../entities';
import { Exam } from '../../exams/entities/exam.entity';
import {
  SubmitExamAttemptDto,
  ExamResultDto,
  UserProgressDto,
} from '../dto';
import { BayesianKnowledgeTracingService } from './bayesian-knowledge-tracing.service';
import { ItemResponseTheoryService } from './item-response-theory.service';
import { AIService } from './ai.service';
import { ConfidenceLevel, LearningStyle, FlashcardStatus } from '../enums';
import type { ExamBehavioralData } from '../interfaces/behavioral-data.interface';

@Injectable()
export class AssessmentService {
  private readonly logger = new Logger(AssessmentService.name);

  constructor(
    @InjectRepository(UserExamAttempt)
    private attemptRepo: Repository<UserExamAttempt>,
    @InjectRepository(UserLearningProfile)
    private profileRepo: Repository<UserLearningProfile>,
    @InjectRepository(UserFlashcardProgress)
    private flashcardProgressRepo: Repository<UserFlashcardProgress>,
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
        relations: ['questions'],
      });

      if (!exam) {
        throw new NotFoundException('Exam not found');
      }

      // 2. Calculate attempt number
      const previousAttempts = await manager.count(UserExamAttempt, {
        where: { userId, examId },
      });
      const attemptNumber = previousAttempts + 1;

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
      this.updateKnowledgeStatesAsync(userId, userAnswers).catch(
        (err) => this.logger.error('BKT update failed', err),
      );

      this.updateUserAbilityAsync(userId, userAnswers).catch((err) =>
        this.logger.error('IRT update failed', err),
      );

      this.updateQuestionParamsAsync(userId, userAnswers).catch((err) =>
        this.logger.error('Question IRT update failed', err),
      );

      this.updateLearningProfileAsync(userId, behavioralData).catch((err) =>
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
    metrics: {
      correctAnswers: number;
      score: number;
      confidentCorrect: number;
      uncertainCorrect: number;
      guessingCorrect: number;
    },
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
    answers: UserAnswer[],
  ): Promise<void> {
    for (const answer of answers) {
      const skillId = `exam_question_${answer.questionId}`;
      await this.bktService.updateKnowledgeState(userId, skillId, {
        timestamp: answer.answeredAt,
        questionId: answer.questionId,
        isCorrect: answer.isCorrect,
        confidence: answer.confidence,
        timeSpent: answer.timeSpentSeconds,
        contextualFactors: {
          difficulty: 0,
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
   * FIX: userId từ parameter, không cần load relation
   */
  private async updateQuestionParamsAsync(
    userId: string,
    answers: UserAnswer[],
  ): Promise<void> {
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
   * Classify learning style dựa trên behavioral data
   */
  private async updateLearningProfileAsync(
    userId: string,
    behavioralData: ExamBehavioralData,
  ): Promise<void> {
    let profile = await this.profileRepo.findOne({ where: { userId } });

    if (!profile) {
      profile = this.profileRepo.create({ userId });
    }

    // Classify learning style
    const style = this.classifyLearningStyle(behavioralData, profile);
    profile.primaryStyle = style;

    // Update behavioral characteristics
    profile.focusScore = Math.max(
      0,
      Math.min(1, 1 - behavioralData.backtrackingCount / 10),
    );
    profile.persistenceLevel = behavioralData.isRetry ? 0.8 : 0.5;
    profile.confidenceCalibration = behavioralData.confidenceCalibration;

    // Detect patterns
    const detectedIssues = {
      hasGuessPattern: behavioralData.guessingCorrect > 3,
      hasRushingPattern: behavioralData.rushingPattern,
      hasGivingUpPattern: behavioralData.skippedCount > 5,
      hasOverconfidencePattern:
        behavioralData.confidenceCalibration < 0.5 &&
        behavioralData.confidentCorrect > 2,
      hasCheatingSuspicion:
        behavioralData.averageTimePerQuestion < 5 &&
        (behavioralData.correctCount / (behavioralData.correctCount + behavioralData.incorrectCount)) > 0.9,
    };
    profile.detectedIssues = detectedIssues;

    await this.profileRepo.save(profile);
  }

  /**
   * Classify learning style từ behavioral data
   */
  private classifyLearningStyle(
    data: ExamBehavioralData,
    currentProfile: UserLearningProfile,
  ): LearningStyle {
    const accuracy =
      data.correctCount / (data.correctCount + data.incorrectCount);

    // Fast learner: cao accuracy, không retry nhiều, ít backtrack
    if (accuracy > 0.85 && !data.isRetry && data.backtrackingCount < 3) {
      return LearningStyle.FAST_LEARNER;
    }

    // Perfectionist: retry nhiều, accuracy cải thiện
    if (data.isRetry && data.retryNumber >= 3) {
      return LearningStyle.PERFECTIONIST;
    }

    // Rushing pattern
    if (data.rushingPattern) {
      return LearningStyle.SURFACE_LEARNER;
    }

    // Deep learner: overthinking, cao accuracy
    if (data.overthinkingPattern && accuracy > 0.7) {
      return LearningStyle.DEEP_LEARNER;
    }

    // Struggling: accuracy thấp
    if (accuracy < 0.5) {
      return LearningStyle.STRUGGLING;
    }

    // Steady improver
    if (data.isRetry && accuracy > Number(currentProfile.styleConfidence)) {
      return LearningStyle.STEADY_IMPROVER;
    }

    return currentProfile.primaryStyle === LearningStyle.UNKNOWN
      ? LearningStyle.STEADY_IMPROVER
      : currentProfile.primaryStyle;
  }

  /**
   * Get user progress - với real streak và flashcard mastery
   */
  async getUserProgress(userId: string): Promise<UserProgressDto> {
    const examsCompleted = await this.attemptRepo.count({
      where: { userId, isCompleted: true },
    });

    // Tính flashcard mastered (masteryLevel >= 0.8)
    const masteredFlashcards = await this.flashcardProgressRepo.count({
      where: {
        userId,
        status: FlashcardStatus.MASTERED,
      },
    });

    // Tính streak: đếm số ngày liên tiếp có activity
    const currentStreak = await this.calculateStreak(userId);

    // Tính average accuracy
    const attempts = await this.attemptRepo.find({
      where: { userId, isCompleted: true },
      select: ['score'],
    });
    const averageAccuracy =
      attempts.length > 0
        ? attempts.reduce((sum, a) => sum + Number(a.score), 0) / attempts.length
        : 0;

    const motivationalMessage =
      await this.aiService.generateMotivationalMessage(
        examsCompleted,
        currentStreak,
      );

    return {
      examsCompleted,
      flashcardsMastered: masteredFlashcards,
      currentStreak,
      motivationalMessage,
      averageAccuracy: Math.round(averageAccuracy * 10) / 10,
    };
  }

  /**
   * Tính daily streak bằng cách query lịch sử attempt
   */
  private async calculateStreak(userId: string): Promise<number> {
    // Lấy các attempt trong 30 ngày gần nhất, group by ngày
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const attempts = await this.attemptRepo.find({
      where: {
        userId,
        isCompleted: true,
        createdAt: MoreThanOrEqual(thirtyDaysAgo),
      },
      select: ['createdAt'],
      order: { createdAt: 'DESC' },
    });

    if (attempts.length === 0) return 0;

    // Lấy unique dates
    const uniqueDates = new Set<string>(
      attempts.map((a) => a.createdAt.toISOString().split('T')[0]),
    );

    // Kiểm tra từ hôm nay hoặc hôm qua
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    if (!uniqueDates.has(today) && !uniqueDates.has(yesterday)) {
      return 0; // Streak đã bị ngắt
    }

    // Đếm ngày liên tiếp
    let streak = 0;
    let currentDate = new Date();

    for (let i = 0; i < 30; i++) {
      const dateStr = currentDate.toISOString().split('T')[0];
      if (uniqueDates.has(dateStr)) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }
}
