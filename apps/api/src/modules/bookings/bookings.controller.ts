import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { User } from '../users/entities/user.entity';

@Controller({ path: 'bookings', version: '1' })
@UseGuards(AuthGuard('jwt'))
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(user.id, dto);
  }

  @Get('mine')
  async findMine(@CurrentUser() user: User) {
    return this.bookingsService.findByTraveler(user.id);
  }

  @Get('host')
  @UseGuards(RolesGuard)
  @Roles('host', 'admin')
  async findAsHost(@CurrentUser() user: User) {
    return this.bookingsService.findByHost(user.id);
  }

  @Get('ref/:reference')
  async findByReference(@Param('reference') ref: string) {
    return this.bookingsService.findByReference(ref);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.bookingsService.findById(id);
  }

  @Patch(':id/confirm')
  @UseGuards(RolesGuard)
  @Roles('host', 'admin')
  async confirm(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.bookingsService.confirm(id, user.id);
  }

  @Patch(':id/complete')
  @UseGuards(RolesGuard)
  @Roles('host', 'admin')
  async complete(@Param('id', ParseUUIDPipe) id: string) {
    return this.bookingsService.complete(id);
  }

  @Patch(':id/cancel')
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body('reason') reason: string,
  ) {
    return this.bookingsService.cancel(id, user.id, reason);
  }

  @Post(':id/dispute')
  async openDispute(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body('reason') reason: string,
  ) {
    return this.bookingsService.openDispute(id, user.id, user.role, reason);
  }

  @Post(':id/dispute/resolve')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async resolveDispute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('resolution') resolution: 'resolved_without_refund' | 'full_refund' | 'partial_refund',
    @Body('note') note?: string,
  ) {
    return this.bookingsService.resolveDispute(id, resolution, note);
  }
}
