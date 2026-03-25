import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Document } from '../../documents/entities/document.entity';
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
