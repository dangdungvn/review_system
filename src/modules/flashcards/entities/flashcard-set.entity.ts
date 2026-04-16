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
import { Flashcard } from './flashcard.entity';

export enum FlashcardSetStatus {
  GENERATING = 'generating',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('flashcard_sets')
@Index(['userId', 'createdAt'])
export class FlashcardSet {
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
