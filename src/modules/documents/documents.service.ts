import { Injectable, NotFoundException, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { Document, DocumentStatus } from './entities/document.entity';

// pdf-parse v2 với module nodenext cần require
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string; numpages: number }>;

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    private readonly configService: ConfigService,
  ) {}

  async upload(
    file: Express.Multer.File,
    userId: string,
    title?: string,
  ): Promise<Document> {
    const doc = this.documentRepo.create({
      title: title || path.parse(file.originalname).name,
      originalFileName: file.originalname,
      filePath: file.path,
      fileSize: file.size,
      userId,
      status: DocumentStatus.PROCESSING,
    });

    await this.documentRepo.save(doc);

    try {
      const pdfBuffer = fs.readFileSync(file.path);
      const pdfData = await pdfParse(pdfBuffer);
      doc.extractedText = pdfData.text;
      doc.status = DocumentStatus.COMPLETED;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to extract text from PDF: ${message}`);
      doc.status = DocumentStatus.FAILED;
    }

    return this.documentRepo.save(doc);
  }

  async findAll(userId: string): Promise<Document[]> {
    return this.documentRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      select: [
        'id',
        'title',
        'originalFileName',
        'fileSize',
        'status',
        'createdAt',
        'updatedAt',
      ],
    });
  }

  async findOne(id: number, userId?: string): Promise<Document> {
    const doc = await this.documentRepo.findOne({ where: { id } });
    if (!doc) {
      throw new NotFoundException(`Document #${id} not found`);
    }
    // Nếu có userId, enforce ownership
    if (userId && doc.userId !== userId) {
      throw new ForbiddenException('Access denied to this document');
    }
    return doc;
  }

  async delete(id: number, userId: string): Promise<void> {
    const doc = await this.findOne(id, userId);
    if (fs.existsSync(doc.filePath)) {
      fs.unlinkSync(doc.filePath);
    }
    await this.documentRepo.remove(doc);
  }
}
