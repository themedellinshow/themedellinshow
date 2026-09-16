import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AnalyticsService, AnalyticsRangeDto } from './analytics.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller({ path: 'analytics', version: '1' })
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin', 'partner')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('kpis')
  async kpis(@Query() dto: AnalyticsRangeDto) {
    return this.analyticsService.kpis(dto);
  }

  @Get('revenue')
  async revenue(@Query() dto: AnalyticsRangeDto) {
    return this.analyticsService.revenueSeries(dto);
  }

  @Get('top-experiences')
  async topExperiences(@Query() dto: AnalyticsRangeDto & { limit?: string }) {
    return this.analyticsService.topExperiences({
      from: dto.from,
      to: dto.to,
      limit: dto.limit ? parseInt(dto.limit, 10) : undefined,
    });
  }

  @Get('neighborhoods')
  async neighborhoods(@Query() dto: AnalyticsRangeDto) {
    return this.analyticsService.neighborhoodBreakdown(dto);
  }
}