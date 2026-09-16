import { Injectable } from '@nestjs/common';
import { PromptCacheService } from '../cache/prompt-cache.service';
import { MODERATION_SYSTEM_PROMPT_V1 } from '../prompts/moderation.v1';

export interface ModerationRequest {
  contentType: 'review' | 'message' | 'profile' | 'listing';
  content: string;
  authorId?: string;
}

export interface ModerationResult {
  approved: boolean;
  flags: string[];
  confidence: number;
  reason: string;
  suggestedEdit: string | null;
  cacheHit: boolean;
}

@Injectable()
export class ModerationService {
  constructor(private promptCache: PromptCacheService) {}

  async moderateContent(request: ModerationRequest): Promise<ModerationResult> {
    const variableBlock = `
Moderate this ${request.contentType}:

${request.content}
`.trim();

    const response = await this.promptCache.execute({
      useCase: 'moderation',
      stableBlock: MODERATION_SYSTEM_PROMPT_V1, // CACHED
      variableBlock, // NEVER CACHED
      maxTokens: 256,
    });

    try {
      const parsed = JSON.parse(response.content);
      return {
        approved: parsed.approved,
        flags: parsed.flags || [],
        confidence: parsed.confidence,
        reason: parsed.reason,
        suggestedEdit: parsed.suggestedEdit || null,
        cacheHit: response.cacheHit,
      };
    } catch {
      return {
        approved: false,
        flags: ['PARSE_ERROR'],
        confidence: 0,
        reason: 'Failed to parse AI response - flagged for manual review',
        suggestedEdit: null,
        cacheHit: response.cacheHit,
      };
    }
  }
}
