import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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

  async generate(documentId: number): Promise<TrueFalseQuiz[]> {
    const document = await this.documentsService.findOne(documentId);

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
          questionNumber: q.questionNumber,
          content: q.content,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
        }),
      );

      return this.quizRepo.save(quizzes);
    } catch (error) {
      this.logger.error(
        `Failed to generate true/false questions: ${error.message}`,
      );
      throw error;
    }
  }

  async findByDocument(documentId: number): Promise<TrueFalseQuiz[]> {
    return this.quizRepo.find({
      where: { documentId },
      order: { questionNumber: 'ASC' },
    });
  }
}
