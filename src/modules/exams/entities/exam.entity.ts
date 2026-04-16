import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Document } from '../../documents/entities/document.entity';
import { ExamQuestion } from './exam-question.entity';

export enum ExamStatus {
  GENERATING = 'generating',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('exams')
@Index(['userId', 'createdAt'])
export class Exam {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  documentId: number;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'documentId' })
  document: Document;

  @Column()
  userId: string;

  @Column({ length: 255 })
  title: string;

  @Column({ default: 50 })
  totalQuestions: number;

  @Column({ type: 'enum', enum: ExamStatus, default: ExamStatus.GENERATING })
  status: ExamStatus;

  @OneToMany(() => ExamQuestion, (q) => q.exam, { cascade: true })
  questions: ExamQuestion[];

  @CreateDateColumn()
  createdAt: Date;
}
