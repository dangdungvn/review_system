import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlashcardSet, FlashcardSetStatus } from './entities/flashcard-set.entity';
import { Flashcard } from './entities/flashcard.entity';
import { AiService } from '../ai/ai.service';
import { DocumentsService } from '../documents/documents.service';

@Injectable()
export class FlashcardsService {
  private readonly logger = new Logger(FlashcardsService.name);

  constructor(
    @InjectRepository(FlashcardSet)
    private readonly setRepo: Repository<FlashcardSet>,
    @InjectRepository(Flashcard)
    private readonly cardRepo: Repository<Flashcard>,
    private readonly aiService: AiService,
    private readonly documentsService: DocumentsService,
  ) {}

  async generate(documentId: number, userId: string): Promise<FlashcardSet> {
    // Enforce document ownership
    const document = await this.documentsService.findOne(documentId, userId);

    if (!document.extractedText) {
      throw new NotFoundException('Document has no extracted text');
    }

    const set = this.setRepo.create({
      documentId,
      userId,
      title: `Flashcards - ${document.title}`,
      status: FlashcardSetStatus.GENERATING,
    });
    await this.setRepo.save(set);

    try {
      const result = await this.aiService.generateFlashcards(
        document.extractedText,
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to generate flashcards: ${message}`);
      set.status = FlashcardSetStatus.FAILED;
    }

    return this.setRepo.save(set);
  }

  async findByDocument(documentId: number, userId: string): Promise<FlashcardSet[]> {
    return this.setRepo.find({
      where: { documentId, userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number, userId?: string): Promise<FlashcardSet> {
    const set = await this.setRepo.findOne({
      where: { id },
      relations: ['flashcards'],
    });
    if (!set) {
      throw new NotFoundException(`FlashcardSet #${id} not found`);
    }
    if (userId && set.userId !== userId) {
      throw new ForbiddenException('Access denied to this flashcard set');
    }
    return set;
  }
}
