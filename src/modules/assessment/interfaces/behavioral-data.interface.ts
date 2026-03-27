export interface ExamBehavioralData {
  // === Time-based signals ===
  totalTimeSpent: number;
  averageTimePerQuestion: number;
  timeDistribution: number[];
  rushingPattern: boolean;
  overthinkingPattern: boolean;

  // === Accuracy signals ===
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  changedAnswers: number;

  // === Confidence signals ===
  confidentCorrect: number;
  uncertainCorrect: number;
  guessingCorrect: number;
  confidenceCalibration: number;

  // === Pattern signals ===
  errorTypes: {
    conceptualErrors: number;
    carelessErrors: number;
    partialUnderstanding: number;
  };

  // === Sequence signals ===
  questionSequence: number[];
  backtrackingCount: number;
  firstAttemptAccuracy: number;

  // === Context signals ===
  timeOfDay: string;
  dayOfWeek: string;
  deviceType?: string;
  sessionNumber: number;

  // === Retry signals ===
  isRetry: boolean;
  retryNumber: number;
  improvementRate?: number;
  retryInterval?: number;
}

export interface DetectedIssues {
  hasGuessPattern: boolean;
  hasRushingPattern: boolean;
  hasGivingUpPattern: boolean;
  hasOverconfidencePattern: boolean;
  hasCheatingSuspicion: boolean;
}
