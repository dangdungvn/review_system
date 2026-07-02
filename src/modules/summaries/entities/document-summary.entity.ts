import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Document } from '../../documents/entities/document.entity';
import { User } from '../../users/entities/user.entity';

@Entity('document_summaries')
export class DocumentSummary {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  documentId: number;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'documentId' })
  document: Document;

  @Index('IDX_document_summaries_userId')
  @Column({ type: 'varchar', length: 36, nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user: User | null;

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
