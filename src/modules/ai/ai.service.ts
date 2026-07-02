import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Repository } from 'typeorm';
import { examPrompt } from './prompts/exam.prompt';
import { flashcardPrompt } from './prompts/flashcard.prompt';
import { summaryPrompt } from './prompts/summary.prompt';
import { trueFalsePrompt } from './prompts/true-false.prompt';
import { AiSettingsService, EffectiveAiSettings } from './ai-settings.service';
import {
  AiContentType,
  AiGenerationLog,
  AiGenerationStatus,
} from './entities/ai-generation-log.entity';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly requestTimeoutMs = 180_000;
  private readonly retryDelaysMs = [750, 1500];

  constructor(
    private readonly aiSettingsService: AiSettingsService,
    @InjectRepository(AiGenerationLog)
    private readonly generationLogRepo: Repository<AiGenerationLog>,
  ) {}

  private async generate(
    systemPrompt: string,
    content: string,
    settings: EffectiveAiSettings,
  ): Promise<string> {
    const genAI = new GoogleGenerativeAI(settings.apiKey);
    const model = genAI.getGenerativeModel(
      { model: settings.model },
      { timeout: this.requestTimeoutMs },
    );

    const truncatedContent =
      content.length > settings.maxInputChars
        ? content.substring(0, settings.maxInputChars)
        : content;

    const result = await this.generateContentWithRetry(() =>
      model.generateContent([
        systemPrompt,
        `NỘI DUNG TÀI LIỆU:\n\n${truncatedContent}`,
      ]),
    );

    const text = result.response.text();
    // Remove markdown code blocks if present
    return text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
  }

  private async generateJson<T>(options: {
    contentType: AiContentType;
    documentId?: number;
    systemPrompt: string;
    extractedText: string;
    metadata?: Record<string, unknown>;
  }): Promise<T> {
    const settings = await this.aiSettingsService.getEffectiveSettings();
    const startedAt = Date.now();
    const truncatedChars = Math.max(
      0,
      options.extractedText.length - settings.maxInputChars,
    );
    let outputChars: number | null = null;

    try {
      if (!settings.apiKey) {
        throw new Error('GEMINI_API_KEY is not configured');
      }

      const raw = await this.generate(
        options.systemPrompt,
        options.extractedText,
        settings,
      );
      outputChars = raw.length;

      try {
        const parsed = JSON.parse(raw) as T;
        await this.writeGenerationLog({
          contentType: options.contentType,
          documentId: options.documentId,
          status: AiGenerationStatus.SUCCESS,
          settings,
          inputChars: options.extractedText.length,
          truncatedChars,
          outputChars,
          durationMs: Date.now() - startedAt,
          metadata: options.metadata,
        });
        return parsed;
      } catch (error) {
        await this.writeGenerationLog({
          contentType: options.contentType,
          documentId: options.documentId,
          status: AiGenerationStatus.FAILED,
          settings,
          inputChars: options.extractedText.length,
          truncatedChars,
          outputChars,
          durationMs: Date.now() - startedAt,
          errorType: 'parsing',
          errorMessage: this.getErrorMessage(error),
          metadata: options.metadata,
        });
        throw new BadGatewayException(
          'AI provider returned invalid JSON. Please try again.',
        );
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      await this.writeGenerationLog({
        contentType: options.contentType,
        documentId: options.documentId,
        status: AiGenerationStatus.FAILED,
        settings,
        inputChars: options.extractedText.length,
        truncatedChars,
        outputChars,
        durationMs: Date.now() - startedAt,
        errorType: this.getErrorName(error),
        errorMessage: this.getErrorMessage(error),
        metadata: options.metadata,
      });
      throw this.toClientException(error);
    }
  }

  private async generateContentWithRetry<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        const delayMs = this.retryDelaysMs[attempt];
        if (!delayMs || !this.isRetryableAiError(error)) {
          throw error;
        }

        this.logger.warn(
          `Gemini request failed (${this.getErrorMessage(
            error,
          )}); retrying in ${delayMs}ms`,
        );
        await this.sleep(delayMs);
      }
    }
  }

  private isRetryableAiError(error: unknown) {
    const errorLike = error as {
      status?: number;
      cause?: { code?: string; message?: string };
    };
    const status = errorLike.status;
    const message = this.getErrorMessage(error).toLowerCase();
    const causeCode = errorLike.cause?.code?.toLowerCase() ?? '';
    const causeMessage = errorLike.cause?.message?.toLowerCase() ?? '';

    return (
      (typeof status === 'number' && status >= 500) ||
      message.includes('fetch failed') ||
      message.includes('request aborted') ||
      causeMessage.includes('fetch failed') ||
      ['econnreset', 'etimedout', 'enotfound', 'eai_again'].includes(causeCode)
    );
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private toClientException(error: unknown) {
    const errorLike = error as { status?: number };
    const message = this.getErrorMessage(error);
    const normalizedMessage = message.toLowerCase();

    if (message.includes('GEMINI_API_KEY')) {
      return new ServiceUnavailableException(
        'Gemini API key is not configured',
      );
    }

    if (normalizedMessage.includes('api key not valid')) {
      return new BadRequestException('Gemini API key is invalid');
    }

    if (
      errorLike.status === 429 ||
      normalizedMessage.includes('too many requests') ||
      normalizedMessage.includes('exceeded your current quota')
    ) {
      return new HttpException(
        'Gemini quota or rate limit exceeded. Please check billing/quota or try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (errorLike.status === 503 || normalizedMessage.includes('high demand')) {
      return new ServiceUnavailableException(
        'Gemini model is currently overloaded. Please try again later.',
      );
    }

    return new ServiceUnavailableException(
      'AI provider is unavailable. Please try again.',
    );
  }

  private getErrorName(error: unknown) {
    return error instanceof Error && error.name ? error.name : 'generation';
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  private async writeGenerationLog(log: {
    contentType: AiContentType;
    documentId?: number;
    status: AiGenerationStatus;
    settings: EffectiveAiSettings;
    inputChars: number;
    truncatedChars: number;
    outputChars: number | null;
    durationMs: number;
    errorType?: string;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  }) {
    await this.generationLogRepo.save(
      this.generationLogRepo.create({
        contentType: log.contentType,
        documentId: log.documentId ?? null,
        status: log.status,
        model: log.settings.model,
        inputChars: log.inputChars,
        truncatedChars: log.truncatedChars,
        outputChars: log.outputChars,
        durationMs: log.durationMs,
        errorType: log.errorType ?? null,
        errorMessage: log.errorMessage ?? null,
        metadata: log.metadata ?? null,
      }),
    );
  }

  private renderPromptOverride(
    prompt: string,
    values: Record<string, unknown>,
  ) {
    return Object.entries(values).reduce(
      (result, [key, value]) =>
        result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), String(value)),
      prompt,
    );
  }

  async generateExam(
    extractedText: string,
    totalQuestions?: number,
    documentId?: number,
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
    const settings = await this.aiSettingsService.getEffectiveSettings();
    const questionCount = totalQuestions ?? settings.examTotalQuestions;
    this.logger.log(`Generating exam with ${questionCount} questions...`);

    return this.generateJson({
      contentType: AiContentType.EXAM,
      documentId,
      extractedText,
      systemPrompt: settings.promptOverrides.exam
        ? this.renderPromptOverride(settings.promptOverrides.exam, {
            totalQuestions: questionCount,
          })
        : examPrompt(questionCount),
      metadata: { totalQuestions: questionCount },
    });
  }

  async generateFlashcards(
    extractedText: string,
    documentId?: number,
  ): Promise<{
    flashcards: Array<{
      front: string;
      back: string;
    }>;
  }> {
    const settings = await this.aiSettingsService.getEffectiveSettings();
    this.logger.log('Generating flashcards...');

    return this.generateJson({
      contentType: AiContentType.FLASHCARDS,
      documentId,
      extractedText,
      systemPrompt: settings.promptOverrides.flashcards || flashcardPrompt(),
    });
  }

  async generateSummary(
    extractedText: string,
    documentId?: number,
  ): Promise<{
    summaryTitle: string;
    overview: string;
    keyPoints: string[];
    sections: Array<{
      heading: string;
      content: string;
    }>;
    suggestedQuestions: string[];
  }> {
    const settings = await this.aiSettingsService.getEffectiveSettings();
    this.logger.log('Generating document summary...');

    return this.generateJson({
      contentType: AiContentType.SUMMARY,
      documentId,
      extractedText,
      systemPrompt: settings.promptOverrides.summary || summaryPrompt(),
    });
  }

  async generateTrueFalse(
    extractedText: string,
    totalQuestions?: number,
    documentId?: number,
  ): Promise<{
    questions: Array<{
      questionNumber: number;
      content: string;
      correctAnswer: boolean;
      explanation: string;
    }>;
  }> {
    const settings = await this.aiSettingsService.getEffectiveSettings();
    const questionCount = totalQuestions ?? settings.trueFalseTotalQuestions;
    this.logger.log(`Generating ${questionCount} true/false questions...`);

    return this.generateJson({
      contentType: AiContentType.TRUE_FALSE,
      documentId,
      extractedText,
      systemPrompt: settings.promptOverrides.trueFalse
        ? this.renderPromptOverride(settings.promptOverrides.trueFalse, {
            totalQuestions: questionCount,
          })
        : trueFalsePrompt(questionCount),
      metadata: { totalQuestions: questionCount },
    });
  }
}
