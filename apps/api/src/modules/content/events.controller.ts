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
import { EventsService, QueryEventsDto } from './events.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Event, EventStatus } from './entities/event.entity';

@Controller({ path: 'events', version: '1' })
export class EventsController {
  constructor(private eventsService: EventsService) {}

  @Get()
  async findAll(@Query() query: QueryEventsDto) {
    return this.eventsService.findAll(query);
  }

  @Get('upcoming')
  async upcoming(@Query('days') days?: string) {
    return this.eventsService.findUpcoming(days ? parseInt(days) : undefined);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.findById(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'partner')
  async create(@Body() data: Partial<Event>) {
    return this.eventsService.create(data);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'partner')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() data: Partial<Event>) {
    return this.eventsService.update(id, data);
  }

  @Patch(':id/status')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: EventStatus,
  ) {
    return this.eventsService.updateStatus(id, status);
  }
}
