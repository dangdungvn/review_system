import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { DocumentsModule } from '../documents/documents.module';
import { DocumentSummary } from './entities/document-summary.entity';
import { SummariesController } from './summaries.controller';
import { SummariesService } from './summaries.service';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentSummary]), AiModule, DocumentsModule],
  controllers: [SummariesController],
  providers: [SummariesService],
})
export class SummariesModule {}
