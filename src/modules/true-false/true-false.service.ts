import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { TrueFalseQuiz } from './entities/true-false-quiz.entity';
import { AiService } from '../ai/ai.service';
import { DocumentsService } from '../documents/documents.service';

@Injectable()
export class TrueFalseService {
  private readonly logger = new Logger(TrueFalseService.name);
  private readonly pendingGenerations = new Map<string, Promise<TrueFalseQuiz[]>>();

  constructor(
    @InjectRepository(TrueFalseQuiz)
    private readonly quizRepo: Repository<TrueFalseQuiz>,
    private readonly aiService: AiService,
    private readonly documentsService: DocumentsService,
  ) {}

  async generate(documentId: number, userId?: string): Promise<TrueFalseQuiz[]> {
    const document = await this.documentsService.findOne(documentId, userId);
    const ownerId = document.userId ?? userId ?? null;

    if (!document.extractedText) {
      throw new NotFoundException('Document has no extracted text');
    }

    const existingQuizzes = await this.findExistingQuizzes(documentId, ownerId);
    if (existingQuizzes.length > 0) {
      return existingQuizzes;
    }

    const generationKey = this.getGenerationKey(documentId, ownerId);
    const pendingGeneration = this.pendingGenerations.get(generationKey);
    if (pendingGeneration) {
      return pendingGeneration;
    }

    const generation = this.generateFreshQuizzes(
      documentId,
      document.extractedText,
      ownerId,
    ).finally(() => this.pendingGenerations.delete(generationKey));

    this.pendingGenerations.set(generationKey, generation);
    return generation;
  }

  private async generateFreshQuizzes(
    documentId: number,
    extractedText: string,
    ownerId: string | null,
  ): Promise<TrueFalseQuiz[]> {
    try {
      const result = await this.aiService.generateTrueFalse(
        extractedText,
        undefined,
        documentId,
      );

      const quizzes = result.questions.map((q) =>
        this.quizRepo.create({
          documentId,
          userId: ownerId,
          questionNumber: q.questionNumber,
          content: q.content,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
        }),
      );

      return this.quizRepo.save(quizzes);
    } catch (error) {
      this.logger.error(
        `Failed to generate true/false questions: ${this.getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  private findExistingQuizzes(documentId: number, ownerId: string | null) {
    return this.quizRepo.find({
      where: ownerId
        ? [{ documentId, userId: ownerId }, { documentId, userId: IsNull() }]
        : { documentId, userId: IsNull() },
      order: { questionNumber: 'ASC' },
    });
  }

  private getGenerationKey(documentId: number, ownerId: string | null) {
    return `${ownerId ?? 'anonymous'}:${documentId}`;
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  async findByDocument(documentId: number, userId?: string): Promise<TrueFalseQuiz[]> {
    await this.documentsService.findOne(documentId, userId);
    return this.quizRepo.find({
      where: userId
        ? [{ documentId, userId }, { documentId, userId: IsNull() }]
        : { documentId },
      order: { questionNumber: 'ASC' },
    });
  }
}
