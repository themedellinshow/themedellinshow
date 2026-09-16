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
import { CompanionsService } from './companions.service';
import { CreateCompanionProfileDto } from './dto/create-companion-profile.dto';
import { QueryCompanionsDto } from './dto/query-companions.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { User } from '../users/entities/user.entity';
import { CompanionStatus } from './entities/companion-profile.entity';

@Controller({ path: 'companions', version: '1' })
export class CompanionsController {
  constructor(private companionsService: CompanionsService) {}

  // Public
  @Get()
  async findAll(@Query() query: QueryCompanionsDto) {
    return this.companionsService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.companionsService.findById(id);
  }

  // Authenticated user creates their companion profile
  @Post('profile')
  @UseGuards(AuthGuard('jwt'))
  async createProfile(@CurrentUser() user: User, @Body() dto: CreateCompanionProfileDto) {
    return this.companionsService.createProfile(user.id, dto);
  }

  @Get('me/profile')
  @UseGuards(AuthGuard('jwt'))
  async getMyProfile(@CurrentUser() user: User) {
    return this.companionsService.findByUserId(user.id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('companion', 'admin')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: Partial<CreateCompanionProfileDto>,
  ) {
    return this.companionsService.update(id, user.id, dto);
  }

  // Admin: verification
  @Patch(':id/verify')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async verify(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() checks: { identity?: boolean; background?: boolean },
  ) {
    return this.companionsService.verify(id, checks);
  }

  @Patch(':id/status')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: CompanionStatus,
  ) {
    return this.companionsService.updateStatus(id, status);
  }
}
