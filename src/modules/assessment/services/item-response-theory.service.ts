import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserAbility, QuestionIRTParams } from '../entities';
import { UserAnswer } from '../entities/user-answer.entity';

@Injectable()
export class ItemResponseTheoryService {
  private readonly logger = new Logger(ItemResponseTheoryService.name);

  constructor(
    @InjectRepository(UserAbility)
    private abilityRepo: Repository<UserAbility>,
    @InjectRepository(QuestionIRTParams)
    private questionParamsRepo: Repository<QuestionIRTParams>,
  ) {}

  /**
   * Calculate probability of correct answer using 3PL IRT model
   * P(correct) = c + (1-c) / (1 + exp(-a*(θ - b)))
   */
  calculateProbability(
    theta: number, // User ability
    difficulty: number, // b parameter
    discrimination: number, // a parameter
    guessing: number, // c parameter
  ): number {
    return (
      guessing +
      (1 - guessing) /
        (1 + Math.exp(-discrimination * (theta - difficulty)))
    );
  }

  /**
   * Update user ability based on answer
   * Uses simplified Maximum Likelihood Estimation (MLE)
   */
  async updateAbility(userId: string, answer: UserAnswer): Promise<UserAbility> {
    // Get or create user ability
    let ability = await this.abilityRepo.findOne({ where: { userId } });

    if (!ability) {
      ability = this.abilityRepo.create({
        userId,
        globalTheta: 0, // Start at average ability
        standardError: 1,
        topicThetas: null, // Will be initialized as empty object on first use
        totalObservations: 0,
      });
    }

    // Initialize topicThetas if null
    if (!ability.topicThetas) {
      ability.topicThetas = {};
    }

    // Get question IRT parameters
    const questionParams = await this.getOrEstimateQuestionParams(
      answer.questionId,
      'exam',
    );

    // Apply IRT update
    const newTheta = this.applyIRTUpdate(
      Number(ability.globalTheta),
      answer.isCorrect,
      Number(questionParams.difficulty),
      Number(questionParams.discrimination),
      Number(questionParams.guessing),
    );

    ability.globalTheta = newTheta;
    ability.totalObservations += 1;

    // Update standard error (decreases with more observations)
    ability.standardError = Math.max(
      0.3,
      1 / Math.sqrt(ability.totalObservations),
    );

    return await this.abilityRepo.save(ability);
  }

  /**
   * Apply IRT update using simplified MLE
   */
  private applyIRTUpdate(
    currentTheta: number,
    isCorrect: boolean,
    difficulty: number,
    discrimination: number,
    guessing: number,
  ): number {
    // Calculate expected probability
    const expectedProb = this.calculateProbability(
      currentTheta,
      difficulty,
      discrimination,
      guessing,
    );

    // Calculate error
    const observed = isCorrect ? 1 : 0;
    const error = observed - expectedProb;

    // Update theta (gradient ascent)
    // Learning rate = 0.1
    const learningRate = 0.1;
    const gradient = discrimination * error;

    const newTheta = currentTheta + learningRate * gradient;

    // Clamp theta to reasonable range [-3, 3]
    return Math.max(-3, Math.min(3, newTheta));
  }

  /**
   * Get or estimate question IRT parameters
   */
  async getOrEstimateQuestionParams(
    questionId: number,
    questionType: string,
  ): Promise<QuestionIRTParams> {
    let params = await this.questionParamsRepo.findOne({
      where: { questionId, questionType },
    });

    if (!params) {
      // Initialize with default parameters
      params = this.questionParamsRepo.create({
        questionId,
        questionType,
        difficulty: 0, // Medium difficulty
        discrimination: 1, // Average discrimination
        guessing: 0.25, // 4 options = 25% guess rate
        attemptCount: 0,
        correctCount: 0,
        averageTime: 0,
      });

      params = await this.questionParamsRepo.save(params);
    }

    return params;
  }

  /**
   * Update question parameters based on user responses
   * (Simplified - in production, use proper calibration)
   */
  async updateQuestionParams(
    questionId: number,
    questionType: string,
    isCorrect: boolean,
    timeSpent: number,
    userTheta: number,
  ): Promise<void> {
    const params = await this.getOrEstimateQuestionParams(
      questionId,
      questionType,
    );

    // Update statistics
    params.attemptCount += 1;
    if (isCorrect) {
      params.correctCount += 1;
    }

    // Update average time
    params.averageTime =
      (Number(params.averageTime) * (params.attemptCount - 1) + timeSpent) /
      params.attemptCount;

    // Estimate difficulty from correct rate
    const correctRate = params.correctCount / params.attemptCount;

    // Convert correct rate to difficulty (simplified)
    // High correct rate = easy question (negative difficulty)
    // Low correct rate = hard question (positive difficulty)
    if (params.attemptCount >= 10) {
      // Only update after enough data
      params.difficulty = -Math.log(correctRate / (1 - correctRate));

      // Clamp to reasonable range
      params.difficulty = Math.max(-2, Math.min(2, params.difficulty));
    }

    await this.questionParamsRepo.save(params);
  }

  /**
   * Get user ability
   */
  async getUserAbility(userId: string): Promise<UserAbility | null> {
    return await this.abilityRepo.findOne({ where: { userId } });
  }

  /**
   * Calculate optimal difficulty for user (Zone of Proximal Development)
   */
  calculateOptimalDifficulty(theta: number): number {
    // Optimal challenge is slightly above current ability
    return theta + 0.5;
  }
}
