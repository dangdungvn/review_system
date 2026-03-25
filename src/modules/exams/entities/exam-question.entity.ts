import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Exam } from './exam.entity';

@Entity('exam_questions')
export class ExamQuestion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  examId: number;

  @ManyToOne(() => Exam, (exam) => exam.questions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'examId' })
  exam: Exam;

  @Column()
  questionNumber: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text' })
  optionA: string;

  @Column({ type: 'text' })
  optionB: string;

  @Column({ type: 'text' })
  optionC: string;

  @Column({ type: 'text' })
  optionD: string;

  @Column({ type: 'enum', enum: ['A', 'B', 'C', 'D'] })
  correctAnswer: string;

  @Column({ type: 'text', nullable: true })
  explanation: string;
}
