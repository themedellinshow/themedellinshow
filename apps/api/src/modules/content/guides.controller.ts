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
import { GuidesService, QueryGuidesDto } from './guides.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Guide, GuideStatus } from './entities/guide.entity';

@Controller({ path: 'guides', version: '1' })
export class GuidesController {
  constructor(private guidesService: GuidesService) {}

  @Get()
  async findAll(@Query() query: QueryGuidesDto) {
    return this.guidesService.findAll(query);
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.guidesService.findBySlug(slug);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.guidesService.findById(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async create(@Body() data: Partial<Guide>) {
    return this.guidesService.create(data);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() data: Partial<Guide>) {
    return this.guidesService.update(id, data);
  }

  @Patch(':id/publish')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async publish(@Param('id', ParseUUIDPipe) id: string) {
    return this.guidesService.publish(id);
  }

  @Patch(':id/status')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: GuideStatus,
  ) {
    return this.guidesService.updateStatus(id, status);
  }
}
