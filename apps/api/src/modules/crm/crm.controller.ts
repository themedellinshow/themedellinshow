import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { CrmService } from './crm.service';
import { CrmQueueService } from './crm.queue.service';
import { CrmAuditService } from './crm-audit.service';
import { CrmMarketingService } from './crm-marketing.service';
import { CrmPipelineService } from './crm-pipeline.service';
import { ConsentsDto } from './dto/consents.dto';
import { LogInteractionDto } from './dto/log-interaction.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { UpsertContactDto } from './dto/upsert-contact.dto';
import {
  CreateSegmentDto,
  UpdateSegmentDto,
  CreateTaskDto,
  UpdateTaskDto,
  CreateCampaignDto,
  UpdateCampaignDto,
  CreateAutomationDto,
  UpdateAutomationDto,
  TriggerAutomationDto,
  CreateContactNoteDto,
  MergeContactsDto,
  CreatePipelineDto,
  UpdatePipelineDto,
  CreateStageDto,
  UpdateStageDto,
  ReorderStagesDto,
  MoveContactStageDto,
} from './dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { LifecycleStage, LeadSource } from './entities/crm-contact.entity';
import { CrmTaskStatus } from './entities/crm-task.entity';

@Controller({ path: 'crm', version: '1' })
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin', 'partner')
export class CrmController {
  constructor(
    private crmService: CrmService,
    private crmQueue: CrmQueueService,
    private audit: CrmAuditService,
    private marketing: CrmMarketingService,
    private pipeline: CrmPipelineService,
  ) {}

  private async recordAudit(
    user: User,
    action: string,
    entityType: string,
    entityId?: string,
    changes?: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.log({
      actorId: user.id,
      action,
      entityType,
      entityId,
      changes,
    });
  }

  // ---------------------------------------------------------------------------
  // Contacts
  // ---------------------------------------------------------------------------

  @Get('contacts')
  async findAll(
    @Query('email') email?: string,
    @Query('lifecycleStage') lifecycleStage?: LifecycleStage,
    @Query('leadSource') leadSource?: LeadSource,
    @Query('tag') tag?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.crmService.findAll({
      email,
      lifecycleStage,
      leadSource,
      tag,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Post('backfill')
  @Roles('admin')
  async runBackfill(@CurrentUser() user: User) {
    const result = await this.crmService.runBackfill();
    await this.recordAudit(user, 'backfill', 'crm', undefined, result as Record<string, unknown>);
    return result;
  }

  @Get('contacts/:id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.crmService.findById(id);
  }

  @Get('contacts/:id/interactions')
  async getInteractions(@Param('id', ParseUUIDPipe) id: string) {
    return this.crmService.getInteractions(id);
  }

  @Get('contacts/:id/export')
  async exportOne(@Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) res: Response) {
    const csv = await this.crmService.exportCsv([id]);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="contact-${id}.csv"`,
    });
    return csv;
  }

  @Post('contacts')
  async upsertContact(@CurrentUser() user: User, @Body() dto: UpsertContactDto) {
    const contact = await this.crmService.upsertContact(dto);
    await this.recordAudit(user, 'contact.upsert', 'contact', contact.id, { email: dto.email });
    return contact;
  }

  @Post('interactions')
  async logInteraction(@CurrentUser() user: User, @Body() dto: LogInteractionDto) {
    const interaction = await this.crmService.logInteraction(dto);
    await this.recordAudit(user, 'interaction.create', 'interaction', interaction.id, {
      type: dto.type,
      channel: dto.channel,
    });
    return interaction;
  }

  @Patch('contacts/:id')
  async updateContact(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContactDto,
  ) {
    const contact = await this.crmService.updateContact(id, dto);
    await this.recordAudit(user, 'contact.update', 'contact', id, dto as Record<string, unknown>);
    return contact;
  }

  @Patch('contacts/:id/lifecycle')
  async updateLifecycle(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('stage') stage: LifecycleStage,
  ) {
    const contact = await this.crmService.updateLifecycleStage(id, stage);
    await this.recordAudit(user, 'contact.lifecycle', 'contact', id, { stage });
    return contact;
  }

  @Patch('contacts/:id/consents')
  async updateConsents(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConsentsDto,
  ) {
    const contact = await this.crmService.updateConsents(id, dto);
    await this.recordAudit(user, 'contact.consents', 'contact', id, dto as Record<string, unknown>);
    return contact;
  }

  @Patch('contacts/:id/tags')
  async addTags(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('tags') tags: string[],
  ) {
    const contact = await this.crmService.addTags(id, tags);
    await this.recordAudit(user, 'contact.tags', 'contact', id, { tags });
    return contact;
  }

  @Get('tags')
  async listTags() {
    return this.crmService.listTags();
  }

  @Post('contacts/merge')
  async mergeContacts(@CurrentUser() user: User, @Body() dto: MergeContactsDto) {
    const contact = await this.crmService.mergeContacts(dto.sourceId, dto.targetId);
    await this.recordAudit(user, 'contact.merge', 'contact', dto.targetId, {
      sourceId: dto.sourceId,
      targetId: dto.targetId,
    });
    return contact;
  }

  @Get('dashboard')
  async getDashboard() {
    return this.crmService.getDashboard();
  }

  // ---------------------------------------------------------------------------
  // Segments
  // ---------------------------------------------------------------------------

  @Get('segments')
  async listSegments(
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.crmService.listSegments({
      isActive: isActive === undefined ? undefined : isActive === 'true',
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Post('segments')
  async createSegment(@CurrentUser() user: User, @Body() dto: CreateSegmentDto) {
    const segment = await this.crmService.createSegment(user.id, dto);
    await this.recordAudit(user, 'segment.create', 'segment', segment.id, { name: dto.name });
    return segment;
  }

  @Get('segments/:id')
  async getSegment(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.crmService.getSegment(id, page ? parseInt(page) : 1, limit ? parseInt(limit) : 50);
  }

  @Patch('segments/:id')
  async updateSegment(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSegmentDto,
  ) {
    const segment = await this.crmService.updateSegment(id, dto);
    await this.recordAudit(user, 'segment.update', 'segment', id, dto as Record<string, unknown>);
    return segment;
  }

  @Delete('segments/:id')
  async deleteSegment(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    await this.crmService.deleteSegment(id);
    await this.recordAudit(user, 'segment.delete', 'segment', id);
    return { deleted: true };
  }

  @Post('segments/:id/refresh')
  async refreshSegment(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    await this.crmService.getSegment(id, 1, 1);
    await this.crmQueue.refreshSegment(id);
    await this.recordAudit(user, 'segment.refresh', 'segment', id);
    return { queued: true, segmentId: id };
  }

  // ---------------------------------------------------------------------------
  // Tasks
  // ---------------------------------------------------------------------------

  @Get('tasks')
  async listTasks(
    @Query('assigneeId') assigneeId?: string,
    @Query('contactId') contactId?: string,
    @Query('segmentId') segmentId?: string,
    @Query('status') status?: CrmTaskStatus,
    @Query('priority') priority?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.crmService.listTasks({
      assigneeId,
      contactId,
      segmentId,
      status,
      priority,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Post('tasks')
  async createTask(@CurrentUser() user: User, @Body() dto: CreateTaskDto) {
    const task = await this.crmService.createTask(dto);
    await this.recordAudit(user, 'task.create', 'task', task.id, { title: task.title });
    return task;
  }

  @Get('tasks/:id')
  async getTask(@Param('id', ParseUUIDPipe) id: string) {
    return this.crmService.getTask(id);
  }

  @Patch('tasks/:id')
  async updateTask(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    const task = await this.crmService.updateTask(id, dto);
    await this.recordAudit(user, 'task.update', 'task', id, dto as Record<string, unknown>);
    return task;
  }

  @Delete('tasks/:id')
  async deleteTask(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    await this.crmService.deleteTask(id);
    await this.recordAudit(user, 'task.delete', 'task', id);
    return { deleted: true };
  }

  // ---------------------------------------------------------------------------
  // Contact notes
  // ---------------------------------------------------------------------------

  @Get('contacts/:id/notes')
  async getContactNotes(@Param('id', ParseUUIDPipe) id: string) {
    return this.crmService.listContactNotes(id);
  }

  @Post('contacts/:id/notes')
  async addContactNote(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateContactNoteDto,
  ) {
    const note = await this.crmService.addContactNote(id, user.id, dto.body, dto.metadata);
    await this.recordAudit(user, 'note.create', 'contact', id, {
      noteId: note.id,
      body: dto.body,
    });
    return note;
  }

  @Delete('contacts/:id/notes/:noteId')
  async deleteContactNote(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
  ) {
    await this.crmService.deleteContactNote(id, noteId);
    await this.recordAudit(user, 'note.delete', 'contact', id, { noteId });
    return { deleted: true };
  }

  // ---------------------------------------------------------------------------
  // Campaigns
  // ---------------------------------------------------------------------------

  @Get('campaigns')
  async listCampaigns(
    @Query('status') status?: string,
    @Query('channel') channel?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.marketing.listCampaigns({
      status,
      channel,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Post('campaigns')
  async createCampaign(@CurrentUser() user: User, @Body() dto: CreateCampaignDto) {
    const campaign = await this.marketing.createCampaign(user.id, dto);
    await this.recordAudit(user, 'campaign.create', 'campaign', campaign.id, {
      name: campaign.name,
      channel: campaign.channel,
    });
    return campaign;
  }

  @Get('campaigns/:id')
  async getCampaign(@Param('id', ParseUUIDPipe) id: string) {
    return this.marketing.getCampaign(id);
  }

  @Patch('campaigns/:id')
  async updateCampaign(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    const campaign = await this.marketing.updateCampaign(id, dto);
    await this.recordAudit(user, 'campaign.update', 'campaign', id, dto as Record<string, unknown>);
    return campaign;
  }

  @Delete('campaigns/:id')
  async deleteCampaign(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    await this.marketing.deleteCampaign(id);
    await this.recordAudit(user, 'campaign.delete', 'campaign', id);
    return { deleted: true };
  }

  @Post('campaigns/:id/send')
  async sendCampaign(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    await this.marketing.getCampaign(id);
    await this.crmQueue.runCampaign(id);
    await this.recordAudit(user, 'campaign.send', 'campaign', id);
    return { queued: true, campaignId: id };
  }

  @Get('campaigns/:id/recipients')
  async getCampaignRecipients(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.marketing.getCampaignRecipients(
      id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
  }

  // ---------------------------------------------------------------------------
  // Automations
  // ---------------------------------------------------------------------------

  @Get('automations')
  async listAutomations(
    @Query('status') status?: string,
    @Query('eventType') eventType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.marketing.listAutomations({
      status,
      eventType,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Post('automations')
  async createAutomation(@CurrentUser() user: User, @Body() dto: CreateAutomationDto) {
    const automation = await this.marketing.createAutomation(dto);
    await this.recordAudit(user, 'automation.create', 'automation', automation.id, {
      name: automation.name,
      eventType: automation.eventType,
    });
    return automation;
  }

  @Get('automations/:id')
  async getAutomation(@Param('id', ParseUUIDPipe) id: string) {
    return this.marketing.getAutomation(id);
  }

  @Patch('automations/:id')
  async updateAutomation(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAutomationDto,
  ) {
    const automation = await this.marketing.updateAutomation(id, dto);
    await this.recordAudit(user, 'automation.update', 'automation', id, dto as Record<string, unknown>);
    return automation;
  }

  @Delete('automations/:id')
  async deleteAutomation(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    await this.marketing.deleteAutomation(id);
    await this.recordAudit(user, 'automation.delete', 'automation', id);
    return { deleted: true };
  }

  @Post('automations/:id/trigger')
  async triggerAutomation(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TriggerAutomationDto,
  ) {
    await this.marketing.getAutomation(id);
    await this.crmQueue.runAutomation(id, dto.contactIds);
    await this.recordAudit(user, 'automation.trigger', 'automation', id);
    return { queued: true, automationId: id };
  }

  @Get('automations/:id/runs')
  async getAutomationRuns(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.marketing.getAutomationRuns(
      id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
  }

  @Get('automation-runs')
  async listRuns(
    @Query('automationId') automationId?: string,
    @Query('contactId') contactId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.marketing.listRuns({
      automationId,
      contactId,
      status,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  // ---------------------------------------------------------------------------
  // Pipelines & stages
  // ---------------------------------------------------------------------------

  @Get('pipelines')
  async listPipelines(@Query('activeOnly') activeOnly?: string) {
    return this.pipeline.listPipelines(activeOnly === 'true');
  }

  @Post('pipelines')
  async createPipeline(@CurrentUser() user: User, @Body() dto: CreatePipelineDto) {
    const pipeline = await this.pipeline.createPipeline(dto);
    await this.recordAudit(user, 'pipeline.create', 'pipeline', pipeline.id, {
      name: pipeline.name,
    });
    return pipeline;
  }

  @Get('pipelines/:id')
  async getPipeline(@Param('id', ParseUUIDPipe) id: string) {
    return this.pipeline.getPipeline(id);
  }

  @Patch('pipelines/:id')
  async updatePipeline(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePipelineDto,
  ) {
    const pipeline = await this.pipeline.updatePipeline(id, dto);
    await this.recordAudit(user, 'pipeline.update', 'pipeline', id, dto as Record<string, unknown>);
    return pipeline;
  }

  @Delete('pipelines/:id')
  async deletePipeline(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    await this.pipeline.deletePipeline(id);
    await this.recordAudit(user, 'pipeline.delete', 'pipeline', id);
    return { deleted: true };
  }

  @Get('pipelines/:id/board')
  async getBoard(@Param('id', ParseUUIDPipe) id: string) {
    return this.pipeline.getBoard(id);
  }

  @Post('pipelines/:id/stages')
  async createStage(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateStageDto,
  ) {
    const stage = await this.pipeline.createStage(id, dto);
    await this.recordAudit(user, 'stage.create', 'stage', stage.id, { name: stage.name });
    return stage;
  }

  @Post('pipelines/:id/stages/reorder')
  async reorderStages(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderStagesDto,
  ) {
    await this.pipeline.reorderStages(id, dto.orders);
    await this.recordAudit(user, 'stage.reorder', 'pipeline', id);
    return this.pipeline.listStages(id);
  }

  @Patch('stages/:id')
  async updateStage(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStageDto,
  ) {
    const stage = await this.pipeline.updateStage(id, dto);
    await this.recordAudit(user, 'stage.update', 'stage', id, dto as Record<string, unknown>);
    return stage;
  }

  @Delete('stages/:id')
  async deleteStage(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    await this.pipeline.deleteStage(id);
    await this.recordAudit(user, 'stage.delete', 'stage', id);
    return { deleted: true };
  }

  @Post('contacts/:id/move-stage')
  async moveContactStage(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveContactStageDto,
  ) {
    const contact = await this.pipeline.moveContactToStage(id, dto.stageId);
    await this.recordAudit(user, 'contact.move-stage', 'contact', id, { stageId: dto.stageId });
    return contact;
  }

  // ---------------------------------------------------------------------------
  // Audit
  // ---------------------------------------------------------------------------

  @Get('audit')
  async listAudit(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('actorId') actorId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.audit.list({
      entityType,
      entityId,
      actorId,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }
}