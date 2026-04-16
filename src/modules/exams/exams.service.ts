import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Exam, ExamStatus } from './entities/exam.entity';
import { ExamQuestion } from './entities/exam-question.entity';
import { AiService } from '../ai/ai.service';
import { DocumentsService } from '../documents/documents.service';

@Injectable()
export class ExamsService {
  private readonly logger = new Logger(ExamsService.name);

  constructor(
    @InjectRepository(Exam)
    private readonly examRepo: Repository<Exam>,
    @InjectRepository(ExamQuestion)
    private readonly questionRepo: Repository<ExamQuestion>,
    private readonly aiService: AiService,
    private readonly documentsService: DocumentsService,
  ) {}

  async generate(documentId: number, userId: string): Promise<Exam> {
    // Enforce document ownership
    const document = await this.documentsService.findOne(documentId, userId);

    if (!document.extractedText) {
      throw new NotFoundException('Document has no extracted text');
    }

    const exam = this.examRepo.create({
      documentId,
      userId,
      title: `Đề thi trắc nghiệm - ${document.title}`,
      status: ExamStatus.GENERATING,
    });
    await this.examRepo.save(exam);

    try {
      const result = await this.aiService.generateExam(
        document.extractedText,
      );

      const questions = result.questions.map((q) =>
        this.questionRepo.create({
          examId: exam.id,
          questionNumber: q.questionNumber,
          content: q.content,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
        }),
      );

      await this.questionRepo.save(questions);
      exam.totalQuestions = questions.length;
      exam.status = ExamStatus.COMPLETED;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to generate exam: ${message}`);
      exam.status = ExamStatus.FAILED;
    }

    return this.examRepo.save(exam);
  }

  async findByDocument(documentId: number, userId: string): Promise<Exam[]> {
    return this.examRepo.find({
      where: { documentId, userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number, userId?: string): Promise<Exam> {
    const exam = await this.examRepo.findOne({
      where: { id },
      relations: ['questions'],
    });
    if (!exam) {
      throw new NotFoundException(`Exam #${id} not found`);
    }
    if (userId && exam.userId !== userId) {
      throw new ForbiddenException('Access denied to this exam');
    }
    return exam;
  }
}
