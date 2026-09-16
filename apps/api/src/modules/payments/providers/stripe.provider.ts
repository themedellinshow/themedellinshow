import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  PaymentProvider,
  PaymentIntent,
  RefundResult,
  CreatePaymentParams,
} from '../interfaces/payment-provider.interface';

@Injectable()
export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe';
  private stripe: Stripe;

  constructor(private config: ConfigService) {
    const secretKey = this.config.get('STRIPE_SECRET_KEY');
    if (secretKey) {
      this.stripe = new Stripe(secretKey, { apiVersion: '2023-10-16' });
    }
  }

  async createPaymentIntent(params: CreatePaymentParams): Promise<PaymentIntent> {
    const intent = await this.stripe.paymentIntents.create({
      amount: Math.round(params.amount * 100), // Stripe uses cents
      currency: params.currency.toLowerCase(),
      metadata: {
        bookingId: params.bookingId,
        userId: params.userId,
        ...params.metadata,
      },
      description: params.description,
    });

    return {
      id: intent.id,
      clientSecret: intent.client_secret || undefined,
      amount: intent.amount / 100,
      currency: intent.currency.toUpperCase(),
      status: this.mapStatus(intent.status),
    };
  }

  async confirmPayment(paymentIntentId: string): Promise<PaymentIntent> {
    const intent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
    return {
      id: intent.id,
      amount: intent.amount / 100,
      currency: intent.currency.toUpperCase(),
      status: this.mapStatus(intent.status),
    };
  }

  async refund(paymentIntentId: string, amount?: number): Promise<RefundResult> {
    const refund = await this.stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amount ? Math.round(amount * 100) : undefined,
    });

    return {
      id: refund.id,
      amount: refund.amount / 100,
      status: refund.status === 'succeeded' ? 'succeeded' : 'pending',
    };
  }

  async getPayment(paymentIntentId: string): Promise<PaymentIntent> {
    const intent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
    return {
      id: intent.id,
      amount: intent.amount / 100,
      currency: intent.currency.toUpperCase(),
      status: this.mapStatus(intent.status),
      metadata: intent.metadata,
    };
  }

  async handleWebhook(payload: any, signature: string) {
    const webhookSecret = this.config.get('STRIPE_WEBHOOK_SECRET');
    const event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret!);

    return {
      event: event.type,
      data: event.data.object,
    };
  }

  private mapStatus(status: string): 'pending' | 'succeeded' | 'failed' {
    if (status === 'succeeded') return 'succeeded';
    if (['canceled', 'requires_payment_method'].includes(status)) return 'failed';
    return 'pending';
  }
}
