import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { Document } from '../documents/entities/document.entity';
import { Exam, ExamStatus } from '../exams/entities/exam.entity';
import { ExamQuestion } from '../exams/entities/exam-question.entity';
import {
  FlashcardSet,
  FlashcardSetStatus,
} from '../flashcards/entities/flashcard-set.entity';
import { Flashcard } from '../flashcards/entities/flashcard.entity';
import { DocumentSummary } from '../summaries/entities/document-summary.entity';
import { TrueFalseQuiz } from '../true-false/entities/true-false-quiz.entity';
import { AdminAiContentQueryDto } from './dto/admin-ai-content-query.dto';
import {
  UpdateExamDto,
  UpdateExamQuestionDto,
  UpdateFlashcardDto,
  UpdateFlashcardSetDto,
  UpdateSummaryDto,
  UpdateTrueFalseDto,
} from './dto/update-ai-content.dto';

@Injectable()
export class AdminAiContentService {
  private readonly logger = new Logger(AdminAiContentService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(Exam)
    private readonly examRepo: Repository<Exam>,
    @InjectRepository(ExamQuestion)
    private readonly examQuestionRepo: Repository<ExamQuestion>,
    @InjectRepository(FlashcardSet)
    private readonly flashcardSetRepo: Repository<FlashcardSet>,
    @InjectRepository(Flashcard)
    private readonly flashcardRepo: Repository<Flashcard>,
    @InjectRepository(DocumentSummary)
    private readonly summaryRepo: Repository<DocumentSummary>,
    @InjectRepository(TrueFalseQuiz)
    private readonly trueFalseRepo: Repository<TrueFalseQuiz>,
    private readonly aiService: AiService,
  ) {}

  findExams(query: AdminAiContentQueryDto) {
    const qb = this.examRepo
      .createQueryBuilder('exam')
      .leftJoinAndSelect('exam.document', 'document')
      .orderBy('exam.createdAt', 'DESC');

    if (query.documentId !== undefined) {
      qb.andWhere('exam.documentId = :documentId', {
        documentId: query.documentId,
      });
    }
    if (query.examStatus) {
      qb.andWhere('exam.status = :status', { status: query.examStatus });
    }
    if (query.q?.trim()) {
      qb.andWhere('exam.title LIKE :keyword', {
        keyword: `%${query.q.trim()}%`,
      });
    }

    return this.paginate(qb, query);
  }

  async findExam(id: number) {
    const exam = await this.examRepo.findOne({
      where: { id },
      relations: ['document', 'questions'],
    });
    if (!exam) {
      throw new NotFoundException('Không tìm thấy đề thi');
    }
    exam.questions = [...(exam.questions ?? [])].sort(
      (a, b) => a.questionNumber - b.questionNumber,
    );
    return exam;
  }

  async updateExam(id: number, dto: UpdateExamDto) {
    const exam = await this.getExamOrFail(id);
    Object.assign(exam, dto);
    return this.examRepo.save(exam);
  }

  async removeExam(id: number) {
    const exam = await this.getExamOrFail(id);
    await this.examRepo.remove(exam);
    return { message: 'Đã xóa đề thi và các câu hỏi liên quan' };
  }

  async updateExamQuestion(id: number, dto: UpdateExamQuestionDto) {
    const question = await this.examQuestionRepo.findOne({ where: { id } });
    if (!question) {
      throw new NotFoundException('Không tìm thấy câu hỏi');
    }
    Object.assign(question, dto);
    return this.examQuestionRepo.save(question);
  }

  async findExamQuestion(id: number) {
    const question = await this.examQuestionRepo.findOne({
      where: { id },
      relations: ['exam'],
    });
    if (!question) {
      throw new NotFoundException('Không tìm thấy câu hỏi');
    }
    return question;
  }

  async removeExamQuestion(id: number) {
    const question = await this.examQuestionRepo.findOne({ where: { id } });
    if (!question) {
      throw new NotFoundException('Không tìm thấy câu hỏi');
    }
    const examId = question.examId;
    await this.examQuestionRepo.remove(question);
    await this.syncExamQuestionCount(examId);
    return { message: 'Đã xóa câu hỏi' };
  }

  async retryExam(id: number) {
    const exam = await this.getExamOrFail(id);
    const document = await this.getDocumentWithTextOrFail(exam.documentId);

    exam.userId = exam.userId ?? document.userId ?? null;

    exam.status = ExamStatus.GENERATING;
    await this.examRepo.save(exam);

    try {
      const result = await this.aiService.generateExam(
        document.extractedText,
        undefined,
        document.id,
      );
      const questions = result.questions.map((question) =>
        this.examQuestionRepo.create({
          examId: exam.id,
          questionNumber: question.questionNumber,
          content: question.content,
          optionA: question.optionA,
          optionB: question.optionB,
          optionC: question.optionC,
          optionD: question.optionD,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
        }),
      );
      await this.examQuestionRepo.manager.transaction(async (manager) => {
        await manager.delete(ExamQuestion, { examId: exam.id });
        await manager.save(ExamQuestion, questions);
      });
      exam.totalQuestions = questions.length;
      exam.status = ExamStatus.COMPLETED;
    } catch (error) {
      this.logger.error(`Retry exam generation failed: ${error.message}`);
      exam.status = ExamStatus.FAILED;
    }

    await this.examRepo.save(exam);
    return this.findExam(exam.id);
  }

  findFlashcardSets(query: AdminAiContentQueryDto) {
    const qb = this.flashcardSetRepo
      .createQueryBuilder('set')
      .leftJoinAndSelect('set.document', 'document')
      .orderBy('set.createdAt', 'DESC');

    if (query.documentId !== undefined) {
      qb.andWhere('set.documentId = :documentId', {
        documentId: query.documentId,
      });
    }
    if (query.flashcardStatus) {
      qb.andWhere('set.status = :status', { status: query.flashcardStatus });
    }
    if (query.q?.trim()) {
      qb.andWhere('set.title LIKE :keyword', {
        keyword: `%${query.q.trim()}%`,
      });
    }

    return this.paginate(qb, query);
  }

  async findFlashcardSet(id: number) {
    const set = await this.flashcardSetRepo.findOne({
      where: { id },
      relations: ['document', 'flashcards'],
    });
    if (!set) {
      throw new NotFoundException('Không tìm thấy bộ flashcard');
    }
    set.flashcards = [...(set.flashcards ?? [])].sort(
      (a, b) => a.order - b.order,
    );
    return set;
  }

  async updateFlashcardSet(id: number, dto: UpdateFlashcardSetDto) {
    const set = await this.getFlashcardSetOrFail(id);
    Object.assign(set, dto);
    return this.flashcardSetRepo.save(set);
  }

  async removeFlashcardSet(id: number) {
    const set = await this.getFlashcardSetOrFail(id);
    await this.flashcardSetRepo.remove(set);
    return { message: 'Đã xóa bộ flashcard và các card liên quan' };
  }

  async updateFlashcard(id: number, dto: UpdateFlashcardDto) {
    const flashcard = await this.flashcardRepo.findOne({ where: { id } });
    if (!flashcard) {
      throw new NotFoundException('Không tìm thấy flashcard');
    }
    Object.assign(flashcard, dto);
    return this.flashcardRepo.save(flashcard);
  }

  async findFlashcard(id: number) {
    const flashcard = await this.flashcardRepo.findOne({
      where: { id },
      relations: ['flashcardSet'],
    });
    if (!flashcard) {
      throw new NotFoundException('Không tìm thấy flashcard');
    }
    return flashcard;
  }

  async removeFlashcard(id: number) {
    const flashcard = await this.flashcardRepo.findOne({ where: { id } });
    if (!flashcard) {
      throw new NotFoundException('Không tìm thấy flashcard');
    }
    const flashcardSetId = flashcard.flashcardSetId;
    await this.flashcardRepo.remove(flashcard);
    await this.syncFlashcardCount(flashcardSetId);
    return { message: 'Đã xóa flashcard' };
  }

  async retryFlashcardSet(id: number) {
    const set = await this.getFlashcardSetOrFail(id);
    const document = await this.getDocumentWithTextOrFail(set.documentId);

    set.userId = set.userId ?? document.userId ?? null;

    set.status = FlashcardSetStatus.GENERATING;
    await this.flashcardSetRepo.save(set);

    try {
      const result = await this.aiService.generateFlashcards(
        document.extractedText,
        document.id,
      );
      const cards = result.flashcards.map((card, index) =>
        this.flashcardRepo.create({
          flashcardSetId: set.id,
          front: card.front,
          back: card.back,
          order: index + 1,
        }),
      );
      await this.flashcardRepo.manager.transaction(async (manager) => {
        await manager.delete(Flashcard, { flashcardSetId: set.id });
        await manager.save(Flashcard, cards);
      });
      set.totalCards = cards.length;
      set.status = FlashcardSetStatus.COMPLETED;
    } catch (error) {
      this.logger.error(`Retry flashcard generation failed: ${error.message}`);
      set.status = FlashcardSetStatus.FAILED;
    }

    await this.flashcardSetRepo.save(set);
    return this.findFlashcardSet(set.id);
  }

  findSummaries(query: AdminAiContentQueryDto) {
    const qb = this.summaryRepo
      .createQueryBuilder('summary')
      .leftJoinAndSelect('summary.document', 'document')
      .orderBy('summary.createdAt', 'DESC');

    if (query.documentId !== undefined) {
      qb.andWhere('summary.documentId = :documentId', {
        documentId: query.documentId,
      });
    }
    if (query.q?.trim()) {
      qb.andWhere(
        '(summary.title LIKE :keyword OR summary.overview LIKE :keyword)',
        {
          keyword: `%${query.q.trim()}%`,
        },
      );
    }

    return this.paginate(qb, query);
  }

  async findSummary(id: number) {
    const summary = await this.summaryRepo.findOne({
      where: { id },
      relations: ['document'],
    });
    if (!summary) {
      throw new NotFoundException('Không tìm thấy summary');
    }
    return summary;
  }

  async updateSummary(id: number, dto: UpdateSummaryDto) {
    const summary = await this.summaryRepo.findOne({ where: { id } });
    if (!summary) {
      throw new NotFoundException('Không tìm thấy summary');
    }
    Object.assign(summary, dto);
    return this.summaryRepo.save(summary);
  }

  async removeSummary(id: number) {
    const summary = await this.summaryRepo.findOne({ where: { id } });
    if (!summary) {
      throw new NotFoundException('Không tìm thấy summary');
    }
    await this.summaryRepo.remove(summary);
    return { message: 'Đã xóa summary' };
  }

  async retrySummary(id: number) {
    const summary = await this.summaryRepo.findOne({ where: { id } });
    if (!summary) {
      throw new NotFoundException('Không tìm thấy summary');
    }
    const document = await this.getDocumentWithTextOrFail(summary.documentId);

    const result = await this.aiService.generateSummary(
      document.extractedText,
      document.id,
    );
    summary.userId = summary.userId ?? document.userId ?? null;
    summary.title = result.summaryTitle || summary.title;
    summary.overview = result.overview;
    summary.keyPoints = result.keyPoints ?? [];
    summary.sections = result.sections ?? [];
    summary.suggestedQuestions = result.suggestedQuestions ?? [];

    return this.summaryRepo.save(summary);
  }

  findTrueFalseQuestions(query: AdminAiContentQueryDto) {
    const qb = this.trueFalseRepo
      .createQueryBuilder('quiz')
      .leftJoinAndSelect('quiz.document', 'document')
      .orderBy('quiz.createdAt', 'DESC')
      .addOrderBy('quiz.questionNumber', 'ASC');

    if (query.documentId !== undefined) {
      qb.andWhere('quiz.documentId = :documentId', {
        documentId: query.documentId,
      });
    }
    if (query.q?.trim()) {
      qb.andWhere('quiz.content LIKE :keyword', {
        keyword: `%${query.q.trim()}%`,
      });
    }

    return this.paginate(qb, query);
  }

  async findTrueFalseQuestion(id: number) {
    const quiz = await this.trueFalseRepo.findOne({
      where: { id },
      relations: ['document'],
    });
    if (!quiz) {
      throw new NotFoundException('Không tìm thấy câu đúng/sai');
    }
    return quiz;
  }

  async updateTrueFalseQuestion(id: number, dto: UpdateTrueFalseDto) {
    const quiz = await this.trueFalseRepo.findOne({ where: { id } });
    if (!quiz) {
      throw new NotFoundException('Không tìm thấy câu đúng/sai');
    }
    Object.assign(quiz, dto);
    return this.trueFalseRepo.save(quiz);
  }

  async removeTrueFalseQuestion(id: number) {
    const quiz = await this.trueFalseRepo.findOne({ where: { id } });
    if (!quiz) {
      throw new NotFoundException('Không tìm thấy câu đúng/sai');
    }
    await this.trueFalseRepo.remove(quiz);
    return { message: 'Đã xóa câu đúng/sai' };
  }

  async retryTrueFalseByDocument(documentId: number) {
    const document = await this.getDocumentWithTextOrFail(documentId);

    const result = await this.aiService.generateTrueFalse(
      document.extractedText,
      undefined,
      document.id,
    );
    const quizzes = result.questions.map((question) =>
      this.trueFalseRepo.create({
        documentId,
        userId: document.userId ?? null,
        questionNumber: question.questionNumber,
        content: question.content,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
      }),
    );

    return this.trueFalseRepo.manager.transaction(async (manager) => {
      await manager.delete(TrueFalseQuiz, { documentId });
      return manager.save(TrueFalseQuiz, quizzes);
    });
  }

  private async getDocumentWithTextOrFail(
    documentId: number,
  ): Promise<Document & { extractedText: string }> {
    const document = await this.documentRepo.findOne({
      where: { id: documentId },
    });
    if (!document) {
      throw new NotFoundException('Không tìm thấy tài liệu');
    }
    if (!document.extractedText) {
      throw new BadRequestException('Tài liệu chưa có extracted text');
    }
    return document as Document & { extractedText: string };
  }

  private async getExamOrFail(id: number) {
    const exam = await this.examRepo.findOne({ where: { id } });
    if (!exam) {
      throw new NotFoundException('Không tìm thấy đề thi');
    }
    return exam;
  }

  private async getFlashcardSetOrFail(id: number) {
    const set = await this.flashcardSetRepo.findOne({ where: { id } });
    if (!set) {
      throw new NotFoundException('Không tìm thấy bộ flashcard');
    }
    return set;
  }

  private async syncExamQuestionCount(examId: number) {
    const totalQuestions = await this.examQuestionRepo.count({
      where: { examId },
    });
    await this.examRepo.update(examId, { totalQuestions });
  }

  private async syncFlashcardCount(flashcardSetId: number) {
    const totalCards = await this.flashcardRepo.count({
      where: { flashcardSetId },
    });
    await this.flashcardSetRepo.update(flashcardSetId, { totalCards });
  }

  private async paginate<T>(
    qb: {
      skip: (skip: number) => any;
      take: (take: number) => any;
      getManyAndCount: () => Promise<[T[], number]>;
    },
    query: AdminAiContentQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
