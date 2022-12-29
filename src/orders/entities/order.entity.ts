import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';
import { Direction } from '../enums/direction';
import { OrderType } from '../enums/orderType';

@Entity()
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  type: OrderType;

  @Column()
  direction: Direction;

  @Column()
  price: number;

  @Column()
  quantity: number;

  @Column({ nullable: true })
  peak?: number;

  @CreateDateColumn()
  createdAt: Date;
}
