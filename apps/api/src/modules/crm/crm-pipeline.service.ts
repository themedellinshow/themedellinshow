import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrmPipeline } from './entities/crm-pipeline.entity';
import { CrmStage } from './entities/crm-pipeline.entity';
import { CrmContact, LifecycleStage } from './entities/crm-contact.entity';
import { CreatePipelineDto, UpdatePipelineDto, InitialStageDto } from './dto';
import { CreateStageDto, UpdateStageDto, StageOrderDto } from './dto';

@Injectable()
export class CrmPipelineService {
  constructor(
    @InjectRepository(CrmPipeline)
    private pipelineRepo: Repository<CrmPipeline>,
    @InjectRepository(CrmStage)
    private stageRepo: Repository<CrmStage>,
    @InjectRepository(CrmContact)
    private contactRepo: Repository<CrmContact>,
  ) {}

  // ---------------------------------------------------------------------------
  // Pipelines
  // ---------------------------------------------------------------------------

  async listPipelines(activeOnly = false) {
    const qb = this.pipelineRepo.createQueryBuilder('p');
    if (activeOnly) qb.andWhere('p.isActive = true');
    qb.orderBy('p.position', 'ASC').addOrderBy('p.createdAt', 'ASC');

    const pipelines = await qb.getMany();
    const stages = await this.stageRepo.find({ order: { position: 'ASC' } });

    return pipelines.map((pipeline) => ({
      ...pipeline,
      stages: stages.filter((s) => s.pipelineId === pipeline.id),
    }));
  }

  async getPipeline(id: string) {
    const pipeline = await this.pipelineRepo.findOne({ where: { id } });
    if (!pipeline) throw new NotFoundException('Pipeline not found');

    const stages = await this.stageRepo.find({
      where: { pipelineId: id },
      order: { position: 'ASC' },
    });
    return { ...pipeline, stages };
  }

  async createPipeline(dto: CreatePipelineDto) {
    const pipeline = await this.pipelineRepo.save(
      this.pipelineRepo.create({
        name: dto.name,
        description: dto.description,
        isDefault: dto.isDefault ?? false,
        isActive: dto.isActive ?? true,
        position: dto.position ?? 0,
      }),
    );

    const initialStages = dto.stages ?? [];
    if (initialStages.length > 0) {
      await this.replaceStageOrder(pipeline.id, initialStages, true);
    }

    return this.getPipeline(pipeline.id);
  }

  async updatePipeline(id: string, dto: UpdatePipelineDto) {
    const pipeline = await this.pipelineRepo.findOne({ where: { id } });
    if (!pipeline) throw new NotFoundException('Pipeline not found');

    if (dto.name !== undefined) pipeline.name = dto.name;
    if (dto.description !== undefined) pipeline.description = dto.description;
    if (dto.isDefault !== undefined) pipeline.isDefault = dto.isDefault;
    if (dto.isActive !== undefined) pipeline.isActive = dto.isActive;
    if (dto.position !== undefined) pipeline.position = dto.position;

    await this.pipelineRepo.save(pipeline);
    return this.getPipeline(id);
  }

  async deletePipeline(id: string): Promise<void> {
    const pipeline = await this.pipelineRepo.findOne({ where: { id } });
    if (!pipeline) throw new NotFoundException('Pipeline not found');
    if (pipeline.isDefault) {
      throw new BadRequestException('Cannot delete the default pipeline');
    }

    await this.pipelineRepo.delete(id);
  }

  // ---------------------------------------------------------------------------
  // Stages
  // ---------------------------------------------------------------------------

  async listStages(pipelineId: string) {
    await this.getPipeline(pipelineId);
    return this.stageRepo.find({
      where: { pipelineId },
      order: { position: 'ASC' },
    });
  }

  async createStage(pipelineId: string, dto: CreateStageDto) {
    await this.getPipeline(pipelineId);

    const maxPos = await this.stageRepo
      .createQueryBuilder('s')
      .where('s.pipelineId = :pipelineId', { pipelineId })
      .select('MAX(s.position)', 'max')
      .getRawOne<{ max: number | null }>();

    const stage = this.stageRepo.create({
      pipelineId,
      name: dto.name,
      color: dto.color ?? '#3B82F6',
      position: dto.position ?? (maxPos?.max ?? -1) + 1,
      isWon: dto.isWon ?? false,
      isLost: dto.isLost ?? false,
      isActive: dto.isActive ?? true,
      dailyGoal: dto.dailyGoal,
    });
    return this.stageRepo.save(stage);
  }

  async updateStage(id: string, dto: UpdateStageDto) {
    const stage = await this.stageRepo.findOne({ where: { id } });
    if (!stage) throw new NotFoundException('Stage not found');

    if (dto.name !== undefined) stage.name = dto.name;
    if (dto.color !== undefined) stage.color = dto.color;
    if (dto.position !== undefined) stage.position = dto.position;
    if (dto.isWon !== undefined) stage.isWon = dto.isWon;
    if (dto.isLost !== undefined) stage.isLost = dto.isLost;
    if (dto.isActive !== undefined) stage.isActive = dto.isActive;
    if (dto.dailyGoal !== undefined) stage.dailyGoal = dto.dailyGoal;

    if (dto.isWon === true) stage.isLost = false;
    if (dto.isLost === true) stage.isWon = false;

    return this.stageRepo.save(stage);
  }

  async deleteStage(id: string): Promise<void> {
    const stage = await this.stageRepo.findOne({ where: { id } });
    if (!stage) throw new NotFoundException('Stage not found');

    await this.contactRepo
      .createQueryBuilder()
      .update(CrmContact)
      .set({ stageId: null, pipelineId: null })
      .where('stageId = :id', { id })
      .execute();

    await this.stageRepo.delete(id);
  }

  async reorderStages(pipelineId: string, orders: StageOrderDto[]): Promise<void> {
    await this.getPipeline(pipelineId);

    const stages = await this.stageRepo.find({ where: { pipelineId } });
    const byId = new Map(stages.map((s) => [s.id, s]));
    for (const order of orders) {
      const stage = byId.get(order.id);
      if (!stage) throw new BadRequestException(`Stage ${order.id} not in pipeline`);
      stage.position = order.position;
    }
    await this.stageRepo.save(stages);
  }

  private async replaceStageOrder(
    pipelineId: string,
    stages: InitialStageDto[],
    isNew: boolean,
  ): Promise<void> {
    const rows = stages.map((s, i) =>
      this.stageRepo.create({
        pipelineId,
        name: s.name,
        color: s.color ?? '#3B82F6',
        position: s.position ?? i,
        isWon: s.isWon ?? false,
        isLost: s.isLost ?? false,
        isActive: s.isActive ?? true,
        dailyGoal: s.dailyGoal,
      }),
    );
    if (isNew) {
      await this.stageRepo.save(rows);
    } else {
      await this.stageRepo.delete({ pipelineId });
      await this.stageRepo.save(rows);
    }
  }

  // ---------------------------------------------------------------------------
  // Board
  // ---------------------------------------------------------------------------

  async getBoard(pipelineId: string) {
    const pipeline = await this.getPipeline(pipelineId);
    const stages = pipeline.stages;
    if (stages.length === 0) return { ...pipeline, stages: [] };

    const stageIds = stages.map((s) => s.id);
    const contacts = await this.contactRepo
      .createQueryBuilder('c')
      .where('c.stageId IN (:...stageIds)', { stageIds })
      .orderBy('c.updatedAt', 'DESC')
      .getMany();

    return {
      ...pipeline,
      stages: stages.map((stage) => ({
        ...stage,
        contacts: contacts
          .filter((c) => c.stageId === stage.id)
          .map(({ id, firstName, lastName, email, phone, lifecycleStage, leadScore, lastContactedAt }) => ({
            id,
            firstName,
            lastName,
            email,
            phone,
            lifecycleStage,
            leadScore,
            lastContactedAt,
          })),
      })),
    };
  }

  async moveContactToStage(contactId: string, stageId: string): Promise<CrmContact> {
    const stage = await this.stageRepo.findOne({ where: { id: stageId } });
    if (!stage) throw new NotFoundException('Stage not found');
    if (!stage.isActive) {
      throw new BadRequestException('Stage is inactive');
    }

    const contact = await this.contactRepo.findOne({ where: { id: contactId } });
    if (!contact) throw new NotFoundException('Contact not found');

    contact.pipelineId = stage.pipelineId;
    contact.stageId = stage.id;
    if (stage.isWon) {
      contact.lifecycleStage = 'customer' as LifecycleStage;
    } else if (stage.isLost) {
      contact.lifecycleStage = 'inactive' as LifecycleStage;
    }
    // lastContactedAt intentionally left untouched (admin action, not outreach)

    return this.contactRepo.save(contact);
  }
}