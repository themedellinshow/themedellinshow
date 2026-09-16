import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MessagingProvider,
  SendMessageParams,
  MessageResult,
} from '../interfaces/messaging-provider.interface';

@Injectable()
export class TwilioProvider implements MessagingProvider {
  readonly name = 'twilio';
  private client: any;
  private whatsappFrom: string;
  private smsFrom: string;

  constructor(private config: ConfigService) {
    const accountSid = this.config.get('TWILIO_ACCOUNT_SID');
    const authToken = this.config.get('TWILIO_AUTH_TOKEN');
    
    if (accountSid && authToken) {
      // Lazy load twilio to avoid issues if not configured
      const twilio = require('twilio');
      this.client = twilio(accountSid, authToken);
      this.whatsappFrom = this.config.get('TWILIO_WHATSAPP_FROM', 'whatsapp:+14155238886');
      this.smsFrom = this.config.get('TWILIO_SMS_FROM', '');
    }
  }

  async sendWhatsApp(params: SendMessageParams): Promise<MessageResult> {
    if (!this.client) {
      return { success: false, error: 'Twilio not configured' };
    }

    try {
      const message = await this.client.messages.create({
        from: this.whatsappFrom,
        to: `whatsapp:${params.to}`,
        body: this.renderTemplate(params.template, params.variables),
      });

      return { success: true, messageId: message.sid };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async sendSMS(params: SendMessageParams): Promise<MessageResult> {
    if (!this.client || !this.smsFrom) {
      return { success: false, error: 'Twilio SMS not configured' };
    }

    try {
      const message = await this.client.messages.create({
        from: this.smsFrom,
        to: params.to,
        body: this.renderTemplate(params.template, params.variables),
      });

      return { success: true, messageId: message.sid };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private renderTemplate(template: string, variables: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
  }
}
