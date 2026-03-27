import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { examPrompt } from './prompts/exam.prompt';
import { flashcardPrompt } from './prompts/flashcard.prompt';
import { trueFalsePrompt } from './prompts/true-false.prompt';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly model: string = 'gemini-3-flash-preview';

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY', '');
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  private async generate(systemPrompt: string, content: string): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: this.model });

    const truncatedContent =
      content.length > 30000 ? content.substring(0, 30000) : content;

    const result = await model.generateContent([
      systemPrompt,
      `NỘI DUNG TÀI LIỆU:\n\n${truncatedContent}`,
    ]);

    const text = result.response.text();
    // Remove markdown code blocks if present
    return text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  }

  async generateExam(
    extractedText: string,
    totalQuestions: number = 50,
  ): Promise<{
    questions: Array<{
      questionNumber: number;
      content: string;
      optionA: string;
      optionB: string;
      optionC: string;
      optionD: string;
      correctAnswer: string;
      explanation: string;
    }>;
  }> {
    this.logger.log(`Generating exam with ${totalQuestions} questions...`);
    const raw = await this.generate(examPrompt(totalQuestions), extractedText);
    return JSON.parse(raw);
  }

  async generateFlashcards(extractedText: string): Promise<{
    flashcards: Array<{
      front: string;
      back: string;
    }>;
  }> {
    this.logger.log('Generating flashcards...');
    const raw = await this.generate(flashcardPrompt(), extractedText);
    return JSON.parse(raw);
  }

  async generateTrueFalse(
    extractedText: string,
    totalQuestions: number = 30,
  ): Promise<{
    questions: Array<{
      questionNumber: number;
      content: string;
      correctAnswer: boolean;
      explanation: string;
    }>;
  }> {
    this.logger.log(`Generating ${totalQuestions} true/false questions...`);
    const raw = await this.generate(
      trueFalsePrompt(totalQuestions),
      extractedText,
    );
    return JSON.parse(raw);
  }
}
