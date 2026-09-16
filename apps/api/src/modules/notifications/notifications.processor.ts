import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { NotificationsService, NotifyUserParams } from './notifications.service';

@Processor('notifications')
export class NotificationsProcessor {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private notificationsService: NotificationsService) {}

  @Process('send-notification')
  async handleSendNotification(job: Job<NotifyUserParams>) {
    this.logger.log(`Processing notification: ${job.data.type} for user ${job.data.userId}`);
    await this.notificationsService.processNotification(job.data);
  }
}
