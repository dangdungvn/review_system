import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrueFalseQuiz } from './entities/true-false-quiz.entity';
import { TrueFalseController } from './true-false.controller';
import { TrueFalseService } from './true-false.service';
import { AiModule } from '../ai/ai.module';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TrueFalseQuiz]),
    AiModule,
    DocumentsModule,
  ],
  controllers: [TrueFalseController],
  providers: [TrueFalseService],
})
export class TrueFalseModule {}
