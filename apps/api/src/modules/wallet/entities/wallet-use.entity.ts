import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * Records how wallet credit was consumed against a booking (for refunds,
 * credit is restored to the source credit rows).
 */
@Entity('wallet_uses')
export class WalletUse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  creditId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column({ type: 'uuid' })
  bookingId: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amountCop: number;

  @CreateDateColumn()
  createdAt: Date;
}