import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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

  async generate(documentId: number): Promise<Exam> {
    const document = await this.documentsService.findOne(documentId);

    if (!document.extractedText) {
      throw new NotFoundException('Document has no extracted text');
    }

    const exam = this.examRepo.create({
      documentId,
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
    } catch (error) {
      this.logger.error(`Failed to generate exam: ${error.message}`);
      exam.status = ExamStatus.FAILED;
    }

    return this.examRepo.save(exam);
  }

  async findByDocument(documentId: number): Promise<Exam[]> {
    return this.examRepo.find({
      where: { documentId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Exam> {
    const exam = await this.examRepo.findOne({
      where: { id },
      relations: ['questions'],
    });
    if (!exam) {
      throw new NotFoundException(`Exam #${id} not found`);
    }
    return exam;
  }
}
