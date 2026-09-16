import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EmailProvider,
  SendEmailParams,
  MessageResult,
} from '../interfaces/messaging-provider.interface';

@Injectable()
export class SendGridProvider implements EmailProvider {
  readonly name = 'sendgrid';
  private client: any;
  private fromEmail: string;
  private fromName: string;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get('SENDGRID_API_KEY');
    
    if (apiKey) {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(apiKey);
      this.client = sgMail;
      this.fromEmail = this.config.get('SENDGRID_FROM_EMAIL', 'noreply@themedellinshow.com');
      this.fromName = this.config.get('SENDGRID_FROM_NAME', 'The Medellín Show');
    }
  }

  async sendEmail(params: SendEmailParams): Promise<MessageResult> {
    if (!this.client) {
      return { success: false, error: 'SendGrid not configured' };
    }

    try {
      const [response] = await this.client.send({
        to: params.to,
        from: { email: this.fromEmail, name: this.fromName },
        subject: params.subject,
        templateId: params.template,
        dynamicTemplateData: {
          ...params.variables,
          language: params.language,
        },
      });

      return { success: true, messageId: response.headers['x-message-id'] };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
