import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum AiContentType {
  EXAM = 'exam',
  FLASHCARDS = 'flashcards',
  SUMMARY = 'summary',
  TRUE_FALSE = 'true_false',
}

export enum AiGenerationStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
}

@Entity('ai_generation_logs')
export class AiGenerationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: AiContentType })
  contentType: AiContentType;

  @Column({ type: 'int', nullable: true })
  documentId: number | null;

  @Column({ type: 'enum', enum: AiGenerationStatus })
  status: AiGenerationStatus;

  @Column({ length: 100 })
  model: string;

  @Column({ type: 'int' })
  inputChars: number;

  @Column({ type: 'int', default: 0 })
  truncatedChars: number;

  @Column({ type: 'int', nullable: true })
  outputChars: number | null;

  @Column({ type: 'int' })
  durationMs: number;

  @Column({ type: 'varchar', length: 80, nullable: true })
  errorType: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
