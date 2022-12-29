import { Body, Controller, Get, Post } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrderPayload } from './payload/order.payload';

@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post() process(@Body() order: OrderPayload) {
    const orderEntity = {
      type: order.type,
      ...order.order,
    };
    return this.ordersService.processOrder(orderEntity);
  }
}
