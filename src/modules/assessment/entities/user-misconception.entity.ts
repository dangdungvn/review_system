import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('user_misconceptions')
@Index(['userId', 'skillId'])
export class UserMisconception {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  skillId: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'decimal', precision: 3, scale: 2 })
  severity: number;

  @Column({ type: 'json' })
  evidenceAttemptIds: string[];

  @CreateDateColumn({ name: 'detected_at' })
  detectedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date | null;
}
