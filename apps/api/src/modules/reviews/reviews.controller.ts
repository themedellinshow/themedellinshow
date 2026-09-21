import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { User } from '../users/entities/user.entity';

@Controller({ path: 'reviews', version: '1' })
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  async create(@CurrentUser() user: User, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(user.id, dto);
  }

  @Get('experience/:experienceId')
  async findByExperience(@Param('experienceId', ParseUUIDPipe) experienceId: string) {
    return this.reviewsService.findByExperience(experienceId);
  }

  @Get('host')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('host', 'admin')
  async findAsHost(@CurrentUser() user: User) {
    return this.reviewsService.findByHost(user.id);
  }

  @Get('public/latest')
  async findLatestPublic(@Query('limit') limit?: string) {
    return this.reviewsService.findLatestPublic(Number(limit ?? 6));
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.reviewsService.findById(id);
  }

  @Post(':id/response')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('host', 'admin')
  async addResponse(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body('response') response: string,
  ) {
    return this.reviewsService.addHostResponse(id, user.id, response);
  }

  @Post(':id/helpful')
  async markHelpful(@Param('id', ParseUUIDPipe) id: string) {
    return this.reviewsService.markHelpful(id);
  }

  @Patch(':id/status')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: 'approved' | 'rejected' | 'hidden',
    @Body('note') note?: string,
  ) {
    return this.reviewsService.updateStatus(id, status, note);
  }
}
