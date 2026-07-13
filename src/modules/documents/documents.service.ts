import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { DocumentConversionService } from './document-conversion.service';
import { Document, DocumentStatus } from './entities/document.entity';
import { Exam, ExamStatus } from '../exams/entities/exam.entity';
import { FlashcardSet, FlashcardSetStatus } from '../flashcards/entities/flashcard-set.entity';
import { DocumentSummary } from '../summaries/entities/document-summary.entity';
import { TrueFalseQuiz } from '../true-false/entities/true-false-quiz.entity';
import { UpdateDocumentDto } from './dto/update-document.dto';

type GeneratedKind = 'summary' | 'quiz' | 'flashcard' | 'true-false';

interface GeneratedStats {
  total: number;
  completed: number;
  latestAt: Date | null;
}

interface DocumentExercise {
  id: string;
  documentId: number;
  sourceDocumentId: number;
  title: string;
  latestAttemptedAt: Date | null;
  progress: number;
  generatedTypes: GeneratedKind[];
  generatedCounts: Record<GeneratedKind, number>;
  summaryCount: number;
  examCount: number;
  flashcardSetCount: number;
  trueFalseCount: number;
}

export type DocumentWithExercises = Document & {
  exercises: DocumentExercise[];
  fileCount: number;
  unfinishedCount: number;
  completedCount: number;
};

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(Exam)
    private readonly examRepo: Repository<Exam>,
    @InjectRepository(FlashcardSet)
    private readonly flashcardSetRepo: Repository<FlashcardSet>,
    @InjectRepository(DocumentSummary)
    private readonly summaryRepo: Repository<DocumentSummary>,
    @InjectRepository(TrueFalseQuiz)
    private readonly trueFalseRepo: Repository<TrueFalseQuiz>,
    private readonly documentConversionService: DocumentConversionService,
  ) {}

  async upload(
    file: Express.Multer.File,
    title?: string,
    userId?: string,
  ): Promise<Document> {
    const doc = this.documentRepo.create({
      title: title || path.parse(file.originalname).name,
      originalFileName: file.originalname,
      filePath: file.path,
      fileSize: file.size,
      userId: userId || null,
      status: DocumentStatus.PROCESSING,
    });

    await this.documentRepo.save(doc);

    try {
      const conversion =
        await this.documentConversionService.convertPdfToMarkdown(file.path);
      doc.extractedText = conversion.markdown;
      doc.markdownFilePath = conversion.markdownFilePath;
      doc.status = DocumentStatus.COMPLETED;
    } catch (error) {
      this.logger.error(
        `Failed to convert PDF to Markdown: ${this.getErrorMessage(error)}`,
      );
      doc.extractedText = null;
      doc.markdownFilePath = null;
      doc.status = DocumentStatus.FAILED;
    }

    return this.documentRepo.save(doc);
  }

  async findAll(userId?: string): Promise<DocumentWithExercises[]> {
    const documents = await this.documentRepo.find({
      where: userId ? { userId } : undefined,
      order: { createdAt: 'DESC' },
      select: [
        'id',
        'title',
        'originalFileName',
        'fileSize',
        'markdownFilePath',
        'userId',
        'status',
        'createdAt',
        'updatedAt',
      ],
    });

    return this.attachExercises(documents, userId);
  }

  async findOne(id: number, userId?: string): Promise<DocumentWithExercises> {
    const doc = await this.documentRepo.findOne({
      where: userId ? { id, userId } : { id },
    });
    if (!doc) {
      throw new NotFoundException(`Document #${id} not found`);
    }

    const [documentWithExercises] = await this.attachExercises([doc], userId);
    return documentWithExercises;
  }

  async update(
    id: number,
    dto: UpdateDocumentDto,
    userId?: string,
  ): Promise<DocumentWithExercises> {
    const doc = await this.documentRepo.findOne({
      where: userId ? { id, userId } : { id },
    });
    if (!doc) {
      throw new NotFoundException(`Document #${id} not found`);
    }

    if (dto.title !== undefined) {
      const nextTitle = dto.title.trim();
      if (nextTitle) {
        doc.title = nextTitle;
      }
    }

    await this.documentRepo.save(doc);
    return this.findOne(id, userId);
  }

  async delete(id: number, userId?: string): Promise<void> {
    const doc = await this.documentRepo.findOne({
      where: userId ? { id, userId } : { id },
    });
    if (!doc) {
      throw new NotFoundException(`Document #${id} not found`);
    }

    const filePath = doc.filePath;
    const markdownFilePath = doc.markdownFilePath;
    await this.documentRepo.remove(doc);

    this.removeFile(filePath, 'PDF');
    this.removeFile(markdownFilePath, 'Markdown');
  }

  private async attachExercises(
    documents: Document[],
    userId?: string,
  ): Promise<DocumentWithExercises[]> {
    if (documents.length === 0) {
      return [];
    }

    const documentIds = documents.map((document) => document.id);
    const [examStats, flashcardStats, summaryStats, trueFalseStats] =
      await Promise.all([
        this.loadStatusStats(this.examRepo, 'exam', documentIds, userId, ExamStatus.COMPLETED),
        this.loadStatusStats(
          this.flashcardSetRepo,
          'flashcardSet',
          documentIds,
          userId,
          FlashcardSetStatus.COMPLETED,
        ),
        this.loadSimpleStats(this.summaryRepo, 'summary', documentIds, userId),
        this.loadSimpleStats(this.trueFalseRepo, 'trueFalse', documentIds, userId),
      ]);

    return documents.map((document) => {
      const documentId = document.id;
      const summary = summaryStats.get(documentId) ?? this.emptyStats();
      const exam = examStats.get(documentId) ?? this.emptyStats();
      const flashcard = flashcardStats.get(documentId) ?? this.emptyStats();
      const trueFalse = trueFalseStats.get(documentId) ?? this.emptyStats();
      const generatedTypes = this.getGeneratedTypes(summary, exam, flashcard, trueFalse);
      const exercises = generatedTypes.length > 0
        ? [this.createDocumentExercise(document, generatedTypes, summary, exam, flashcard, trueFalse)]
        : [];

      return {
        ...document,
        exercises,
        fileCount: exercises.length,
        unfinishedCount: exercises.filter((exercise) => exercise.progress < 100).length,
        completedCount: exercises.filter((exercise) => exercise.progress >= 100).length,
      };
    }) as DocumentWithExercises[];
  }

  private loadStatusStats<T extends { documentId: number; userId: string | null; status: string; createdAt: Date }>(
    repository: Repository<T>,
    alias: string,
    documentIds: number[],
    userId: string | undefined,
    completedStatus: string,
  ) {
    const query = repository
      .createQueryBuilder(alias)
      .select(`${alias}.documentId`, 'documentId')
      .addSelect('COUNT(*)', 'total')
      .addSelect(
        `SUM(CASE WHEN ${alias}.status = :completedStatus THEN 1 ELSE 0 END)`,
        'completed',
      )
      .addSelect(`MAX(${alias}.createdAt)`, 'latestAt')
      .where(`${alias}.documentId IN (:...documentIds)`, { documentIds })
      .setParameter('completedStatus', completedStatus)
      .groupBy(`${alias}.documentId`);

    this.scopeGeneratedContent(query, alias, userId);
    return query.getRawMany().then((rows) => this.rowsToStatsMap(rows));
  }

  private loadSimpleStats<T extends { documentId: number; userId: string | null; createdAt: Date }>(
    repository: Repository<T>,
    alias: string,
    documentIds: number[],
    userId?: string,
  ) {
    const query = repository
      .createQueryBuilder(alias)
      .select(`${alias}.documentId`, 'documentId')
      .addSelect('COUNT(*)', 'total')
      .addSelect('COUNT(*)', 'completed')
      .addSelect(`MAX(${alias}.createdAt)`, 'latestAt')
      .where(`${alias}.documentId IN (:...documentIds)`, { documentIds })
      .groupBy(`${alias}.documentId`);

    this.scopeGeneratedContent(query, alias, userId);
    return query.getRawMany().then((rows) => this.rowsToStatsMap(rows));
  }

  private scopeGeneratedContent(query: any, alias: string, userId?: string) {
    if (userId) {
      query.andWhere(`(${alias}.userId = :userId OR ${alias}.userId IS NULL)`, { userId });
      return;
    }

    query.andWhere(`${alias}.userId IS NULL`);
  }

  private rowsToStatsMap(rows: Array<{ documentId: string | number; total: string; completed: string; latestAt: Date | string | null }>) {
    const statsMap = new Map<number, GeneratedStats>();

    rows.forEach((row) => {
      statsMap.set(Number(row.documentId), {
        total: Number(row.total) || 0,
        completed: Number(row.completed) || 0,
        latestAt: row.latestAt ? new Date(row.latestAt) : null,
      });
    });

    return statsMap;
  }

  private createDocumentExercise(
    document: Document,
    generatedTypes: GeneratedKind[],
    summary: GeneratedStats,
    exam: GeneratedStats,
    flashcard: GeneratedStats,
    trueFalse: GeneratedStats,
  ): DocumentExercise {
    const totalGenerated = summary.total + exam.total + flashcard.total + trueFalse.total;
    const completedGenerated = summary.completed + exam.completed + flashcard.completed + trueFalse.completed;
    const latestAttemptedAt = this.getLatestDate([
      summary.latestAt,
      exam.latestAt,
      flashcard.latestAt,
      trueFalse.latestAt,
      document.updatedAt,
    ]);

    return {
      id: `document-${document.id}`,
      documentId: document.id,
      sourceDocumentId: document.id,
      title: document.title || document.originalFileName || `Tai lieu ${document.id}`,
      latestAttemptedAt,
      progress: totalGenerated > 0 ? Math.round((completedGenerated / totalGenerated) * 100) : 0,
      generatedTypes,
      generatedCounts: {
        summary: summary.total,
        quiz: exam.total,
        flashcard: flashcard.total,
        'true-false': trueFalse.total,
      },
      summaryCount: summary.total,
      examCount: exam.total,
      flashcardSetCount: flashcard.total,
      trueFalseCount: trueFalse.total,
    };
  }

  private getGeneratedTypes(
    summary: GeneratedStats,
    exam: GeneratedStats,
    flashcard: GeneratedStats,
    trueFalse: GeneratedStats,
  ): GeneratedKind[] {
    return [
      summary.total > 0 ? 'summary' : null,
      exam.total > 0 ? 'quiz' : null,
      flashcard.total > 0 ? 'flashcard' : null,
      trueFalse.total > 0 ? 'true-false' : null,
    ].filter((type): type is GeneratedKind => Boolean(type));
  }

  private getLatestDate(dates: Array<Date | null | undefined>) {
    const timestamps = dates
      .map((date) => date?.getTime())
      .filter((timestamp): timestamp is number => Number.isFinite(timestamp));

    if (timestamps.length === 0) {
      return null;
    }

    return new Date(Math.max(...timestamps));
  }

  private emptyStats(): GeneratedStats {
    return { total: 0, completed: 0, latestAt: null };
  }

  private removeFile(filePath: string | null, label: string) {
    try {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to remove ${label} file after document delete: ${this.getErrorMessage(error)}`,
      );
    }
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
