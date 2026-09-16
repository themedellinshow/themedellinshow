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
import { HostsService } from './hosts.service';
import { CreateHostProfileDto } from './dto/create-host-profile.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { User } from '../users/entities/user.entity';
import { HostStatus } from './entities/host-profile.entity';

@Controller({ path: 'hosts', version: '1' })
export class HostsController {
  constructor(private hostsService: HostsService) {}

  @Get()
  async findAll(
    @Query('featured') featured?: string,
    @Query('superHost') superHost?: string,
    @Query('verifiedOnly') verifiedOnly?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.hostsService.findAll({
      featured: featured === 'true',
      superHost: superHost === 'true',
      verifiedOnly: verifiedOnly === 'true',
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.hostsService.findById(id);
  }

  @Post('profile')
  @UseGuards(AuthGuard('jwt'))
  async createProfile(@CurrentUser() user: User, @Body() dto: CreateHostProfileDto) {
    return this.hostsService.createProfile(user.id, dto);
  }

  @Get('me/profile')
  @UseGuards(AuthGuard('jwt'))
  async getMyProfile(@CurrentUser() user: User) {
    return this.hostsService.findByUserId(user.id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('host', 'admin')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: Partial<CreateHostProfileDto>,
  ) {
    return this.hostsService.update(id, user.id, dto);
  }

  @Patch('me/payout')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('host', 'admin')
  async setPayout(@CurrentUser() user: User, @Body('last4') last4: string) {
    return this.hostsService.setPayoutInfo(user.id, last4);
  }

  // Admin
  @Patch(':id/verify')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async verify(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() checks: { identity?: boolean; address?: boolean },
  ) {
    return this.hostsService.verify(id, checks);
  }

  @Patch(':id/status')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: HostStatus,
  ) {
    return this.hostsService.updateStatus(id, status);
  }

  @Patch(':id/super-host')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async setSuperHost(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('superHost') superHost: boolean,
  ) {
    return this.hostsService.setSuperHost(id, superHost);
  }
}
