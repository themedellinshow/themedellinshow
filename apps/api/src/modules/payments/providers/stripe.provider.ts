import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
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
  readonly demo: boolean;

  private stripe?: Stripe;

  constructor(private config: ConfigService) {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY') ?? '';
    this.demo = !secretKey;
    if (secretKey) {
      this.stripe = new Stripe(secretKey, { apiVersion: '2023-10-16' });
    }
  }

  async createPaymentIntent(params: CreatePaymentParams): Promise<PaymentIntent> {
    if (this.demo) {
      const id = `demo_pi_${randomBytes(6).toString('hex')}`;
      return {
        id,
        clientSecret: `demo_secret_${id}`,
        amount: params.amount,
        currency: params.currency.toUpperCase(),
        status: 'succeeded',
        metadata: {
          bookingId: params.bookingId,
          userId: params.userId,
          demo: 'true',
        },
      };
    }

    const intent = await this.stripe!.paymentIntents.create({
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
    if (this.demo) {
      return {
        id: paymentIntentId,
        amount: 0,
        currency: 'COP',
        status: 'succeeded',
        metadata: { demo: 'true' },
      };
    }
    const intent = await this.stripe!.paymentIntents.retrieve(paymentIntentId);
    return {
      id: intent.id,
      amount: intent.amount / 100,
      currency: intent.currency.toUpperCase(),
      status: this.mapStatus(intent.status),
    };
  }

  async refund(paymentIntentId: string, amount?: number): Promise<RefundResult> {
    if (this.demo) {
      const id = `demo_re_${randomBytes(6).toString('hex')}`;
      return { id, amount: amount ?? 0, status: 'succeeded' };
    }
    const refund = await this.stripe!.refunds.create({
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
    if (this.demo) {
      return {
        id: paymentIntentId,
        amount: 0,
        currency: 'COP',
        status: 'succeeded',
        metadata: { demo: 'true' },
      };
    }
    const intent = await this.stripe!.paymentIntents.retrieve(paymentIntentId);
    return {
      id: intent.id,
      amount: intent.amount / 100,
      currency: intent.currency.toUpperCase(),
      status: this.mapStatus(intent.status),
      metadata: intent.metadata,
    };
  }

  async handleWebhook(_payload: any, _signature: string) {
    if (this.demo) {
      throw new BadRequestException('Stripe webhook no está disponible en modo demo.');
    }
    const webhookSecret = this.config.get('STRIPE_WEBHOOK_SECRET');
    const event = this.stripe!.webhooks.constructEvent(_payload, _signature, webhookSecret!);

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