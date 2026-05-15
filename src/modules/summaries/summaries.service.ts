import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { DocumentsService } from '../documents/documents.service';
import { DocumentSummary } from './entities/document-summary.entity';

@Injectable()
export class SummariesService {
  private readonly logger = new Logger(SummariesService.name);

  constructor(
    @InjectRepository(DocumentSummary)
    private readonly summaryRepo: Repository<DocumentSummary>,
    private readonly aiService: AiService,
    private readonly documentsService: DocumentsService,
  ) {}

  async generate(documentId: number): Promise<DocumentSummary> {
    const document = await this.documentsService.findOne(documentId);

    if (!document.extractedText) {
      throw new NotFoundException('Document has no extracted text');
    }

    try {
      const result = await this.aiService.generateSummary(document.extractedText);

      const summary = this.summaryRepo.create({
        documentId,
        title: result.summaryTitle || `Tóm tắt - ${document.title}`,
        overview: result.overview,
        keyPoints: result.keyPoints ?? [],
        sections: result.sections ?? [],
        suggestedQuestions: result.suggestedQuestions ?? [],
      });

      return this.summaryRepo.save(summary);
    } catch (error) {
      this.logger.error(`Failed to generate summary: ${error.message}`);
      throw error;
    }
  }

  async findByDocument(documentId: number): Promise<DocumentSummary[]> {
    return this.summaryRepo.find({
      where: { documentId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<DocumentSummary> {
    const summary = await this.summaryRepo.findOne({ where: { id } });
    if (!summary) {
      throw new NotFoundException(`DocumentSummary #${id} not found`);
    }
    return summary;
  }
}
