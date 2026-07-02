import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Exam, ExamStatus } from './entities/exam.entity';
import { ExamQuestion } from './entities/exam-question.entity';
import { AiService } from '../ai/ai.service';
import { DocumentsService } from '../documents/documents.service';

@Injectable()
export class ExamsService {
  private readonly logger = new Logger(ExamsService.name);
  private readonly pendingGenerations = new Map<string, Promise<Exam>>();

  constructor(
    @InjectRepository(Exam)
    private readonly examRepo: Repository<Exam>,
    @InjectRepository(ExamQuestion)
    private readonly questionRepo: Repository<ExamQuestion>,
    private readonly aiService: AiService,
    private readonly documentsService: DocumentsService,
  ) {}

  async generate(documentId: number, userId?: string): Promise<Exam> {
    const document = await this.documentsService.findOne(documentId, userId);
    const ownerId = document.userId ?? userId ?? null;

    if (!document.extractedText) {
      throw new NotFoundException('Document has no extracted text');
    }

    const reusableExam = await this.findReusableExam(documentId, ownerId);
    if (reusableExam) {
      return reusableExam;
    }

    const generationKey = this.getGenerationKey(documentId, ownerId);
    const pendingGeneration = this.pendingGenerations.get(generationKey);
    if (pendingGeneration) {
      return pendingGeneration;
    }

    const generation = this.generateFreshExam(
      documentId,
      document.title,
      document.extractedText,
      ownerId,
    ).finally(() => this.pendingGenerations.delete(generationKey));

    this.pendingGenerations.set(generationKey, generation);
    return generation;
  }

  private async generateFreshExam(
    documentId: number,
    documentTitle: string,
    extractedText: string,
    ownerId: string | null,
  ): Promise<Exam> {
    const exam = this.examRepo.create({
      documentId,
      userId: ownerId,
      title: `Đề thi trắc nghiệm - ${documentTitle}`,
      status: ExamStatus.GENERATING,
    });
    await this.examRepo.save(exam);

    try {
      const result = await this.aiService.generateExam(
        extractedText,
        undefined,
        documentId,
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
      this.logger.error(`Failed to generate exam: ${this.getErrorMessage(error)}`);
      exam.status = ExamStatus.FAILED;
    }

    return this.examRepo.save(exam);
  }

  private async findReusableExam(
    documentId: number,
    ownerId: string | null,
  ): Promise<Exam | null> {
    const recentGeneratingCutoff = new Date(Date.now() - 10 * 60 * 1000);
    const qb = this.examRepo
      .createQueryBuilder('exam')
      .where('exam.documentId = :documentId', { documentId })
      .andWhere(
        '(exam.status = :completed OR (exam.status = :generating AND exam.createdAt >= :recentGeneratingCutoff))',
        {
          completed: ExamStatus.COMPLETED,
          generating: ExamStatus.GENERATING,
          recentGeneratingCutoff,
        },
      )
      .orderBy('CASE WHEN exam.status = :completed THEN 0 ELSE 1 END', 'ASC')
      .addOrderBy('exam.createdAt', 'DESC')
      .setParameter('completed', ExamStatus.COMPLETED);

    if (ownerId) {
      qb.andWhere('(exam.userId = :ownerId OR exam.userId IS NULL)', { ownerId });
    } else {
      qb.andWhere('exam.userId IS NULL');
    }

    return qb.getOne();
  }

  private getGenerationKey(documentId: number, ownerId: string | null) {
    return `${ownerId ?? 'anonymous'}:${documentId}`;
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  async findByDocument(documentId: number, userId?: string): Promise<Exam[]> {
    await this.documentsService.findOne(documentId, userId);
    return this.examRepo.find({
      where: userId
        ? [{ documentId, userId }, { documentId, userId: IsNull() }]
        : { documentId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number, userId?: string): Promise<Exam> {
    const exam = await this.examRepo.findOne({
      where: { id },
      relations: ['questions', 'document'],
    });
    if (!exam || (userId && exam.userId !== userId && exam.document?.userId !== userId)) {
      throw new NotFoundException(`Exam #${id} not found`);
    }
    return exam;
  }
}
