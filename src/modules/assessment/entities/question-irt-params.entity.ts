import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('question_irt_params')
@Index(['questionId', 'questionType'], { unique: true })
export class QuestionIRTParams {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  questionId: number;

  @Column()
  questionType: string;

  // IRT parameters
  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0 })
  difficulty: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 1 })
  discrimination: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0.25 })
  guessing: number;

  // Metadata for estimation
  @Column({ default: 0 })
  attemptCount: number;

  @Column({ default: 0 })
  correctCount: number;

  @Column({ type: 'decimal', precision: 7, scale: 2, default: 0 })
  averageTime: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
