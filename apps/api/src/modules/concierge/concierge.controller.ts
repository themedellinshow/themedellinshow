import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConciergeService, ItineraryRequestDto, ChatMessageDto } from './concierge.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller({ path: 'concierge', version: '1' })
export class ConciergeController {
  constructor(private conciergeService: ConciergeService) {}

  @Post('itinerary')
  async generateItinerary(@Body() dto: ItineraryRequestDto) {
    return this.conciergeService.generateItinerary(dto);
  }

  @Post('chat')
  @UseGuards(AuthGuard('jwt'))
  async chat(@CurrentUser() user: User, @Body() dto: ChatMessageDto) {
    return this.conciergeService.chat(user.id, dto);
  }

  @Post('recommendations')
  @UseGuards(AuthGuard('jwt'))
  async getRecommendations(
    @CurrentUser() user: User,
    @Body() preferences: { interests: string[]; budget: string; lgbtqFriendly?: boolean },
  ) {
    return this.conciergeService.getRecommendations(user.id, preferences);
  }
}
