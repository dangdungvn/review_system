import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { DocumentConversionService } from './document-conversion.service';
import { Document, DocumentStatus } from './entities/document.entity';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
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

  async findAll(userId?: string): Promise<Document[]> {
    return this.documentRepo.find({
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
  }

  async findOne(id: number, userId?: string): Promise<Document> {
    const doc = await this.documentRepo.findOne({
      where: userId ? { id, userId } : { id },
    });
    if (!doc) {
      throw new NotFoundException(`Document #${id} not found`);
    }
    return doc;
  }

  async delete(id: number, userId?: string): Promise<void> {
    const doc = await this.findOne(id, userId);
    const filePath = doc.filePath;
    const markdownFilePath = doc.markdownFilePath;
    await this.documentRepo.remove(doc);

    this.removeFile(filePath, 'PDF');
    this.removeFile(markdownFilePath, 'Markdown');
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
