import { Injectable } from '@nestjs/common';
import { PromptCacheService } from '../cache/prompt-cache.service';
import { CONCIERGE_SYSTEM_PROMPT_V1 } from '../prompts/concierge.v1';

export interface ItineraryRequest {
  language: 'es' | 'en' | 'pt';
  travelDates: { start: string; end: string };
  interests: string[];
  budget: 'budget' | 'moderate' | 'luxury';
  groupType: 'solo' | 'couple' | 'friends' | 'family';
  specialRequests?: string;
  lgbtqFriendly?: boolean;
}

@Injectable()
export class ConciergeEngineService {
  constructor(private promptCache: PromptCacheService) {}

  async generateItinerary(request: ItineraryRequest): Promise<{
    response: string;
    cacheHit: boolean;
  }> {
    const variableBlock = `
Generate a personalized Medellín itinerary for this traveler:

Language: ${request.language}
Travel dates: ${request.travelDates.start} to ${request.travelDates.end}
Interests: ${request.interests.join(', ')}
Budget level: ${request.budget}
Group type: ${request.groupType}
${request.lgbtqFriendly ? 'Prefers LGBTQ+ friendly venues' : ''}
${request.specialRequests ? `Special requests: ${request.specialRequests}` : ''}
`.trim();

    const response = await this.promptCache.execute({
      useCase: 'concierge',
      stableBlock: CONCIERGE_SYSTEM_PROMPT_V1, // CACHED
      variableBlock, // NEVER CACHED
      maxTokens: 2048,
    });

    return {
      response: response.content,
      cacheHit: response.cacheHit,
    };
  }
}
