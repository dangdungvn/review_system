import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { FlashcardSet, FlashcardSetStatus } from './entities/flashcard-set.entity';
import { Flashcard } from './entities/flashcard.entity';
import { AiService } from '../ai/ai.service';
import { DocumentsService } from '../documents/documents.service';

@Injectable()
export class FlashcardsService {
  private readonly logger = new Logger(FlashcardsService.name);
  private readonly pendingGenerations = new Map<string, Promise<FlashcardSet>>();

  constructor(
    @InjectRepository(FlashcardSet)
    private readonly setRepo: Repository<FlashcardSet>,
    @InjectRepository(Flashcard)
    private readonly cardRepo: Repository<Flashcard>,
    private readonly aiService: AiService,
    private readonly documentsService: DocumentsService,
  ) {}

  async generate(documentId: number, userId?: string): Promise<FlashcardSet> {
    const document = await this.documentsService.findOne(documentId, userId);
    const ownerId = document.userId ?? userId ?? null;

    if (!document.extractedText) {
      throw new NotFoundException('Document has no extracted text');
    }

    const reusableSet = await this.findReusableSet(documentId, ownerId);
    if (reusableSet) {
      return reusableSet;
    }

    const generationKey = this.getGenerationKey(documentId, ownerId);
    const pendingGeneration = this.pendingGenerations.get(generationKey);
    if (pendingGeneration) {
      return pendingGeneration;
    }

    const generation = this.generateFreshSet(
      documentId,
      document.title,
      document.extractedText,
      ownerId,
    ).finally(() => this.pendingGenerations.delete(generationKey));

    this.pendingGenerations.set(generationKey, generation);
    return generation;
  }

  private async generateFreshSet(
    documentId: number,
    documentTitle: string,
    extractedText: string,
    ownerId: string | null,
  ): Promise<FlashcardSet> {
    const set = this.setRepo.create({
      documentId,
      userId: ownerId,
      title: `Flashcards - ${documentTitle}`,
      status: FlashcardSetStatus.GENERATING,
    });
    await this.setRepo.save(set);

    try {
      const result = await this.aiService.generateFlashcards(
        extractedText,
        documentId,
      );

      const cards = result.flashcards.map((f, index) =>
        this.cardRepo.create({
          flashcardSetId: set.id,
          front: f.front,
          back: f.back,
          order: index + 1,
        }),
      );

      await this.cardRepo.save(cards);
      set.totalCards = cards.length;
      set.status = FlashcardSetStatus.COMPLETED;
    } catch (error) {
      this.logger.error(`Failed to generate flashcards: ${this.getErrorMessage(error)}`);
      set.status = FlashcardSetStatus.FAILED;
    }

    return this.setRepo.save(set);
  }

  private async findReusableSet(
    documentId: number,
    ownerId: string | null,
  ): Promise<FlashcardSet | null> {
    const recentGeneratingCutoff = new Date(Date.now() - 10 * 60 * 1000);
    const qb = this.setRepo
      .createQueryBuilder('set')
      .where('set.documentId = :documentId', { documentId })
      .andWhere(
        '(set.status = :completed OR (set.status = :generating AND set.createdAt >= :recentGeneratingCutoff))',
        {
          completed: FlashcardSetStatus.COMPLETED,
          generating: FlashcardSetStatus.GENERATING,
          recentGeneratingCutoff,
        },
      )
      .orderBy('CASE WHEN set.status = :completed THEN 0 ELSE 1 END', 'ASC')
      .addOrderBy('set.createdAt', 'DESC')
      .setParameter('completed', FlashcardSetStatus.COMPLETED);

    if (ownerId) {
      qb.andWhere('(set.userId = :ownerId OR set.userId IS NULL)', { ownerId });
    } else {
      qb.andWhere('set.userId IS NULL');
    }

    return qb.getOne();
  }

  private getGenerationKey(documentId: number, ownerId: string | null) {
    return `${ownerId ?? 'anonymous'}:${documentId}`;
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  async findByDocument(documentId: number, userId?: string): Promise<FlashcardSet[]> {
    await this.documentsService.findOne(documentId, userId);
    return this.setRepo.find({
      where: userId
        ? [{ documentId, userId }, { documentId, userId: IsNull() }]
        : { documentId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number, userId?: string): Promise<FlashcardSet> {
    const set = await this.setRepo.findOne({
      where: { id },
      relations: ['flashcards', 'document'],
    });
    if (!set || (userId && set.userId !== userId && set.document?.userId !== userId)) {
      throw new NotFoundException(`FlashcardSet #${id} not found`);
    }
    return set;
  }
}
