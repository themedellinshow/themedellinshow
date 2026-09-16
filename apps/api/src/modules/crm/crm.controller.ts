import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CrmService, UpsertContactDto, LogInteractionDto } from './crm.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { LifecycleStage, LeadSource } from './entities/crm-contact.entity';

@Controller({ path: 'crm', version: '1' })
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin', 'partner')
export class CrmController {
  constructor(private crmService: CrmService) {}

  @Get('contacts')
  async findAll(
    @Query('lifecycleStage') lifecycleStage?: LifecycleStage,
    @Query('leadSource') leadSource?: LeadSource,
    @Query('tag') tag?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.crmService.findAll({
      lifecycleStage,
      leadSource,
      tag,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get('contacts/:id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.crmService.findById(id);
  }

  @Get('contacts/:id/interactions')
  async getInteractions(@Param('id', ParseUUIDPipe) id: string) {
    return this.crmService.getInteractions(id);
  }

  @Post('contacts')
  async upsertContact(@Body() dto: UpsertContactDto) {
    return this.crmService.upsertContact(dto);
  }

  @Post('interactions')
  async logInteraction(@Body() dto: LogInteractionDto) {
    return this.crmService.logInteraction(dto);
  }

  @Patch('contacts/:id/lifecycle')
  async updateLifecycle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('stage') stage: LifecycleStage,
  ) {
    return this.crmService.updateLifecycleStage(id, stage);
  }

  @Patch('contacts/:id/tags')
  async addTags(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('tags') tags: string[],
  ) {
    return this.crmService.addTags(id, tags);
  }
}
