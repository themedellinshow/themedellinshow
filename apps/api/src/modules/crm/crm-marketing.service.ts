import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrmCampaign, CampaignStatus } from './entities/crm-campaign.entity';
import { CrmCampaignRecipient } from './entities/crm-campaign-recipient.entity';
import { CrmAutomation, AutomationAction } from './entities/crm-automation.entity';
import { CrmAutomationRun } from './entities/crm-automation-run.entity';
import { CreateCampaignDto, UpdateCampaignDto } from './dto';
import { CreateAutomationDto, UpdateAutomationDto } from './dto';
import { CrmService } from './crm.service';
import { CrmSegmentMember } from './entities/crm-segment-member.entity';
import { CrmTaskPriority } from './entities/crm-task.entity';
import { InteractionType, InteractionChannel } from './entities/crm-interaction.entity';

@Injectable()
export class CrmMarketingService {
  private readonly logger = new Logger(CrmMarketingService.name);

  constructor(
    @InjectRepository(CrmCampaign)
    private campaignRepo: Repository<CrmCampaign>,
    @InjectRepository(CrmCampaignRecipient)
    private recipientRepo: Repository<CrmCampaignRecipient>,
    @InjectRepository(CrmAutomation)
    private automationRepo: Repository<CrmAutomation>,
    @InjectRepository(CrmAutomationRun)
    private runRepo: Repository<CrmAutomationRun>,
    @InjectRepository(CrmSegmentMember)
    private segmentMemberRepo: Repository<CrmSegmentMember>,
    private crm: CrmService,
  ) {}

  // ---------------------------------------------------------------------------
  // Campaigns
  // ---------------------------------------------------------------------------

  async createCampaign(createdByUserId: string, dto: CreateCampaignDto): Promise<CrmCampaign> {
    const campaign = this.campaignRepo.create({
      name: dto.name,
      description: dto.description,
      channel: dto.channel,
      subject: dto.subject,
      body: dto.body,
      providerTemplateId: dto.providerTemplateId,
      segmentId: dto.segmentId,
      contactCriteria: (dto.contactCriteria as unknown as Record<string, unknown>) ?? undefined,
      status: dto.status ?? 'draft',
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      createdByUserId,
    });
    return this.campaignRepo.save(campaign);
  }

  async listCampaigns(query: { status?: string; channel?: string; page?: number; limit?: number }) {
    const qb = this.campaignRepo.createQueryBuilder('c');

    if (query.status) qb.andWhere('c.status = :status', { status: query.status });
    if (query.channel) qb.andWhere('c.channel = :channel', { channel: query.channel });

    const page = query.page || 1;
    const limit = query.limit || 50;
    qb.orderBy('c.updatedAt', 'DESC').skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getCampaign(id: string): Promise<CrmCampaign> {
    const campaign = await this.campaignRepo.findOne({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async updateCampaign(id: string, dto: UpdateCampaignDto): Promise<CrmCampaign> {
    const campaign = await this.getCampaign(id);
    if (['sending', 'sent', 'completed'].includes(campaign.status)) {
      throw new BadRequestException('Campaign already sent; cannot edit');
    }

    if (dto.name !== undefined) campaign.name = dto.name;
    if (dto.description !== undefined) campaign.description = dto.description;
    if (dto.channel !== undefined) campaign.channel = dto.channel;
    if (dto.subject !== undefined) campaign.subject = dto.subject;
    if (dto.body !== undefined) campaign.body = dto.body;
    if (dto.providerTemplateId !== undefined) campaign.providerTemplateId = dto.providerTemplateId;
    if (dto.segmentId !== undefined) campaign.segmentId = dto.segmentId;
    if (dto.contactCriteria !== undefined) {
      campaign.contactCriteria = dto.contactCriteria as unknown as Record<string, unknown>;
    }
    if (dto.status !== undefined) campaign.status = dto.status as CampaignStatus;
    if (dto.scheduledAt !== undefined) {
      campaign.scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    }

    return this.campaignRepo.save(campaign);
  }

  async deleteCampaign(id: string): Promise<void> {
    const campaign = await this.getCampaign(id);
    await this.campaignRepo.delete(campaign.id);
  }

  async getCampaignRecipients(campaignId: string, page = 1, limit = 50) {
    await this.getCampaign(campaignId);
    const [items, total] = await this.recipientRepo.findAndCount({
      where: { campaignId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  /** Resolve the audience for a campaign: segment members or contactCriteria filter. */
  async resolveCampaignAudience(campaign: CrmCampaign): Promise<CrmCampaignRecipient[]> {
    let contactIds: string[] = [];

    if (campaign.segmentId) {
      const rows = await this.segmentMemberRepo.find({ where: { segmentId: campaign.segmentId } });
      contactIds = rows.map((m) => m.contactId);
    } else if (campaign.contactCriteria && Object.keys(campaign.contactCriteria).length > 0) {
      const contacts = await this.crm.findContactsByFilter(campaign.contactCriteria);
      contactIds = contacts.map((c) => c.id);
    }

    if (contactIds.length === 0) return [];

    const contacts = await this.crm.findContactsByIds(contactIds);
    return contacts.map((c) =>
      this.recipientRepo.create({
        campaignId: campaign.id,
        contactId: c.id,
        email: c.email,
        phone: c.phone ?? undefined,
      }),
    );
  }

  /** Job body: materialize recipients and mark delivery + tracked interactions. */
  async executeCampaign(campaignId: string): Promise<void> {
    const campaign = await this.getCampaign(campaignId);

    if (campaign.status === 'sending' || campaign.status === 'sent' || campaign.status === 'completed') {
      return; // idempotent guard
    }

    const existing = await this.recipientRepo.count({ where: { campaignId } });
    if (existing > 0) {
      return;
    }

    const recipients = await this.resolveCampaignAudience(campaign);
    await this.recipientRepo.save(recipients);

    campaign.status = 'sending';
    campaign.startedAt = new Date();
    campaign.totalRecipients = recipients.length;
    await this.campaignRepo.save(campaign);

    if (recipients.length === 0) {
      campaign.status = 'completed';
      campaign.completedAt = new Date();
      await this.campaignRepo.save(campaign);
      return;
    }

    const now = new Date();
    const interactionType =
      campaign.channel === 'email'
        ? 'email_sent'
        : campaign.channel === 'whatsapp'
          ? 'whatsapp_sent'
          : 'sms_sent';

    for (const recipient of recipients) {
      try {
        await this.recipientRepo.update(recipient.id, { status: 'sent', sentAt: now });
        await this.crm.logInteraction({
          contactId: recipient.contactId,
          type: interactionType as 'email_sent' | 'whatsapp_sent' | 'sms_sent',
          channel: campaign.channel as 'email' | 'whatsapp' | 'sms',
          subject: campaign.subject ?? `Campaign: ${campaign.name}`,
          metadata: { campaignId: campaign.id, campaignName: campaign.name },
        });
        campaign.sentCount += 1;
      } catch (error) {
        await this.recipientRepo.update(recipient.id, {
          status: 'failed',
          error: String(error),
        });
        campaign.failedCount += 1;
      }
    }

    campaign.deliveredCount = campaign.sentCount;
    campaign.status = 'completed';
    campaign.completedAt = new Date();
    await this.campaignRepo.save(campaign);
  }

  // ---------------------------------------------------------------------------
  // Automations
  // ---------------------------------------------------------------------------

  async createAutomation(dto: CreateAutomationDto): Promise<CrmAutomation> {
    const automation = this.automationRepo.create({
      name: dto.name,
      description: dto.description,
      eventType: dto.eventType,
      conditions: dto.conditions ?? { combinator: 'and', conditions: [] },
      actions: dto.actions as unknown as AutomationAction[],
      status: dto.status ?? 'active',
      priority: dto.priority ?? 0,
      cooldownMinutes: dto.cooldownMinutes ?? 0,
    });
    return this.automationRepo.save(automation);
  }

  async listAutomations(query: { status?: string; eventType?: string; page?: number; limit?: number }) {
    const qb = this.automationRepo.createQueryBuilder('a');

    if (query.status) qb.andWhere('a.status = :status', { status: query.status });
    if (query.eventType) qb.andWhere('a.eventType = :eventType', { eventType: query.eventType });

    const page = query.page || 1;
    const limit = query.limit || 50;
    qb.orderBy('a.priority', 'ASC').addOrderBy('a.updatedAt', 'DESC').skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getAutomation(id: string): Promise<CrmAutomation> {
    const automation = await this.automationRepo.findOne({ where: { id } });
    if (!automation) throw new NotFoundException('Automation not found');
    return automation;
  }

  async updateAutomation(id: string, dto: UpdateAutomationDto): Promise<CrmAutomation> {
    const automation = await this.getAutomation(id);

    if (dto.name !== undefined) automation.name = dto.name;
    if (dto.description !== undefined) automation.description = dto.description;
    if (dto.eventType !== undefined) automation.eventType = dto.eventType;
    if (dto.conditions !== undefined) automation.conditions = dto.conditions;
    if (dto.actions !== undefined) automation.actions = dto.actions as unknown as AutomationAction[];
    if (dto.status !== undefined) automation.status = dto.status;
    if (dto.priority !== undefined) automation.priority = dto.priority;
    if (dto.cooldownMinutes !== undefined) automation.cooldownMinutes = dto.cooldownMinutes;

    return this.automationRepo.save(automation);
  }

  async deleteAutomation(id: string): Promise<void> {
    const automation = await this.getAutomation(id);
    await this.automationRepo.delete(automation.id);
  }

  async getAutomationRuns(automationId: string, page = 1, limit = 50) {
    const [items, total] = await this.runRepo.findAndCount({
      where: { automationId },
      order: { executedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async listRuns(query: { automationId?: string; contactId?: string; status?: string; page?: number; limit?: number }) {
    const qb = this.runRepo.createQueryBuilder('r');

    if (query.automationId) qb.andWhere('r.automationId = :automationId', { automationId: query.automationId });
    if (query.contactId) qb.andWhere('r.contactId = :contactId', { contactId: query.contactId });
    if (query.status) qb.andWhere('r.status = :status', { status: query.status });

    const page = query.page || 1;
    const limit = query.limit || 50;
    qb.orderBy('r.executedAt', 'DESC').skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  /** Event-fired automation fan-out. Runs every active automation matching the event against a single contact. */
  async runAutomationsForEvent(eventType: string, contactId?: string): Promise<void> {
    if (!contactId) return;

    const automations = await this.automationRepo.find({
      where: { eventType, status: 'active' as const },
      order: { priority: 'ASC' },
    });

    for (const automation of automations) {
      try {
        await this.executeAutomation(automation.id, [contactId]);
      } catch (error) {
        // A failing automation must never break the originating event.
        this.logger.warn(`Automation ${automation.id} (${automation.name}) failed: ${String(error)}`);
      }
    }
  }

  /** Job body: run an automation against a set of contacts. */
  async executeAutomation(automationId: string, contactIds?: string[]): Promise<void> {
    const automation = await this.getAutomation(automationId);
    if (automation.status !== 'active') {
      throw new BadRequestException('Automation is not active');
    }

    // Cooldown guard
    if (
      automation.cooldownMinutes > 0 &&
      automation.lastTriggeredAt &&
      Date.now() - automation.lastTriggeredAt.getTime() < automation.cooldownMinutes * 60 * 1000
    ) {
      return;
    }

    const ids = contactIds && contactIds.length > 0 ? contactIds : [];
    const contacts = ids.length > 0 ? await this.crm.findContactsByIds(ids) : [];

    for (const contact of contacts) {
      try {
        await this.applyActions(automation, contact.id);
        await this.runRepo.save(
          this.runRepo.create({
            automationId,
            contactId: contact.id,
            eventType: automation.eventType,
            status: 'success',
            result: { actionsApplied: automation.actions.length },
          }),
        );
      } catch (error) {
        await this.runRepo.save(
          this.runRepo.create({
            automationId,
            contactId: contact.id,
            eventType: automation.eventType,
            status: 'failed',
            error: String(error),
          }),
        );
      }
    }

    automation.lastTriggeredAt = new Date();
    automation.runCount += contacts.length;
    await this.automationRepo.save(automation);
  }

  private async applyActions(automation: CrmAutomation, contactId: string): Promise<void> {
    for (const action of automation.actions) {
      switch (action.type) {
        case 'add_tags':
          if (action.tags && action.tags.length > 0) {
            await this.crm.addTags(contactId, action.tags);
          }
          break;
        case 'log_interaction':
          await this.crm.logInteraction({
            contactId,
            type: action.interactionType as InteractionType,
            channel: action.interactionChannel as InteractionChannel,
            subject: action.subject,
            content: action.content,
            metadata: { automationId: automation.id },
          });
          break;
        case 'create_task':
          await this.crm.createTask({
            title: action.taskTitle ?? `Follow up: ${automation.name}`,
            priority: (action.taskPriority as CrmTaskPriority) || undefined,
            contactId,
            dueAt: action.dueInDays
              ? new Date(Date.now() + action.dueInDays * 24 * 60 * 60 * 1000).toISOString()
              : undefined,
          });
          break;
        case 'update_lifecycle':
          if (action.lifecycleStage) {
            await this.crm.updateLifecycleStage(contactId, action.lifecycleStage as never);
          }
          break;
        default:
          break;
      }
    }
  }
}