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
import { Flashcard } from '../../flashcards/entities/flashcard.entity';
import { FlashcardStatus } from '../enums';

@Entity('user_flashcard_progress')
@Index(['userId', 'flashcardId'], { unique: true })
export class UserFlashcardProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  flashcardId: number;

  @ManyToOne(() => Flashcard, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'flashcardId' })
  flashcard: Flashcard;

  @Column({
    type: 'enum',
    enum: FlashcardStatus,
    default: FlashcardStatus.NEW,
  })
  status: FlashcardStatus;

  @Column({ default: 0 })
  correctCount: number;

  @Column({ default: 0 })
  totalReviews: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  masteryLevel: number;

  @Column({ type: 'timestamp', nullable: true })
  lastReviewedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  nextReviewAt: Date | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
