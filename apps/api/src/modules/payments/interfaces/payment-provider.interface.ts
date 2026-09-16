export interface PaymentIntent {
  id: string;
  clientSecret?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed';
  metadata?: Record<string, any>;
}

export interface RefundResult {
  id: string;
  amount: number;
  status: 'pending' | 'succeeded' | 'failed';
}

export interface CreatePaymentParams {
  amount: number;
  currency: 'COP' | 'USD';
  bookingId: string;
  userId: string;
  description: string;
  metadata?: Record<string, any>;
}

export interface PaymentProvider {
  readonly name: string;
  
  createPaymentIntent(params: CreatePaymentParams): Promise<PaymentIntent>;
  
  confirmPayment(paymentIntentId: string): Promise<PaymentIntent>;
  
  refund(paymentIntentId: string, amount?: number): Promise<RefundResult>;
  
  getPayment(paymentIntentId: string): Promise<PaymentIntent>;
  
  handleWebhook(payload: any, signature: string): Promise<{ event: string; data: any }>;
}
