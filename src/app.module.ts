import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { getDatabaseConfig } from './config/database.config';
import { DocumentsModule } from './modules/documents/documents.module';
import { AiModule } from './modules/ai/ai.module';
import { ExamsModule } from './modules/exams/exams.module';
import { FlashcardsModule } from './modules/flashcards/flashcards.module';
import { TrueFalseModule } from './modules/true-false/true-false.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { AssessmentModule } from './modules/assessment/assessment.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/',
    }),
    UsersModule,
    AuthModule,
    DocumentsModule,
    AiModule,
    ExamsModule,
    FlashcardsModule,
    TrueFalseModule,
    AssessmentModule,
  ],
})
export class AppModule {}
