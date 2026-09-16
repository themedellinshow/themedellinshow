import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface ItineraryRequestDto {
  language: 'es' | 'en' | 'pt';
  startDate: string;
  endDate: string;
  interests: string[];
  budget: 'budget' | 'moderate' | 'luxury';
  groupType: 'solo' | 'couple' | 'friends' | 'family';
  specialRequests?: string;
  lgbtqFriendly?: boolean;
}

export interface ChatMessageDto {
  sessionId?: string;
  message: string;
  language: 'es' | 'en' | 'pt';
  context?: {
    interests?: string[];
    currentLocation?: string;
  };
}

@Injectable()
export class ConciergeService {
  private readonly aiGatewayUrl: string;

  constructor(
    private httpService: HttpService,
    private config: ConfigService,
  ) {
    this.aiGatewayUrl = this.config.get('AI_GATEWAY_URL', 'http://localhost:3002');
  }

  async generateItinerary(dto: ItineraryRequestDto): Promise<any> {
    const response = await firstValueFrom(
      this.httpService.post(`${this.aiGatewayUrl}/ai/v1/concierge/itinerary`, {
        language: dto.language,
        travelDates: { start: dto.startDate, end: dto.endDate },
        interests: dto.interests,
        budget: dto.budget,
        groupType: dto.groupType,
        specialRequests: dto.specialRequests,
        lgbtqFriendly: dto.lgbtqFriendly,
      }),
    );

    return response.data;
  }

  async chat(userId: string, dto: ChatMessageDto): Promise<{ response: string; sessionId: string }> {
    // For now, just forward to AI Gateway
    // In the future, this could include conversation history from Redis
    const response = await firstValueFrom(
      this.httpService.post(`${this.aiGatewayUrl}/ai/v1/concierge/chat`, {
        sessionId: dto.sessionId || `${userId}-${Date.now()}`,
        message: dto.message,
        language: dto.language,
        context: dto.context,
      }),
    );

    return response.data;
  }

  async getRecommendations(
    userId: string,
    preferences: {
      interests: string[];
      budget: string;
      lgbtqFriendly?: boolean;
    },
  ): Promise<any> {
    // This would fetch personalized recommendations based on user history
    // and preferences, using AI Gateway for ranking/filtering
    const response = await firstValueFrom(
      this.httpService.post(`${this.aiGatewayUrl}/ai/v1/concierge/recommend`, {
        userId,
        preferences,
      }),
    );

    return response.data;
  }
}
