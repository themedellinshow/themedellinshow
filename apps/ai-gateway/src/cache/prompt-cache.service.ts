import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

export interface CachedPromptRequest {
  /** Use case identifier for prompt versioning */
  useCase: 'news-filter' | 'concierge' | 'moderation';
  /** Stable block: system prompt, rules, brand tone (CACHED) */
  stableBlock: string;
  /** Variable block: user input, specific data (NEVER CACHED) */
  variableBlock: string;
  /** Optional max tokens */
  maxTokens?: number;
}

export interface PromptResponse {
  content: string;
  cacheHit: boolean;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
  };
}

@Injectable()
export class PromptCacheService {
  private client: Anthropic;
  private readonly model = 'claude-sonnet-4-20250514';

  constructor(private config: ConfigService) {
    this.client = new Anthropic({
      apiKey: this.config.get('ANTHROPIC_API_KEY'),
    });
  }

  /**
   * Execute a prompt with explicit separation of cached (stable) and non-cached (variable) blocks.
   * The stable block is marked for prompt caching and reused across calls.
   */
  async execute(request: CachedPromptRequest): Promise<PromptResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: request.maxTokens || 1024,
      system: [
        {
          type: 'text',
          text: request.stableBlock,
          cache_control: { type: 'ephemeral' }, // Mark for caching
        },
      ] as unknown as string,
      messages: [
        {
          role: 'user',
          content: request.variableBlock,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === 'text');

    return {
      content: textBlock?.type === 'text' ? textBlock.text : '',
      cacheHit: (response.usage as any).cache_read_input_tokens > 0,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: (response.usage as any).cache_read_input_tokens,
        cacheCreationTokens: (response.usage as any).cache_creation_input_tokens,
      },
    };
  }
}
