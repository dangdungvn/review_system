import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { UserExamAttempt } from './user-exam-attempt.entity';
import { ExamQuestion } from '../../exams/entities/exam-question.entity';
import { ConfidenceLevel } from '../enums';

@Entity('user_answers')
@Index(['attemptId', 'questionId'])
export class UserAnswer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  attemptId: string;

  @ManyToOne(() => UserExamAttempt, (attempt) => attempt.answers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'attemptId' })
  attempt: UserExamAttempt;

  @Column()
  questionId: number;

  @ManyToOne(() => ExamQuestion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'questionId' })
  question: ExamQuestion;

  @Column({ type: 'enum', enum: ['A', 'B', 'C', 'D'] })
  userAnswer: string;

  @Column({ type: 'enum', enum: ['A', 'B', 'C', 'D'] })
  correctAnswer: string;

  @Column()
  isCorrect: boolean;

  @Column({
    type: 'enum',
    enum: ConfidenceLevel,
    default: ConfidenceLevel.UNCERTAIN,
  })
  confidence: ConfidenceLevel;

  @Column({ type: 'int' })
  timeSpentSeconds: number;

  // Behavioral signals
  @Column({ default: false })
  wasChanged: boolean;

  @Column({ default: 0 })
  backtrackCount: number;

  @Column({ type: 'int', nullable: true })
  sequenceOrder: number | null;

  @CreateDateColumn({ name: 'answered_at' })
  answeredAt: Date;
}
