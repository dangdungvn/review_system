import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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

  async generate(documentId: number): Promise<FlashcardSet> {
    const document = await this.documentsService.findOne(documentId);

    if (!document.extractedText) {
      throw new NotFoundException('Document has no extracted text');
    }

    const set = this.setRepo.create({
      documentId,
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
    } catch (error) {
      this.logger.error(`Failed to generate flashcards: ${error.message}`);
      set.status = FlashcardSetStatus.FAILED;
    }

    return this.setRepo.save(set);
  }

  async findByDocument(documentId: number): Promise<FlashcardSet[]> {
    return this.setRepo.find({
      where: { documentId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<FlashcardSet> {
    const set = await this.setRepo.findOne({
      where: { id },
      relations: ['flashcards'],
    });
    if (!set) {
      throw new NotFoundException(`FlashcardSet #${id} not found`);
    }
    return set;
  }
}
