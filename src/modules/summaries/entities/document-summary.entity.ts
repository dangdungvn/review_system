import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Document } from '../../documents/entities/document.entity';

@Entity('document_summaries')
export class DocumentSummary {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  documentId: number;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'documentId' })
  document: Document;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'longtext' })
  overview: string;

  @Column({ type: 'simple-json' })
  keyPoints: string[];

  @Column({ type: 'simple-json' })
  sections: Array<{
    heading: string;
    content: string;
  }>;

  @Column({ type: 'simple-json', nullable: true })
  suggestedQuestions: string[];

  @CreateDateColumn()
  createdAt: Date;
}
