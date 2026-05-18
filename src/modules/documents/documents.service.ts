import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { PDFParse } from 'pdf-parse';
import { Document, DocumentStatus } from './entities/document.entity';

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
      const pdfBuffer = fs.readFileSync(file.path);
      const parser = new PDFParse(new Uint8Array(pdfBuffer));
      const pdfData = await parser.getText();
      doc.extractedText = pdfData.text;
      doc.status = DocumentStatus.COMPLETED;
    } catch (error) {
      this.logger.error(`Failed to extract text from PDF: ${error.message}`);
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
    await this.documentRepo.remove(doc);

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      this.logger.warn(`Failed to remove PDF file after document delete: ${error.message}`);
    }
  }
}
