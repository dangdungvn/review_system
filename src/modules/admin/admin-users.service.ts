import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../documents/entities/document.entity';
import { FlashcardStatus } from '../assessment/enums';
import {
  UserAbility,
  UserExamAttempt,
  UserFlashcardProgress,
  UserKnowledgeState,
  UserLearningProfile,
  UserTrueFalseAttempt,
} from '../assessment/entities';
import { User, UserRole } from '../users/entities/user.entity';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(UserExamAttempt)
    private readonly examAttemptRepo: Repository<UserExamAttempt>,
    @InjectRepository(UserAbility)
    private readonly abilityRepo: Repository<UserAbility>,
    @InjectRepository(UserLearningProfile)
    private readonly learningProfileRepo: Repository<UserLearningProfile>,
    @InjectRepository(UserKnowledgeState)
    private readonly knowledgeStateRepo: Repository<UserKnowledgeState>,
    @InjectRepository(UserFlashcardProgress)
    private readonly flashcardProgressRepo: Repository<UserFlashcardProgress>,
    @InjectRepository(UserTrueFalseAttempt)
    private readonly trueFalseAttemptRepo: Repository<UserTrueFalseAttempt>,
  ) {}

  async findAll(query: AdminUserQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = this.userRepo
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.email',
        'user.fullName',
        'user.role',
        'user.avatarUrl',
        'user.isActive',
        'user.createdAt',
        'user.updatedAt',
      ])
      .orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const keyword = query.q?.trim();
    if (keyword) {
      qb.andWhere('(user.email LIKE :keyword OR user.fullName LIKE :keyword)', {
        keyword: `%${keyword}%`,
      });
    }

    if (query.role) {
      qb.andWhere('user.role = :role', { role: query.role });
    }

    if (query.isActive !== undefined) {
      qb.andWhere('user.isActive = :isActive', {
        isActive: query.isActive === 'true',
      });
    }

    const [items, total] = await qb.getManyAndCount();

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

  async findOne(id: string) {
    const user = await this.getUserOrFail(id);
    const [
      documents,
      recentExamAttempts,
      examStats,
      ability,
      learningProfile,
      knowledgeStates,
      flashcardStats,
      trueFalseStats,
    ] = await Promise.all([
      this.documentRepo.find({
        where: { userId: id },
        order: { createdAt: 'DESC' },
        take: 20,
        select: [
          'id',
          'title',
          'originalFileName',
          'fileSize',
          'status',
          'createdAt',
          'updatedAt',
        ],
      }),
      this.examAttemptRepo.find({
        where: { userId: id },
        relations: ['exam'],
        order: { createdAt: 'DESC' },
        take: 20,
      }),
      this.getExamStats(id),
      this.abilityRepo.findOne({ where: { userId: id } }),
      this.learningProfileRepo.findOne({ where: { userId: id } }),
      this.knowledgeStateRepo.find({
        where: { userId: id },
        order: { updatedAt: 'DESC' },
        take: 20,
      }),
      this.getFlashcardStats(id),
      this.getTrueFalseStats(id),
    ]);

    return {
      profile: this.toSafeUser(user),
      documents,
      examAttempts: recentExamAttempts.map((attempt) => ({
        id: attempt.id,
        examId: attempt.examId,
        examTitle: attempt.exam?.title,
        attemptNumber: attempt.attemptNumber,
        score: Number(attempt.score),
        correctAnswers: attempt.correctAnswers,
        totalQuestions: attempt.totalQuestions,
        totalTimeSpentSeconds: attempt.totalTimeSpentSeconds,
        isCompleted: attempt.isCompleted,
        createdAt: attempt.createdAt,
        completedAt: attempt.completedAt,
      })),
      progress: {
        exams: examStats,
        flashcards: flashcardStats,
        trueFalse: trueFalseStats,
        ability,
        learningProfile,
        knowledgeStates,
      },
    };
  }

  async updateRole(id: string, role: UserRole, currentAdminId: string) {
    if (id === currentAdminId) {
      throw new BadRequestException('Không thể tự đổi role của chính mình');
    }

    const user = await this.getUserOrFail(id);
    user.role = role;
    user.refreshToken = null;
    return this.toSafeUser(await this.userRepo.save(user));
  }

  async updateStatus(id: string, isActive: boolean, currentAdminId: string) {
    if (id === currentAdminId && !isActive) {
      throw new BadRequestException('Không thể tự khóa tài khoản của chính mình');
    }

    const user = await this.getUserOrFail(id);
    user.isActive = isActive;
    if (!isActive) {
      user.refreshToken = null;
    }
    return this.toSafeUser(await this.userRepo.save(user));
  }

  async remove(id: string, currentAdminId: string) {
    if (id === currentAdminId) {
      throw new BadRequestException('Không thể tự xóa tài khoản của chính mình');
    }

    const user = await this.getUserOrFail(id);
    await this.userRepo.remove(user);
    return { message: 'Đã xóa người dùng thành công' };
  }

  async revokeSessions(id: string) {
    await this.getUserOrFail(id);
    await this.userRepo.update(id, { refreshToken: null });
    return { message: 'Đã thu hồi refresh token của người dùng' };
  }

  private async getUserOrFail(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
    return user;
  }

  private toSafeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private async getExamStats(userId: string) {
    const raw = await this.examAttemptRepo
      .createQueryBuilder('attempt')
      .select('COUNT(*)', 'totalAttempts')
      .addSelect('SUM(CASE WHEN attempt.isCompleted = true THEN 1 ELSE 0 END)', 'completedAttempts')
      .addSelect('AVG(attempt.score)', 'averageScore')
      .addSelect('MAX(attempt.createdAt)', 'lastAttemptAt')
      .where('attempt.userId = :userId', { userId })
      .getRawOne();

    return {
      totalAttempts: Number(raw?.totalAttempts ?? 0),
      completedAttempts: Number(raw?.completedAttempts ?? 0),
      averageScore: raw?.averageScore === null ? null : Number(raw.averageScore),
      lastAttemptAt: raw?.lastAttemptAt ?? null,
    };
  }

  private async getFlashcardStats(userId: string) {
    const raw = await this.flashcardProgressRepo
      .createQueryBuilder('progress')
      .select('COUNT(*)', 'totalCards')
      .addSelect(
        'SUM(CASE WHEN progress.status = :mastered THEN 1 ELSE 0 END)',
        'masteredCards',
      )
      .addSelect('AVG(progress.masteryLevel)', 'averageMastery')
      .addSelect('MAX(progress.lastReviewedAt)', 'lastReviewedAt')
      .where('progress.userId = :userId', { userId })
      .setParameter('mastered', FlashcardStatus.MASTERED)
      .getRawOne();

    return {
      totalCards: Number(raw?.totalCards ?? 0),
      masteredCards: Number(raw?.masteredCards ?? 0),
      averageMastery:
        raw?.averageMastery === null ? null : Number(raw.averageMastery),
      lastReviewedAt: raw?.lastReviewedAt ?? null,
    };
  }

  private async getTrueFalseStats(userId: string) {
    const raw = await this.trueFalseAttemptRepo
      .createQueryBuilder('attempt')
      .select('COUNT(*)', 'totalAttempts')
      .addSelect('SUM(CASE WHEN attempt.isCorrect = true THEN 1 ELSE 0 END)', 'correctAnswers')
      .addSelect('MAX(attempt.answeredAt)', 'lastAnsweredAt')
      .where('attempt.userId = :userId', { userId })
      .getRawOne();

    const totalAttempts = Number(raw?.totalAttempts ?? 0);
    const correctAnswers = Number(raw?.correctAnswers ?? 0);

    return {
      totalAttempts,
      correctAnswers,
      accuracy:
        totalAttempts === 0 ? null : Number(((correctAnswers / totalAttempts) * 100).toFixed(2)),
      lastAnsweredAt: raw?.lastAnsweredAt ?? null,
    };
  }
}
