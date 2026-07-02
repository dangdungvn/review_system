import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import { DocumentConversionService } from '../documents/document-conversion.service';
import {
  Document,
  DocumentStatus,
} from '../documents/entities/document.entity';
import { AdminDocumentQueryDto } from './dto/admin-document-query.dto';

@Injectable()
export class AdminDocumentsService {
  private readonly logger = new Logger(AdminDocumentsService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    private readonly documentConversionService: DocumentConversionService,
  ) {}

  async findAll(query: AdminDocumentQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = this.documentRepo
      .createQueryBuilder('document')
      .leftJoin('document.user', 'user')
      .select([
        'document.id',
        'document.title',
        'document.originalFileName',
        'document.filePath',
        'document.markdownFilePath',
        'document.fileSize',
        'document.userId',
        'document.status',
        'document.createdAt',
        'document.updatedAt',
        'user.id',
        'user.email',
        'user.fullName',
        'user.role',
      ])
      .orderBy('document.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const keyword = query.q?.trim();
    if (keyword) {
      qb.andWhere(
        '(document.title LIKE :keyword OR document.originalFileName LIKE :keyword)',
        { keyword: `%${keyword}%` },
      );
    }

    if (query.status) {
      qb.andWhere('document.status = :status', { status: query.status });
    }

    if (query.uploadedFrom) {
      qb.andWhere('document.createdAt >= :uploadedFrom', {
        uploadedFrom: new Date(query.uploadedFrom),
      });
    }

    if (query.uploadedTo) {
      qb.andWhere('document.createdAt <= :uploadedTo', {
        uploadedTo: new Date(query.uploadedTo),
      });
    }

    if (query.minSize !== undefined) {
      qb.andWhere('document.fileSize >= :minSize', { minSize: query.minSize });
    }

    if (query.maxSize !== undefined) {
      qb.andWhere('document.fileSize <= :maxSize', { maxSize: query.maxSize });
    }

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((document) => this.toListItem(document)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const document = await this.documentRepo.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!document) {
      throw new NotFoundException('Không tìm thấy tài liệu');
    }

    return {
      ...this.toListItem(document),
      extractedText: document.extractedText,
    };
  }

  async remove(id: number) {
    const document = await this.documentRepo.findOne({ where: { id } });
    if (!document) {
      throw new NotFoundException('Không tìm thấy tài liệu');
    }

    const filePath = document.filePath;
    const markdownFilePath = document.markdownFilePath;
    await this.documentRepo.remove(document);

    this.removeFile(filePath, 'PDF');
    this.removeFile(markdownFilePath, 'Markdown');

    return {
      message: 'Đã xóa tài liệu và các nội dung phát sinh liên quan',
    };
  }

  async retryProcessing(id: number) {
    const document = await this.documentRepo.findOne({ where: { id } });
    if (!document) {
      throw new NotFoundException('Không tìm thấy tài liệu');
    }

    if (document.status !== DocumentStatus.FAILED) {
      throw new BadRequestException(
        'Chỉ retry tài liệu đang ở trạng thái failed',
      );
    }

    if (!document.filePath || !fs.existsSync(document.filePath)) {
      throw new BadRequestException('Không tìm thấy file PDF gốc để xử lý lại');
    }

    document.status = DocumentStatus.PROCESSING;
    await this.documentRepo.save(document);

    try {
      const conversion =
        await this.documentConversionService.convertPdfToMarkdown(
          document.filePath,
        );
      document.extractedText = conversion.markdown;
      document.markdownFilePath = conversion.markdownFilePath;
      document.status = DocumentStatus.COMPLETED;
    } catch (error) {
      this.logger.error(
        `Retry PDF processing failed: ${this.getErrorMessage(error)}`,
      );
      document.extractedText = null;
      document.markdownFilePath = null;
      document.status = DocumentStatus.FAILED;
    }

    return this.documentRepo.save(document);
  }

  private toListItem(document: Document) {
    return {
      id: document.id,
      title: document.title,
      originalFileName: document.originalFileName,
      filePath: document.filePath,
      markdownFilePath: document.markdownFilePath,
      fileSize: document.fileSize,
      fileSizeMB: Number((document.fileSize / 1024 / 1024).toFixed(2)),
      status: document.status,
      userId: document.userId,
      uploader: document.user
        ? {
            id: document.user.id,
            email: document.user.email,
            fullName: document.user.fullName,
            role: document.user.role,
          }
        : null,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
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
