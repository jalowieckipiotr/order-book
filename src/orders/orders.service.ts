import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  MoreThanOrEqual,
  MoreThan,
  Repository,
  LessThanOrEqual,
  FindOptionsWhere,
} from 'typeorm';
import { OrderDto } from './dtos/order.dto';
import { Order } from './entities/order.entity';
import { Direction } from './enums/direction';
import { OrderType } from './enums/orderType';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
  ) {}

  public getBuyOrders(price: number, self) {
    const where = {
      direction: Direction.BUY,
      quantity: MoreThan(0),
    } as FindOptionsWhere<Order>;
    if (price && price > 0) {
      where.price = MoreThanOrEqual(price);
    }
    return self.orderRepository.find({
      where,
      order: { price: 'DESC', createdAt: 'ASC' },
    });
  }

  private getSellOrders(price: number, self) {
    const where = {
      direction: Direction.SELL,
      quantity: MoreThan(0),
    } as FindOptionsWhere<Order>;
    if (price && price > 0) {
      where.price = LessThanOrEqual(price);
    }
    return self.orderRepository.find({
      where,
      order: { price: 'ASC', createdAt: 'ASC' },
    });
  }

  async processOrder(sourceOrder: OrderDto) {
    const targetOrdersFunction = this.getFunctionForDirection(
      sourceOrder.direction,
    );
    const self = this;
    const targetOrders = await targetOrdersFunction(sourceOrder.price, self);
    if (!targetOrders || !targetOrders.length) {
      await this.orderRepository.save(sourceOrder);
      return this.getOrders();
    }
    const targetOrdersQueue = [];
    let thereIsOrderWithQuantity = true;
    let index = 0;
    while (thereIsOrderWithQuantity) {
      for (const targetOrder of targetOrders) {
        if (targetOrder.quantity === 0) {
          continue;
        }
        if (targetOrder.type === OrderType.ICEBERG) {
          const value =
            targetOrder.peak < targetOrder.quantity
              ? targetOrder.peak
              : targetOrder.quantity;
          targetOrder.quantity -= value;

          const order = {
            ...targetOrder,
            ...{ quantity: value, index },
          };
          index++;
          targetOrdersQueue.push(order);
        } else if (targetOrder.type === OrderType.LIMIT) {
          index++;
          targetOrdersQueue.push({ ...targetOrder, ...{ index } });
          targetOrder.quantity = 0;
        }
      }
      thereIsOrderWithQuantity = !!targetOrders.find((i) => i.quantity > 0);
    }
    targetOrdersQueue.sort((a, b) => {
      if (sourceOrder.direction === Direction.BUY) {
        return a.price - b.price !== 0 ? a.price - b.price : a.index - b.index;
      } else {
        return b.price - a.price !== 0 ? b.price - a.price : a.index - b.index;
      }
    });
    const sourceOrdersQueue =
      sourceOrder.type === OrderType.LIMIT
        ? [sourceOrder]
        : packOrderIntoArray(sourceOrder);

    const transactions = [];
    const targetOrdersDb = await targetOrdersFunction(sourceOrder.price, self);
    for (const sourceOrder of sourceOrdersQueue) {
      while (sourceOrder.quantity > 0 && targetOrdersQueue.length) {
        if (!targetOrdersQueue || !targetOrdersQueue.length) {
          break;
        }
        const targetOrder = targetOrdersQueue[0];
        const transactionQuantity =
          targetOrder.quantity >= sourceOrder.quantity
            ? sourceOrder.quantity
            : targetOrder.quantity;
        const targetOrderDb = targetOrdersDb.find(
          (i) => i.id === targetOrder.id,
        );
        sourceOrder.quantity -= transactionQuantity;
        targetOrderDb.quantity -= transactionQuantity;
        targetOrdersQueue.shift();
        transactions.push({
          [sourceOrder.direction === Direction.BUY
            ? 'sellOrderId'
            : 'buyOrderId']: targetOrder.id,
          [sourceOrder.direction === Direction.BUY
            ? 'buyOrderId'
            : 'sellOrderId']: sourceOrder.id,
          price: targetOrder.price,
          quantity: transactionQuantity,
        });
      }
    }
    await this.orderRepository.save(targetOrdersDb);
    await this.orderRepository.save(sourceOrder);
    const { sellOrders, buyOrders } = await this.getOrders();
    return { buyOrders, sellOrders, transactions };
  }

  private getFunctionForDirection(direction: Direction) {
    if (direction === Direction.SELL) {
      return this.getBuyOrders;
    } else if (direction === Direction.BUY) {
      return this.getSellOrders;
    }
  }
  private async getOrders() {
    const self = this;
    const buyOrders = await this.getBuyOrders(0, self);
    const sellOrders = await this.getSellOrders(0, self);
    return {
      buyOrders,
      sellOrders,
    };
  }
}

function packOrderIntoArray(order) {
  const ordersArray = [];
  while (order.quantity > 0) {
    const value = order.peak < order.quantity ? order.peak : order.quantity;
    order.quantity -= value;
    ordersArray.push({ ...order, ...{ quantity: value } });
  }
  return ordersArray;
}
