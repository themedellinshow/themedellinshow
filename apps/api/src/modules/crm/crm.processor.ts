import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrmService } from './crm.service';
import { CrmQueueService, TrackInteractionPayload, TrackBookingPayload, LinkUserPayload, RefreshSegmentPayload, RunCampaignPayload, RunAutomationPayload, TriggerAutomationsPayload } from './crm.queue.service';
import { CrmMarketingService } from './crm-marketing.service';
import { CrmInteraction, InteractionType } from './entities/crm-interaction.entity';
import { User } from '../users/entities/user.entity';

const BOOKING_INTERACTION_TYPE: Record<string, InteractionType> = {
  created: 'booking_created',
  confirmed: 'booking_confirmed',
  paid: 'booking_paid',
  completed: 'booking_completed',
  cancelled: 'booking_cancelled',
};

// Booking events that also fan out to event-driven automations.
const BOOKING_AUTOMATION_EVENTS: ReadonlySet<string> = new Set([
  'booking_confirmed',
  'booking_paid',
]);

@Processor('crm')
export class CrmProcessor {
  private readonly logger = new Logger(CrmProcessor.name);

  constructor(
    private readonly crmService: CrmService,
    private readonly crmQueue: CrmQueueService,
    private readonly marketing: CrmMarketingService,
    @InjectRepository(CrmInteraction)
    private readonly interactionRepo: Repository<CrmInteraction>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  @Process('track-booking')
  async handleBookingEvent(job: Job<TrackBookingPayload>) {
    const payload = job.data;
    const type = BOOKING_INTERACTION_TYPE[payload.type];
    if (!type) {
      this.logger.warn(`Unknown booking event type: ${payload.type}`);
      return;
    }

    const bookingId = payload.metadata?.bookingId as string | undefined;

    // Dedup: avoid double-counting paid/completed bookings and duplicate
    // interaction rows (webhooks, retries, idempotent reprocessing).
    if (bookingId && (await this.alreadyLogged(type, bookingId))) {
      this.logger.log(`Skipping duplicate ${type} for booking ${bookingId}`);
      return;
    }

    if (type === 'booking_paid' || type === 'booking_completed') {
      if (payload.email) {
        const value = Number(payload.bookingValueCop) || 0;
        await this.crmService.recordBooking(payload.email, value);
      }
    }

    await this.crmService.logInteraction({
      email: payload.email,
      type,
      channel: 'app',
      subject: payload.metadata?.bookingReference as string | undefined,
      metadata: payload.metadata,
    });

    if (BOOKING_AUTOMATION_EVENTS.has(type) && payload.email) {
      const contact = await this.crmService.findByEmail(payload.email);
      if (contact) {
        await this.marketing.runAutomationsForEvent(type, contact.id);
      }
    }
  }

  @Process('track-interaction')
  async handleInteraction(job: Job<TrackInteractionPayload>) {
    const payload = job.data;
    let email = payload.email;

    if (!payload.contactId && !email && payload.userId) {
      const user = await this.userRepo.findOne({ where: { id: payload.userId } });
      email = user?.email;
    }

    await this.crmService.logInteraction({
      contactId: payload.contactId,
      email,
      type: payload.type,
      channel: payload.channel,
      subject: payload.subject,
      content: payload.content,
      metadata: payload.metadata,
    });
  }

  @Process('link-user')
  async handleLinkUser(job: Job<LinkUserPayload>) {
    const { email, userId } = job.data;
    const contact = await this.crmService.upsertContact({ email, userId });
    await this.marketing.runAutomationsForEvent('contact_created', contact.id);
  }

  @Process('trigger-automations')
  async handleTriggerAutomations(job: Job<TriggerAutomationsPayload>) {
    const payload = job.data;

    let contactId = payload.contactId;
    if (!contactId && payload.userId) {
      const linked = await this.userRepo.findOne({ where: { id: payload.userId } });
      if (linked) {
        const contact = await this.crmService.findByEmail(linked.email);
        contactId = contact?.id;
      }
    }
    if (!contactId && payload.email) {
      const contact = await this.crmService.findByEmail(payload.email);
      contactId = contact?.id;
    }

    await this.marketing.runAutomationsForEvent(payload.eventType, contactId);
  }

  @Process('refresh-segment')
  async handleRefreshSegment(job: Job<RefreshSegmentPayload>) {
    const { segmentId } = job.data;
    const result = await this.crmService.refreshSegment(segmentId);
    this.logger.log(
      `Segment ${segmentId} refreshed: ${result.memberCount} members`,
    );
  }

  @Process('run-campaign')
  async handleRunCampaign(job: Job<RunCampaignPayload>) {
    const { campaignId } = job.data;
    await this.marketing.executeCampaign(campaignId);
    this.logger.log(`Campaign ${campaignId} processed`);
  }

  @Process('run-automation')
  async handleRunAutomation(job: Job<RunAutomationPayload>) {
    const { automationId, contactIds } = job.data;
    await this.marketing.executeAutomation(automationId, contactIds);
    this.logger.log(`Automation ${automationId} processed`);
  }

  private async alreadyLogged(type: string, bookingId?: string): Promise<boolean> {
    if (!bookingId) return false;
    const count = await this.interactionRepo
      .createQueryBuilder('i')
      .where('i.type = :type', { type })
      .andWhere('i.metadata @> :md', { md: `{"bookingId":"${bookingId}"}` })
      .getCount();
    return count > 0;
  }
}