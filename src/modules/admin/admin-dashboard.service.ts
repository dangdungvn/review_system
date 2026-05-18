import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserExamAttempt } from '../assessment/entities';
import { Document, DocumentStatus } from '../documents/entities/document.entity';
import { Exam } from '../exams/entities/exam.entity';
import { FlashcardSet } from '../flashcards/entities/flashcard-set.entity';
import { DocumentSummary } from '../summaries/entities/document-summary.entity';
import { TrueFalseQuiz } from '../true-false/entities/true-false-quiz.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AdminDashboardService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(Exam)
    private readonly examRepo: Repository<Exam>,
    @InjectRepository(DocumentSummary)
    private readonly summaryRepo: Repository<DocumentSummary>,
    @InjectRepository(FlashcardSet)
    private readonly flashcardSetRepo: Repository<FlashcardSet>,
    @InjectRepository(TrueFalseQuiz)
    private readonly trueFalseQuizRepo: Repository<TrueFalseQuiz>,
    @InjectRepository(UserExamAttempt)
    private readonly examAttemptRepo: Repository<UserExamAttempt>,
  ) {}

  async getOverview() {
    const [
      totalUsers,
      totalDocuments,
      totalExams,
      totalSummaries,
      totalFlashcardSets,
      totalTrueFalseQuestions,
      totalExamAttempts,
      documentStatusCounts,
      storageStats,
    ] = await Promise.all([
      this.userRepo.count(),
      this.documentRepo.count(),
      this.examRepo.count(),
      this.summaryRepo.count(),
      this.flashcardSetRepo.count(),
      this.trueFalseQuizRepo.count(),
      this.examAttemptRepo.count(),
      this.getDocumentStatusCounts(),
      this.getStorageStats(),
    ]);

    return {
      users: {
        total: totalUsers,
      },
      documents: {
        total: totalDocuments,
        byStatus: documentStatusCounts,
        storage: storageStats,
      },
      generatedContent: {
        exams: totalExams,
        summaries: totalSummaries,
        flashcardSets: totalFlashcardSets,
        trueFalseQuestions: totalTrueFalseQuestions,
      },
      activity: {
        examAttempts: totalExamAttempts,
      },
    };
  }

  private async getDocumentStatusCounts() {
    const rows = await this.documentRepo
      .createQueryBuilder('document')
      .select('document.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('document.status')
      .getRawMany<{ status: DocumentStatus; count: string }>();

    const counts: Record<DocumentStatus, number> = {
      [DocumentStatus.PENDING]: 0,
      [DocumentStatus.PROCESSING]: 0,
      [DocumentStatus.COMPLETED]: 0,
      [DocumentStatus.FAILED]: 0,
    };

    for (const row of rows) {
      counts[row.status] = Number(row.count);
    }

    return counts;
  }

  private async getStorageStats() {
    const raw = await this.documentRepo
      .createQueryBuilder('document')
      .select('COALESCE(SUM(document.fileSize), 0)', 'totalBytes')
      .addSelect('COALESCE(AVG(document.fileSize), 0)', 'averageBytes')
      .addSelect('COALESCE(MAX(document.fileSize), 0)', 'largestFileBytes')
      .getRawOne<{
        totalBytes: string;
        averageBytes: string;
        largestFileBytes: string;
      }>();

    const totalBytes = Number(raw?.totalBytes ?? 0);
    const averageBytes = Number(raw?.averageBytes ?? 0);
    const largestFileBytes = Number(raw?.largestFileBytes ?? 0);

    return {
      totalBytes,
      totalMB: Number((totalBytes / 1024 / 1024).toFixed(2)),
      averageBytes,
      averageMB: Number((averageBytes / 1024 / 1024).toFixed(2)),
      largestFileBytes,
      largestFileMB: Number((largestFileBytes / 1024 / 1024).toFixed(2)),
    };
  }
}
