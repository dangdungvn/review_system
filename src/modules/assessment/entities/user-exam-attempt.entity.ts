import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Exam } from '../../exams/entities/exam.entity';
import { UserAnswer } from './user-answer.entity';
import type { ExamBehavioralData } from '../interfaces/behavioral-data.interface';
import { LearningStyle } from '../enums';

@Entity('user_exam_attempts')
@Index(['userId', 'examId'])
@Index(['userId', 'createdAt'])
export class UserExamAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  examId: number;

  @ManyToOne(() => Exam, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'examId' })
  exam: Exam;

  @Column({ default: 1 })
  attemptNumber: number;

  // Basic metrics
  @Column({ type: 'decimal', precision: 5, scale: 2 })
  score: number;

  @Column()
  correctAnswers: number;

  @Column()
  totalQuestions: number;

  // Time signals
  @Column({ type: 'int' })
  totalTimeSpentSeconds: number;

  @Column({ type: 'decimal', precision: 7, scale: 2 })
  averageTimePerQuestion: number;

  // Confidence breakdown
  @Column({ default: 0 })
  confidentCorrect: number;

  @Column({ default: 0 })
  uncertainCorrect: number;

  @Column({ default: 0 })
  guessingCorrect: number;

  // Behavioral signals (JSON)
  @Column({ type: 'json' })
  behavioralData: ExamBehavioralData;

  // AI predictions (computed asynchronously)
  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  predictedMastery: number | null;

  @Column({
    type: 'enum',
    enum: LearningStyle,
    nullable: true,
  })
  learningStyleSnapshot: LearningStyle | null;

  @Column({ default: true })
  isCompleted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @OneToMany(() => UserAnswer, (answer) => answer.attempt, { cascade: true })
  answers: UserAnswer[];
}
