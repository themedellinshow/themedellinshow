import { Injectable } from '@nestjs/common';
import { PromptCacheService } from '../cache/prompt-cache.service';
import { CONCIERGE_SYSTEM_PROMPT_V1 } from '../prompts/concierge.v1';
import { CONCIERGE_CHAT_SYSTEM_PROMPT_V1 } from '../prompts/concierge-chat.v1';
import { CONCIERGE_RECOMMEND_SYSTEM_PROMPT_V1 } from '../prompts/concierge-recommend.v1';

export interface ItineraryRequest {
  language: 'es' | 'en' | 'pt';
  travelDates: { start: string; end: string };
  interests: string[];
  budget: 'budget' | 'moderate' | 'luxury';
  groupType: 'solo' | 'couple' | 'friends' | 'family';
  specialRequests?: string;
  lgbtqFriendly?: boolean;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  sessionId: string;
  language: 'es' | 'en' | 'pt';
  context?: {
    interests?: string[];
    currentLocation?: string;
    lgbtqFriendly?: boolean;
  };
  history?: ChatTurn[];
  message: string;
}

export interface RecommendRequest {
  userId?: string;
  preferences: {
    interests: string[];
    budget: 'budget' | 'moderate' | 'luxury';
    groupType?: 'solo' | 'couple' | 'friends' | 'family';
    lgbtqFriendly?: boolean;
  };
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

  async chat(request: ChatRequest): Promise<{
    response: string;
    cacheHit: boolean;
  }> {
    const context = request.context
      ? `
Traveler context:
${request.context.interests ? `Interests: ${request.context.interests.join(', ')}` : ''}
${request.context.currentLocation ? `Current location: ${request.context.currentLocation}` : ''}
${request.context.lgbtqFriendly ? 'Prefers LGBTQ+ friendly venues' : ''}
`.trim()
      : 'No additional traveler context provided.';

    const history = (request.history ?? [])
      .slice(-20)
      .map((t) => `${t.role === 'user' ? 'Traveler' : 'Héctor'}: ${t.content}`)
      .join('\n');

    const variableBlock = `
Language: ${request.language}
${context}

Conversation so far:
${history || '(start of conversation)'}

Current message from traveler:
${request.message}
`.trim();

    const response = await this.promptCache.execute({
      useCase: 'concierge',
      stableBlock: CONCIERGE_CHAT_SYSTEM_PROMPT_V1, // CACHED
      variableBlock, // NEVER CACHED
      maxTokens: 1024,
    });

    return {
      response: response.content.trim(),
      cacheHit: response.cacheHit,
    };
  }

  async recommend(request: RecommendRequest): Promise<{
    response: string;
    cacheHit: boolean;
  }> {
    const prefs = request.preferences;
    const variableBlock = `
Recommend experiences for this traveler:

Interests: ${prefs.interests.join(', ')}
Budget level: ${prefs.budget}
Group type: ${prefs.groupType ?? 'not specified'}
${prefs.lgbtqFriendly ? 'Prefers LGBTQ+ friendly venues' : ''}
${request.userId ? `User identifier (platform): ${request.userId}` : ''}
`.trim();

    const response = await this.promptCache.execute({
      useCase: 'concierge',
      stableBlock: CONCIERGE_RECOMMEND_SYSTEM_PROMPT_V1, // CACHED
      variableBlock, // NEVER CACHED
      maxTokens: 1024,
    });

    return {
      response: response.content.trim(),
      cacheHit: response.cacheHit,
    };
  }
}
