import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import {
  UserKnowledgeState,
  UserAbility,
  UserLearningProfile,
  UserExamAttempt,
  UserFlashcardProgress,
} from '../entities';
import { Exam } from '../../exams/entities/exam.entity';
import { FlashcardSet } from '../../flashcards/entities/flashcard-set.entity';
import { RecommendationDto, ActivitySuggestionDto } from '../dto';
import { BayesianKnowledgeTracingService } from './bayesian-knowledge-tracing.service';
import { ItemResponseTheoryService } from './item-response-theory.service';
import { LearningStyle, FlashcardStatus } from '../enums';

interface RecommendationInput {
  userId: string;
  currentKnowledgeState: Map<string, UserKnowledgeState>;
  userAbility: UserAbility | null;
  learningProfile: UserLearningProfile | null;
  recentHistory: UserExamAttempt[];
}

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(
    @InjectRepository(UserKnowledgeState)
    private knowledgeStateRepo: Repository<UserKnowledgeState>,
    @InjectRepository(UserAbility)
    private abilityRepo: Repository<UserAbility>,
    @InjectRepository(UserLearningProfile)
    private profileRepo: Repository<UserLearningProfile>,
    @InjectRepository(UserExamAttempt)
    private attemptRepo: Repository<UserExamAttempt>,
    @InjectRepository(UserFlashcardProgress)
    private flashcardProgressRepo: Repository<UserFlashcardProgress>,
    @InjectRepository(Exam)
    private examRepo: Repository<Exam>,
    @InjectRepository(FlashcardSet)
    private flashcardSetRepo: Repository<FlashcardSet>,
    private bktService: BayesianKnowledgeTracingService,
    private irtService: ItemResponseTheoryService,
  ) {}

  /**
   * Get personalized recommendations for user
   */
  async getRecommendations(userId: string): Promise<RecommendationDto[]> {
    // Gather user state
    const input = await this.gatherUserState(userId);

    const recommendations: RecommendationDto[] = [];

    // 1. Review weak skills (mastery < 0.5)
    const weakSkillRecs = await this.getWeakSkillRecommendations(input);
    recommendations.push(...weakSkillRecs);

    // 2. Spaced repetition - due flashcards
    const flashcardRecs = await this.getDueFlashcardRecommendations(userId);
    recommendations.push(...flashcardRecs);

    // 3. New challenges (Zone of Proximal Development)
    const challengeRecs = await this.getNewChallengeRecommendations(input);
    recommendations.push(...challengeRecs);

    // 4. Review incorrect exams
    const retryRecs = await this.getRetryRecommendations(userId);
    recommendations.push(...retryRecs);

    // Sort by priority (implicit in order above)
    return recommendations;
  }

  /**
   * Get next suggested activity
   */
  async getNextActivity(userId: string): Promise<ActivitySuggestionDto | null> {
    const recommendations = await this.getRecommendations(userId);

    if (recommendations.length === 0) {
      // Suggest any exam
      const randomExam = await this.examRepo.findOne({
        where: {},
        order: { id: 'DESC' },
      });

      if (randomExam) {
        return {
          activityType: 'exam',
          activityId: randomExam.id,
          title: randomExam.title,
          description: 'Bắt đầu với bài thi này nhé!',
        };
      }

      return null;
    }

    const next = recommendations[0];

    return {
      activityType: next.type,
      activityId: next.itemId,
      title: next.title,
      description: next.reason,
    };
  }

  /**
   * Gather user state for recommendations
   */
  private async gatherUserState(
    userId: string,
  ): Promise<RecommendationInput> {
    const [knowledgeStates, ability, profile, recentHistory] =
      await Promise.all([
        this.bktService.getKnowledgeStates(userId),
        this.abilityRepo.findOne({ where: { userId } }),
        this.profileRepo.findOne({ where: { userId } }),
        this.attemptRepo.find({
          where: { userId },
          order: { createdAt: 'DESC' },
          take: 10,
        }),
      ]);

    return {
      userId,
      currentKnowledgeState: knowledgeStates,
      userAbility: ability,
      learningProfile: profile,
      recentHistory,
    };
  }

  /**
   * Recommend review for weak skills
   */
  private async getWeakSkillRecommendations(
    input: RecommendationInput,
  ): Promise<RecommendationDto[]> {
    const weakSkills = Array.from(input.currentKnowledgeState.entries())
      .filter(([_, state]) => Number(state.masteryProbability) < 0.5)
      .sort((a, b) => {
        const aProb = Number(a[1].masteryProbability);
        const bProb = Number(b[1].masteryProbability);
        return aProb - bProb;
      })
      .slice(0, 3);

    const recommendations: RecommendationDto[] = [];

    for (const [skillId, state] of weakSkills) {
      // Find flashcard set for this skill
      const flashcardSet = await this.flashcardSetRepo.findOne({
        where: {},
        order: { id: 'ASC' },
      });

      if (flashcardSet) {
        recommendations.push({
          type: 'flashcard',
          itemId: flashcardSet.id,
          title: `Ôn tập: ${flashcardSet.title}`,
          reason: 'Ôn lại để nắm vững kiến thức',
          estimatedTimeMinutes: 10,
        });
      }
    }

    return recommendations;
  }

  /**
   * Get due flashcards for spaced repetition
   */
  private async getDueFlashcardRecommendations(
    userId: string,
  ): Promise<RecommendationDto[]> {
    const now = new Date();
    const dueFlashcards = await this.flashcardProgressRepo.find({
      where: {
        userId,
        nextReviewAt: LessThan(now),
        status: FlashcardStatus.REVIEWING,
      },
      take: 5,
      relations: ['flashcard', 'flashcard.flashcardSet'],
    });

    return dueFlashcards.map((progress) => ({
      type: 'flashcard' as const,
      itemId: progress.flashcard.flashcardSetId,
      title: progress.flashcard.flashcardSet.title,
      reason: 'Đã đến lúc ôn lại',
      estimatedTimeMinutes: 5,
    }));
  }

  /**
   * Get new challenge recommendations (Zone of Proximal Development)
   */
  private async getNewChallengeRecommendations(
    input: RecommendationInput,
  ): Promise<RecommendationDto[]> {
    // Calculate optimal difficulty
    const theta = input.userAbility ? Number(input.userAbility.globalTheta) : 0;
    const targetDifficulty =
      this.irtService.calculateOptimalDifficulty(theta);

    // Adjust based on learning style
    let adjustedDifficulty = targetDifficulty;

    if (input.learningProfile) {
      const style = input.learningProfile.primaryStyle;

      if (style === LearningStyle.FAST_LEARNER) {
        adjustedDifficulty += 0.5; // Push harder
      } else if (style === LearningStyle.STRUGGLING) {
        adjustedDifficulty -= 0.3; // Gentler slope
      }
    }

    // Find exams not yet attempted
    const attemptedExamIds = input.recentHistory.map((h) => h.examId);

    const newExams = await this.examRepo.find({
      where: {},
      take: 3,
    });

    const unAttemptedExams = newExams.filter(
      (e) => !attemptedExamIds.includes(e.id),
    );

    return unAttemptedExams.slice(0, 2).map((exam) => ({
      type: 'exam' as const,
      itemId: exam.id,
      title: exam.title,
      reason: 'Thử sức với chủ đề mới',
      estimatedTimeMinutes: 30,
    }));
  }

  /**
   * Recommend retrying exams with low scores
   */
  private async getRetryRecommendations(
    userId: string,
  ): Promise<RecommendationDto[]> {
    const lowScoreAttempts = await this.attemptRepo
      .createQueryBuilder('attempt')
      .leftJoinAndSelect('attempt.exam', 'exam')
      .where('attempt.userId = :userId', { userId })
      .andWhere('attempt.score < 70')
      .orderBy('attempt.createdAt', 'DESC')
      .take(2)
      .getMany();

    return lowScoreAttempts.map((attempt) => ({
      type: 'exam' as const,
      itemId: attempt.examId,
      title: attempt.exam.title,
      reason: 'Thử lại để cải thiện điểm số',
      estimatedTimeMinutes: 30,
    }));
  }
}
