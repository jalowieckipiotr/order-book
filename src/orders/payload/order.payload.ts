import { Direction } from '../enums/direction';
import { OrderType } from '../enums/orderType';

export class OrderPayload {
  type: OrderType;
  order: OrderInternall;
}

class OrderInternall {
  direction: Direction;
  id: number;
  price: number;
  quantity: number;
  peak: number;
}
