import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { ConciergeSessionService, SessionState } from './concierge-session.service';
import { CrmQueueService } from '../crm/crm.queue.service';

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
    lgbtqFriendly?: boolean;
  };
}

export interface ChatResponse {
  sessionId: string;
  response: string;
  cacheHit?: boolean;
}

@Injectable()
export class ConciergeService {
  private readonly aiGatewayUrl: string;

  constructor(
    private httpService: HttpService,
    private config: ConfigService,
    private sessions: ConciergeSessionService,
    private crmQueue: CrmQueueService,
  ) {
    this.aiGatewayUrl = this.config.get('AI_GATEWAY_URL', 'http://localhost:3002');
  }

  async generateItinerary(dto: ItineraryRequestDto): Promise<any> {
    try {
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
    } catch {
      return {
        response: '',
        cacheHit: false,
        degraded: true,
      };
    }
  }

  async chat(userId: string, dto: ChatMessageDto): Promise<ChatResponse> {
    // 1. Get or create session (backed by Redis)
    const session = await this.sessions.getOrCreate(
      dto.sessionId,
      userId,
      dto.language,
      dto.context,
    );

    // 2. Persist user turn
    await this.sessions.appendTurn(session.sessionId, {
      role: 'user',
      content: dto.message,
      timestamp: Date.now(),
    });

    // 3. Send to AI Gateway with conversation history (variable block)
    let assistantText = '';
    let cacheHit: boolean | undefined;
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiGatewayUrl}/ai/v1/concierge/chat`, {
          sessionId: session.sessionId,
          language: dto.language,
          context: session.context,
          history: this.buildHistoryForAi(session),
          message: dto.message,
        }),
      );
      assistantText = response.data?.response ?? '';
      cacheHit = response.data?.cacheHit;
    } catch {
      // Graceful degradation if AI gateway is down
      assistantText =
        dto.language === 'es'
          ? 'Estoy teniendo problemas técnicos, intenta de nuevo en un momento.'
          : dto.language === 'pt'
            ? 'Estou com problemas técnicos, tente novamente em instantes.'
            : 'I am having technical issues, please try again in a moment.';
    }

    // 4. Persist assistant turn
    await this.sessions.appendTurn(session.sessionId, {
      role: 'assistant',
      content: assistantText,
      timestamp: Date.now(),
    });

    // Track conversation in CRM (async via queue)
    await this.crmQueue.trackInteraction({
      userId,
      type: 'concierge_chat',
      channel: 'concierge',
      subject: 'Concierge chat',
      content: dto.message.slice(0, 2000),
      metadata: { sessionId: session.sessionId },
    });

    return {
      sessionId: session.sessionId,
      response: assistantText,
      cacheHit,
    };
  }

  async getSession(sessionId: string) {
    return this.sessions.getSession(sessionId);
  }

  async listUserSessions(userId: string) {
    return this.sessions.listUserSessions(userId);
  }

  async deleteSession(sessionId: string, userId: string): Promise<void> {
    return this.sessions.deleteSession(sessionId, userId);
  }

  async getRecommendations(
    userId: string,
    preferences: {
      interests: string[];
      budget: string;
      language?: 'es' | 'en' | 'pt';
      lgbtqFriendly?: boolean;
    },
  ): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiGatewayUrl}/ai/v1/concierge/recommend`, {
          userId,
          preferences: {
            interests: preferences.interests,
            budget: preferences.budget,
            lgbtqFriendly: preferences.lgbtqFriendly,
          },
        }),
      );
      return response.data;
    } catch {
      return {
        response: '',
        cacheHit: false,
        degraded: true,
      };
    }
  }

  private buildHistoryForAi(session: SessionState) {
    // Send last N turns to stay within token budget
    return session.turns.slice(-20).map((t) => ({
      role: t.role,
      content: t.content,
    }));
  }
}
