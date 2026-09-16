import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ExperiencesService } from './experiences.service';
import { CreateExperienceDto } from './dto/create-experience.dto';
import { QueryExperiencesDto } from './dto/query-experiences.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { User } from '../users/entities/user.entity';

@Controller({ path: 'experiences', version: '1' })
export class ExperiencesController {
  constructor(private expService: ExperiencesService) {}

  // Public endpoints
  @Get()
  async findAll(@Query() query: QueryExperiencesDto) {
    return this.expService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.expService.findById(id);
  }

  // Host endpoints
  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('host', 'admin')
  async create(@CurrentUser() user: User, @Body() dto: CreateExperienceDto) {
    return this.expService.create(user.id, dto);
  }

  @Get('host/mine')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('host', 'admin')
  async findMine(@CurrentUser() user: User) {
    return this.expService.findByHost(user.id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('host', 'admin')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: Partial<CreateExperienceDto>,
  ) {
    return this.expService.update(id, user.id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('host', 'admin')
  async delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    await this.expService.delete(id, user.id);
    return { message: 'Experience deleted' };
  }

  // Admin endpoints
  @Patch(':id/status')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: 'draft' | 'pending_review' | 'active' | 'paused' | 'archived',
  ) {
    return this.expService.updateStatus(id, status);
  }
}
