import { DocumentStatus } from '../entities/document.entity';

export class DocumentResponseDto {
  id: number;
  title: string;
  originalFileName: string;
  fileSize: number;
  status: DocumentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class DocumentDetailResponseDto extends DocumentResponseDto {
  extractedText: string;
}
