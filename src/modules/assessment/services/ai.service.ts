import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { UserExamAttempt, UserLearningProfile } from '../entities';
import { UserAnswer } from '../entities/user-answer.entity';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
    } else {
      this.logger.warn('GEMINI_API_KEY not configured. AI features disabled.');
    }
  }

  /**
   * Generate personalized feedback for exam attempt
   */
  async generateFeedback(
    attempt: UserExamAttempt,
    profile?: UserLearningProfile,
  ): Promise<string> {
    if (!this.model) {
      return this.getFallbackFeedback(attempt.score);
    }

    try {
      const prompt = this.buildFeedbackPrompt(attempt, profile);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      this.logger.error('AI feedback generation failed', error);
      return this.getFallbackFeedback(attempt.score);
    }
  }

  /**
   * Build prompt for feedback generation
   */
  private buildFeedbackPrompt(
    attempt: UserExamAttempt,
    profile?: UserLearningProfile,
  ): string {
    const score = Number(attempt.score);
    const accuracy = (attempt.correctAnswers / attempt.totalQuestions) * 100;

    let profileInfo = '';
    if (profile) {
      profileInfo = `
User Learning Profile:
- Style: ${profile.primaryStyle}
- Learning Velocity: ${profile.learningVelocity}
- Persistence: ${profile.persistenceLevel}
- Focus: ${profile.focusScore}
`;
    }

    return `You are a supportive learning assistant. Generate friendly, encouraging feedback.

${profileInfo}

Recent Exam Attempt:
- Score: ${score}% (${attempt.correctAnswers}/${attempt.totalQuestions} correct)
- Time: ${attempt.totalTimeSpentSeconds} seconds
- Confidence breakdown:
  - Confident correct: ${attempt.confidentCorrect}
  - Uncertain correct: ${attempt.uncertainCorrect}
  - Guessing correct: ${attempt.guessingCorrect}

Generate a SHORT (1-2 sentences), personalized, encouraging message in Vietnamese.
DO NOT mention internal scores, percentages, or technical terms.
Focus on what to do next.
Be warm and supportive.

Examples:
- "Bạn làm rất tốt! Hãy thử những bài khó hơn để thách thức bản thân nhé."
- "Bạn đang tiến bộ từng ngày. Ôn lại một số phần sẽ giúp bạn tự tin hơn đấy!"
- "Đừng lo lắng! Mỗi bài tập là một cơ hội học hỏi. Thử xem lại flashcards nhé."

Generate feedback:`;
  }

  /**
   * Fallback feedback when AI is not available
   */
  private getFallbackFeedback(score: number): string {
    const numScore = Number(score);

    if (numScore >= 90) {
      return 'Xuất sắc! Bạn đã nắm vững kiến thức. Hãy thử những thử thách khó hơn nhé! 🎉';
    } else if (numScore >= 80) {
      return 'Bạn làm rất tốt! Tiếp tục duy trì phong độ này nhé! 💪';
    } else if (numScore >= 70) {
      return 'Bạn đang đi đúng hướng! Ôn lại một số phần để hiểu sâu hơn nhé.';
    } else if (numScore >= 60) {
      return 'Bạn đang cố gắng tốt! Hãy xem lại các flashcard để củng cố kiến thức.';
    } else if (numScore >= 50) {
      return 'Đừng nản chí! Học từ từ, mỗi ngày một chút. Bạn sẽ tiến bộ! 🌱';
    } else {
      return 'Mỗi thử thách là một cơ hội học hỏi. Hãy ôn lại kiến thức cơ bản nhé!';
    }
  }

  /**
   * Analyze error patterns to detect misconceptions
   */
  async analyzeMisconceptions(
    wrongAnswers: UserAnswer[],
  ): Promise<{ description: string; severity: number }[]> {
    if (!this.model || wrongAnswers.length === 0) {
      return [];
    }

    try {
      const prompt = `Analyze these wrong answers and identify common misconceptions:

${wrongAnswers
  .slice(0, 10) // Limit to 10 for token efficiency
  .map(
    (a, i) => `
Question ${i + 1}:
- User answered: ${a.userAnswer}
- Correct answer: ${a.correctAnswer}
- Confidence: ${a.confidence}
`,
  )
  .join('\n')}

Identify 1-3 key misconceptions in Vietnamese. For each misconception, provide:
1. Description (concise, actionable)
2. Severity (0.0 to 1.0)

Format as JSON array:
[
  {"description": "Nhầm lẫn giữa khái niệm A và B", "severity": 0.7},
  ...
]

Return only the JSON array, no other text.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return [];
    } catch (error) {
      this.logger.error('Misconception analysis failed', error);
      return [];
    }
  }

  /**
   * Generate motivational message
   */
  async generateMotivationalMessage(
    examsCompleted: number,
    currentStreak: number,
  ): Promise<string> {
    if (currentStreak >= 7) {
      return `Tuyệt vời! Bạn đã học ${currentStreak} ngày liên tiếp! 🔥`;
    } else if (currentStreak >= 3) {
      return `Bạn đang học rất đều đặn! Tiếp tục nhé! 💪`;
    } else if (examsCompleted >= 10) {
      return `Bạn đã hoàn thành ${examsCompleted} bài thi! Tuyệt vời! 🎉`;
    } else if (examsCompleted >= 5) {
      return `Đang tiến bộ từng ngày! Cố lên bạn nhé! 🌟`;
    } else {
      return `Hãy bắt đầu hành trình học tập của bạn! Mỗi bước đi đều quan trọng. 🚀`;
    }
  }
}
