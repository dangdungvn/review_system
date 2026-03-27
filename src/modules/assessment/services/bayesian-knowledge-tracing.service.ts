import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserKnowledgeState } from '../entities';
import { ConfidenceLevel } from '../enums';

export interface Observation {
  timestamp: Date;
  questionId: number;
  isCorrect: boolean;
  confidence: ConfidenceLevel;
  timeSpent: number;
  contextualFactors: {
    difficulty: number;
    timeOfDay: string;
    isRetry: boolean;
  };
}

@Injectable()
export class BayesianKnowledgeTracingService {
  private readonly logger = new Logger(BayesianKnowledgeTracingService.name);

  constructor(
    @InjectRepository(UserKnowledgeState)
    private knowledgeStateRepo: Repository<UserKnowledgeState>,
  ) {}

  /**
   * Update knowledge state for a skill based on observation
   * Uses Bayesian Knowledge Tracing (BKT) algorithm
   */
  async updateKnowledgeState(
    userId: string,
    skillId: string,
    observation: Observation,
  ): Promise<UserKnowledgeState> {
    // Get or create knowledge state
    let state = await this.knowledgeStateRepo.findOne({
      where: { userId, skillId },
    });

    if (!state) {
      state = this.knowledgeStateRepo.create({
        userId,
        skillId,
        masteryProbability: 0.3, // Prior: assume 30% initial mastery
        pLearn: 0.1, // Learning rate
        pGuess: 0.25, // Guessing probability (4 options)
        pSlip: 0.1, // Slip probability
        observationCount: 0,
        lastObservation: observation.timestamp,
      });
    }

    // Apply Bayesian update
    const updatedState = this.applyBKTUpdate(state, observation);

    // Save updated state
    state.masteryProbability = updatedState.masteryProbability;
    state.pLearn = updatedState.pLearn;
    state.observationCount += 1;
    state.lastObservation = observation.timestamp;

    return await this.knowledgeStateRepo.save(state);
  }

  /**
   * Apply BKT update formula
   */
  private applyBKTUpdate(
    state: UserKnowledgeState,
    observation: Observation,
  ): { masteryProbability: number; pLearn: number } {
    const { isCorrect, confidence, contextualFactors } = observation;
    const { difficulty } = contextualFactors;

    let P_L = Number(state.masteryProbability); // P(mastered)
    const P_T = Number(state.pLearn); // P(transition to mastered)
    let P_G = Number(state.pGuess); // P(guess correctly)
    const P_S = Number(state.pSlip); // P(slip - know but answer wrong)

    // Adjust guess probability based on confidence
    if (confidence === ConfidenceLevel.GUESSING) {
      P_G = 0.4; // Higher guess probability
    } else if (confidence === ConfidenceLevel.CONFIDENT) {
      P_G = 0.1; // Lower guess probability (not guessing)
    }

    // Calculate P(correct | current state)
    const P_correct_given_mastered = 1 - P_S;
    const P_correct_given_not_mastered = P_G;

    const P_correct =
      P_L * P_correct_given_mastered +
      (1 - P_L) * P_correct_given_not_mastered;

    // Bayesian update: P(mastered | observation)
    let P_L_given_obs: number;

    if (isCorrect) {
      // P(mastered | correct answer)
      P_L_given_obs =
        (P_L * P_correct_given_mastered) /
        (P_L * P_correct_given_mastered +
          (1 - P_L) * P_correct_given_not_mastered);
    } else {
      // P(mastered | incorrect answer)
      const P_incorrect_given_mastered = P_S;
      const P_incorrect_given_not_mastered = 1 - P_G;

      P_L_given_obs =
        (P_L * P_incorrect_given_mastered) /
        (P_L * P_incorrect_given_mastered +
          (1 - P_L) * P_incorrect_given_not_mastered);
    }

    // Apply learning: P(mastered after this observation)
    const P_L_next = P_L_given_obs + (1 - P_L_given_obs) * P_T;

    // Adjust learning rate based on confidence and difficulty
    let adjustedPLearn = P_T;

    if (isCorrect && confidence === ConfidenceLevel.CONFIDENT) {
      // Strong evidence of learning
      adjustedPLearn = Math.min(P_T * 1.5, 0.3);
    } else if (!isCorrect && confidence === ConfidenceLevel.CONFIDENT) {
      // Misconception detected - slower learning
      adjustedPLearn = P_T * 0.5;
    }

    // Clamp probabilities
    const finalMastery = Math.max(0, Math.min(1, P_L_next));

    return {
      masteryProbability: finalMastery,
      pLearn: adjustedPLearn,
    };
  }

  /**
   * Get knowledge states for a user
   */
  async getKnowledgeStates(
    userId: string,
  ): Promise<Map<string, UserKnowledgeState>> {
    const states = await this.knowledgeStateRepo.find({ where: { userId } });

    const map = new Map<string, UserKnowledgeState>();
    for (const state of states) {
      map.set(state.skillId, state);
    }

    return map;
  }

  /**
   * Get overall mastery score for user
   */
  async getOverallMastery(userId: string): Promise<number> {
    const states = await this.knowledgeStateRepo.find({ where: { userId } });

    if (states.length === 0) return 0;

    const totalMastery = states.reduce(
      (sum, state) => sum + Number(state.masteryProbability),
      0,
    );

    return totalMastery / states.length;
  }
}
