import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  RawBodyRequest,
  Req,
  Headers,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { User } from '../users/entities/user.entity';

@Controller({ path: 'payments', version: '1' })
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post('initiate')
  @UseGuards(AuthGuard('jwt'))
  async initiatePayment(
    @CurrentUser() user: User,
    @Body('bookingId', ParseUUIDPipe) bookingId: string,
  ) {
    return this.paymentsService.initiatePayment(bookingId, user.id);
  }

  @Post(':id/confirm')
  @UseGuards(AuthGuard('jwt'))
  async confirmPayment(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.confirmPayment(id);
  }

  @Post(':id/refund')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async refund(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('amount') amount?: number,
    @Body('reason') reason?: string,
  ) {
    return this.paymentsService.processRefund(id, amount, reason);
  }

  @Get('booking/:bookingId')
  @UseGuards(AuthGuard('jwt'))
  async findByBooking(@Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.paymentsService.findByBooking(bookingId);
  }

  @Post('webhook/stripe')
  async stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    await this.paymentsService.handleWebhook(req.rawBody, signature);
    return { received: true };
  }
}
