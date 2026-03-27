import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('user_abilities')
export class UserAbility {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  // Global ability (IRT theta parameter)
  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0 })
  globalTheta: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 1 })
  standardError: number;

  // Topic-specific abilities (JSON)
  @Column({ type: 'json', nullable: true })
  topicThetas: Record<string, number> | null;

  @Column({ default: 0 })
  totalObservations: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
