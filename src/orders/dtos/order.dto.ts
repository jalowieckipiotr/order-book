import { Direction } from '../enums/direction';
import { OrderType } from '../enums/orderType';

export class OrderDto {
  type: OrderType;
  direction: Direction;
  id: number;
  price: number;
  quantity: number;
  peak: number;
}
