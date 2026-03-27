import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { TrueFalseQuiz } from '../../true-false/entities/true-false-quiz.entity';
import { ConfidenceLevel } from '../enums';

@Entity('user_true_false_attempts')
@Index(['userId', 'quizId'])
export class UserTrueFalseAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  quizId: number;

  @ManyToOne(() => TrueFalseQuiz, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quizId' })
  quiz: TrueFalseQuiz;

  @Column()
  userAnswer: boolean;

  @Column()
  isCorrect: boolean;

  @Column({
    type: 'enum',
    enum: ConfidenceLevel,
    default: ConfidenceLevel.UNCERTAIN,
  })
  confidence: ConfidenceLevel;

  @Column({ type: 'int', nullable: true })
  reactionTimeMs: number | null;

  @CreateDateColumn({ name: 'answered_at' })
  answeredAt: Date;
}
