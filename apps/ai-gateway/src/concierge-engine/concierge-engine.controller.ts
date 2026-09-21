import { Controller, Post, Body } from '@nestjs/common';
import {
  ConciergeEngineService,
  ItineraryRequest,
  ChatRequest,
  RecommendRequest,
} from './concierge-engine.service';

@Controller({ path: 'concierge', version: '1' })
export class ConciergeEngineController {
  constructor(private conciergeService: ConciergeEngineService) {}

  @Post('itinerary')
  async generateItinerary(@Body() request: ItineraryRequest) {
    return this.conciergeService.generateItinerary(request);
  }

  @Post('chat')
  async chat(@Body() request: ChatRequest) {
    return this.conciergeService.chat(request);
  }

  @Post('recommend')
  async recommend(@Body() request: RecommendRequest) {
    return this.conciergeService.recommend(request);
  }
}
