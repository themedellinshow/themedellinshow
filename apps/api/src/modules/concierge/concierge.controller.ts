import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
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

  @Get('sessions')
  @UseGuards(AuthGuard('jwt'))
  async listSessions(@CurrentUser() user: User) {
    return this.conciergeService.listUserSessions(user.id);
  }

  @Get('sessions/:id')
  @UseGuards(AuthGuard('jwt'))
  async getSession(@CurrentUser() user: User, @Param('id') id: string) {
    const session = await this.conciergeService.getSession(id);
    if (!session) throw new NotFoundException('Session not found');
    if (session.userId !== user.id) throw new ForbiddenException('Not authorized');
    return session;
  }

  @Delete('sessions/:id')
  @UseGuards(AuthGuard('jwt'))
  async deleteSession(@CurrentUser() user: User, @Param('id') id: string) {
    const session = await this.conciergeService.getSession(id);
    if (session && session.userId !== user.id) {
      throw new ForbiddenException('Not authorized');
    }
    await this.conciergeService.deleteSession(id, user.id);
    return { deleted: true };
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
