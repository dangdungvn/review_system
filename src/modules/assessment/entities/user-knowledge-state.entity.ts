import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('user_knowledge_states')
@Index(['userId', 'skillId'], { unique: true })
export class UserKnowledgeState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  skillId: string;

  // BKT probabilities
  @Column({ type: 'decimal', precision: 5, scale: 4 })
  masteryProbability: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0.1 })
  pLearn: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0.25 })
  pGuess: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0.1 })
  pSlip: number;

  // Metadata
  @Column({ default: 0 })
  observationCount: number;

  @Column({ type: 'timestamp' })
  lastObservation: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
