import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { DocumentsService } from '../documents/documents.service';
import { DocumentSummary } from './entities/document-summary.entity';

@Injectable()
export class SummariesService {
  private readonly logger = new Logger(SummariesService.name);
  private readonly pendingGenerations = new Map<string, Promise<DocumentSummary>>();

  constructor(
    @InjectRepository(DocumentSummary)
    private readonly summaryRepo: Repository<DocumentSummary>,
    private readonly aiService: AiService,
    private readonly documentsService: DocumentsService,
  ) {}

  async generate(documentId: number, userId?: string): Promise<DocumentSummary> {
    const document = await this.documentsService.findOne(documentId, userId);
    const ownerId = document.userId ?? userId ?? null;

    if (!document.extractedText) {
      throw new NotFoundException('Document has no extracted text');
    }

    const existingSummary = await this.findExistingSummary(documentId, ownerId);
    if (existingSummary) {
      return existingSummary;
    }

    const generationKey = this.getGenerationKey(documentId, ownerId);
    const pendingGeneration = this.pendingGenerations.get(generationKey);
    if (pendingGeneration) {
      return pendingGeneration;
    }

    const generation = this.generateFreshSummary(
      documentId,
      document.title,
      document.extractedText,
      ownerId,
    ).finally(() => this.pendingGenerations.delete(generationKey));

    this.pendingGenerations.set(generationKey, generation);
    return generation;
  }

  private async generateFreshSummary(
    documentId: number,
    documentTitle: string,
    extractedText: string,
    ownerId: string | null,
  ): Promise<DocumentSummary> {
    try {
      const result = await this.aiService.generateSummary(
        extractedText,
        documentId,
      );

      const summary = this.summaryRepo.create({
        documentId,
        userId: ownerId,
        title: result.summaryTitle || `Tóm tắt - ${documentTitle}`,
        overview: result.overview,
        keyPoints: result.keyPoints ?? [],
        sections: result.sections ?? [],
        suggestedQuestions: result.suggestedQuestions ?? [],
      });

      return this.summaryRepo.save(summary);
    } catch (error) {
      this.logger.error(`Failed to generate summary: ${this.getErrorMessage(error)}`);
      throw error;
    }
  }

  private findExistingSummary(documentId: number, ownerId: string | null) {
    return this.summaryRepo.findOne({
      where: ownerId
        ? [{ documentId, userId: ownerId }, { documentId, userId: IsNull() }]
        : { documentId, userId: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  private getGenerationKey(documentId: number, ownerId: string | null) {
    return `${ownerId ?? 'anonymous'}:${documentId}`;
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  async findByDocument(documentId: number, userId?: string): Promise<DocumentSummary[]> {
    await this.documentsService.findOne(documentId, userId);
    return this.summaryRepo.find({
      where: userId
        ? [{ documentId, userId }, { documentId, userId: IsNull() }]
        : { documentId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number, userId?: string): Promise<DocumentSummary> {
    const summary = await this.summaryRepo.findOne({
      where: { id },
      relations: ['document'],
    });
    if (!summary || (userId && summary.userId !== userId && summary.document?.userId !== userId)) {
      throw new NotFoundException(`DocumentSummary #${id} not found`);
    }
    return summary;
  }
}
