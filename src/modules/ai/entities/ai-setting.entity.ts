import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('ai_settings')
export class AiSetting {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 100 })
  key: string;

  @Column({ type: 'longtext', nullable: true })
  value: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
