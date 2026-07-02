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
import { User } from '../../users/entities/user.entity';
import { Flashcard } from './flashcard.entity';

export enum FlashcardSetStatus {
  GENERATING = 'generating',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('flashcard_sets')
export class FlashcardSet {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  documentId: number;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'documentId' })
  document: Document;

  @Index('IDX_flashcard_sets_userId')
  @Column({ type: 'varchar', length: 36, nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @Column({ length: 255 })
  title: string;

  @Column({ default: 0 })
  totalCards: number;

  @Column({
    type: 'enum',
    enum: FlashcardSetStatus,
    default: FlashcardSetStatus.GENERATING,
  })
  status: FlashcardSetStatus;

  @OneToMany(() => Flashcard, (f) => f.flashcardSet, { cascade: true })
  flashcards: Flashcard[];

  @CreateDateColumn()
  createdAt: Date;
}
