import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiSettingsService } from '../ai/ai-settings.service';
import {
  AiContentType,
  AiGenerationLog,
  AiGenerationStatus,
} from '../ai/entities/ai-generation-log.entity';
import {
  AdminAiLogQueryDto,
  UpdateAiApiKeyDto,
  UpdateAiSettingsDto,
} from './dto/admin-ai-monitoring.dto';

@Injectable()
export class AdminAiMonitoringService {
  constructor(
    @InjectRepository(AiGenerationLog)
    private readonly logRepo: Repository<AiGenerationLog>,
    private readonly aiSettingsService: AiSettingsService,
  ) {}

  async findLogs(query: AdminAiLogQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = this.logRepo
      .createQueryBuilder('log')
      .orderBy('log.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    this.applyLogFilters(qb, query);

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

  async getStats(query: AdminAiLogQueryDto) {
    const qb = this.logRepo.createQueryBuilder('log');
    this.applyLogFilters(qb, query);

    const raw = await qb
      .select('COUNT(*)', 'totalCalls')
      .addSelect(
        'SUM(CASE WHEN log.status = :success THEN 1 ELSE 0 END)',
        'successfulCalls',
      )
      .addSelect(
        'SUM(CASE WHEN log.status = :failed THEN 1 ELSE 0 END)',
        'failedCalls',
      )
      .addSelect(
        'SUM(CASE WHEN log.errorType = :parsing THEN 1 ELSE 0 END)',
        'parsingErrors',
      )
      .addSelect('COALESCE(AVG(log.durationMs), 0)', 'averageDurationMs')
      .addSelect('COALESCE(MAX(log.durationMs), 0)', 'maxDurationMs')
      .addSelect('COALESCE(SUM(log.inputChars), 0)', 'totalInputChars')
      .addSelect('COALESCE(SUM(log.outputChars), 0)', 'totalOutputChars')
      .setParameters({
        success: AiGenerationStatus.SUCCESS,
        failed: AiGenerationStatus.FAILED,
        parsing: 'parsing',
      })
      .getRawOne();

    const byContentType = await this.getGroupedCounts(query, 'contentType');
    const byStatus = await this.getGroupedCounts(query, 'status');

    return {
      totalCalls: Number(raw?.totalCalls ?? 0),
      successfulCalls: Number(raw?.successfulCalls ?? 0),
      failedCalls: Number(raw?.failedCalls ?? 0),
      parsingErrors: Number(raw?.parsingErrors ?? 0),
      averageDurationMs: Number(Number(raw?.averageDurationMs ?? 0).toFixed(2)),
      maxDurationMs: Number(raw?.maxDurationMs ?? 0),
      totalInputChars: Number(raw?.totalInputChars ?? 0),
      totalOutputChars: Number(raw?.totalOutputChars ?? 0),
      byContentType,
      byStatus,
    };
  }

  getSettings() {
    return this.aiSettingsService.getAdminSettings();
  }

  updateSettings(dto: UpdateAiSettingsDto) {
    return this.aiSettingsService.updateSettings(dto);
  }

  updateApiKey(dto: UpdateAiApiKeyDto) {
    return this.aiSettingsService.updateSettings({ apiKey: dto.apiKey });
  }

  private applyLogFilters(qb: any, query: AdminAiLogQueryDto) {
    if (query.contentType) {
      qb.andWhere('log.contentType = :contentType', {
        contentType: query.contentType,
      });
    }

    if (query.status) {
      qb.andWhere('log.status = :status', { status: query.status });
    }

    if (query.documentId !== undefined) {
      qb.andWhere('log.documentId = :documentId', {
        documentId: query.documentId,
      });
    }

    if (query.from) {
      qb.andWhere('log.createdAt >= :from', { from: new Date(query.from) });
    }

    if (query.to) {
      qb.andWhere('log.createdAt <= :to', { to: new Date(query.to) });
    }
  }

  private async getGroupedCounts(
    query: AdminAiLogQueryDto,
    field: 'contentType' | 'status',
  ) {
    const qb = this.logRepo
      .createQueryBuilder('log')
      .select(`log.${field}`, 'key')
      .addSelect('COUNT(*)', 'count')
      .groupBy(`log.${field}`);

    this.applyLogFilters(qb, query);

    const rows = await qb.getRawMany<{ key: AiContentType | AiGenerationStatus; count: string }>();
    return rows.reduce(
      (result, row) => ({
        ...result,
        [row.key]: Number(row.count),
      }),
      {},
    );
  }
}
