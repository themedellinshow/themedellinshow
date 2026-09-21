import { ModerationService } from './moderation.service';
import { PromptCacheService } from '../cache/prompt-cache.service';

describe('ModerationService', () => {
  let service: ModerationService;
  let promptCache: jest.Mocked<Pick<PromptCacheService, 'execute'>>;

  beforeEach(() => {
    promptCache = {
      execute: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          approved: true,
          flags: [],
          confidence: 0.95,
          reason: 'Clean content',
          suggestedEdit: null,
        }),
        cacheHit: true,
        usage: { inputTokens: 10, outputTokens: 10, cacheReadTokens: 8 },
      }) as any,
    };
    service = new ModerationService(promptCache as any);
  });

  it('should moderate content and expose cache hit', async () => {
    const result = await service.moderateContent({
      contentType: 'review',
      content: 'Amazing guide!',
    });

    expect(result.approved).toBe(true);
    expect(result.flags).toEqual([]);
    expect(result.cacheHit).toBe(true);
  });

  it('should flag for review when response cannot be parsed', async () => {
    promptCache.execute.mockResolvedValueOnce({
      content: 'oops',
      cacheHit: false,
      usage: { inputTokens: 1, outputTokens: 1 },
    } as any);

    const result = await service.moderateContent({
      contentType: 'profile',
      content: 'blah',
    });

    expect(result.approved).toBe(false);
    expect(result.flags).toContain('PARSE_ERROR');
  });
});