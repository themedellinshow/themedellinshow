import { Controller, Post, Body } from '@nestjs/common';
import { ConciergeEngineService, ItineraryRequest } from './concierge-engine.service';

@Controller({ path: 'concierge', version: '1' })
export class ConciergeEngineController {
  constructor(private conciergeService: ConciergeEngineService) {}

  @Post('itinerary')
  async generateItinerary(@Body() request: ItineraryRequest) {
    return this.conciergeService.generateItinerary(request);
  }
}
