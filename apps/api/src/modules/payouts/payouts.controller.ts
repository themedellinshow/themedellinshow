import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PayoutsService } from './payouts.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { User } from '../users/entities/user.entity';

@Controller({ path: 'payouts', version: '1' })
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Get('me')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('host', 'admin')
  async myLedger(@CurrentUser() user: User) {
    return this.payoutsService.getHostLedger(user.id);
  }

  @Post('admin/release')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async runRelease() {
    const released = await this.payoutsService.releaseEligible();
    return { released };
  }

  @Post('admin/batch')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async runBatch() {
    const batches = await this.payoutsService.runWeeklyBatch(true);
    return { batches };
  }
}