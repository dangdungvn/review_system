import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { FlashcardSet } from './flashcard-set.entity';

@Entity('flashcards')
export class Flashcard {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  flashcardSetId: number;

  @ManyToOne(() => FlashcardSet, (set) => set.flashcards, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'flashcardSetId' })
  flashcardSet: FlashcardSet;

  @Column({ type: 'text' })
  front: string;

  @Column({ type: 'text' })
  back: string;

  @Column({ name: 'card_order' })
  order: number;
}
