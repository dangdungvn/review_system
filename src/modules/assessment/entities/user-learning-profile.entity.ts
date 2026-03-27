import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  UpdateDateColumn,
  BeforeInsert,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { LearningStyle } from '../enums';
import type { DetectedIssues } from '../interfaces/behavioral-data.interface';

@Entity('user_learning_profiles')
export class UserLearningProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: LearningStyle,
    default: LearningStyle.UNKNOWN,
  })
  primaryStyle: LearningStyle;

  @Column({
    type: 'enum',
    enum: LearningStyle,
    nullable: true,
  })
  secondaryStyle: LearningStyle | null;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  styleConfidence: number;

  // Characteristics
  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0.5 })
  learningVelocity: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0.5 })
  persistenceLevel: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0.5 })
  confidenceCalibration: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0.5 })
  focusScore: number;

  // Detected patterns (JSON)
  @Column({ type: 'json', nullable: true })
  detectedIssues: DetectedIssues;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @BeforeInsert()
  setDefaults() {
    if (!this.detectedIssues) {
      this.detectedIssues = {
        hasGuessPattern: false,
        hasRushingPattern: false,
        hasGivingUpPattern: false,
        hasOverconfidencePattern: false,
        hasCheatingSuspicion: false,
      };
    }
  }
}
