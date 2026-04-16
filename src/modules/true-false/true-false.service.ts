import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrueFalseQuiz } from './entities/true-false-quiz.entity';
import { AiService } from '../ai/ai.service';
import { DocumentsService } from '../documents/documents.service';

@Injectable()
export class TrueFalseService {
  private readonly logger = new Logger(TrueFalseService.name);

  constructor(
    @InjectRepository(TrueFalseQuiz)
    private readonly quizRepo: Repository<TrueFalseQuiz>,
    private readonly aiService: AiService,
    private readonly documentsService: DocumentsService,
  ) {}

  async generate(documentId: number, userId: string): Promise<TrueFalseQuiz[]> {
    // Enforce document ownership
    const document = await this.documentsService.findOne(documentId, userId);

    if (!document.extractedText) {
      throw new NotFoundException('Document has no extracted text');
    }

    try {
      const result = await this.aiService.generateTrueFalse(
        document.extractedText,
      );

      const quizzes = result.questions.map((q) =>
        this.quizRepo.create({
          documentId,
          userId,
          questionNumber: q.questionNumber,
          content: q.content,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
        }),
      );

      return this.quizRepo.save(quizzes);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to generate true/false questions: ${message}`,
      );
      throw error;
    }
  }

  async findByDocument(documentId: number, userId: string): Promise<TrueFalseQuiz[]> {
    return this.quizRepo.find({
      where: { documentId, userId },
      order: { questionNumber: 'ASC' },
    });
  }
}
