export interface SendMessageParams {
  to: string;
  template: string;
  variables: Record<string, string>;
  language: 'es' | 'en' | 'pt';
}

export interface SendEmailParams {
  to: string;
  subject: string;
  template: string;
  variables: Record<string, any>;
  language: 'es' | 'en' | 'pt';
}

export interface MessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface MessagingProvider {
  readonly name: string;
  sendWhatsApp(params: SendMessageParams): Promise<MessageResult>;
  sendSMS(params: SendMessageParams): Promise<MessageResult>;
}

export interface EmailProvider {
  readonly name: string;
  sendEmail(params: SendEmailParams): Promise<MessageResult>;
}
