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
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PartnersService } from './partners.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { PartnerStatus } from './entities/partner.entity';

@Controller({ path: 'partners', version: '1' })
export class PartnersController {
  constructor(private partnersService: PartnersService) {}

  // Admin: full CRUD
  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async create(@Body() dto: CreatePartnerDto) {
    return this.partnersService.create(dto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async findAll(
    @Query('status') status?: PartnerStatus,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.partnersService.findAll({
      status,
      type,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'partner')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    const partner = await this.partnersService.findById(id);
    if (user.role === 'partner' && partner.ownerUserId !== user.id) {
      throw new ForbiddenException('Not authorized');
    }
    return partner;
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() data: Partial<CreatePartnerDto>) {
    return this.partnersService.update(id, data);
  }

  @Patch(':id/status')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: PartnerStatus,
  ) {
    return this.partnersService.updateStatus(id, status);
  }

  // Partner self-service
  @Get('me/profile')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('partner')
  async myPartner(@CurrentUser() user: User) {
    const partner = await this.partnersService.findByOwnerUser(user.id);
    if (!partner) throw new NotFoundException('Partner profile not found');
    return partner;
  }

  @Get(':id/attributions')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'partner')
  async attributions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (user.role === 'partner') {
      const partner = await this.partnersService.findById(id);
      if (partner.ownerUserId !== user.id) throw new ForbiddenException('Not authorized');
    }
    return this.partnersService.listAttributions(id, {
      from,
      to,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get(':id/summary')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'partner')
  async summary(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (user.role === 'partner') {
      const partner = await this.partnersService.findById(id);
      if (partner.ownerUserId !== user.id) throw new ForbiddenException('Not authorized');
    }
    return this.partnersService.summary(
      id,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }
}
