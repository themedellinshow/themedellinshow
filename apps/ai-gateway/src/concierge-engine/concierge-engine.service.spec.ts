import { ConciergeEngineService } from './concierge-engine.service';
import { PromptCacheService } from '../cache/prompt-cache.service';

describe('ConciergeEngineService', () => {
  let service: ConciergeEngineService;
  let promptCache: jest.Mocked<Pick<PromptCacheService, 'execute'>>;

  beforeEach(() => {
    promptCache = {
      execute: jest.fn().mockResolvedValue({
        content: '{"recommendations":[{"name":"Comuna 13 Tour"}],"summary":"perfect"}',
        cacheHit: true,
        usage: {
          inputTokens: 100,
          outputTokens: 50,
          cacheReadTokens: 90,
          cacheCreationTokens: 0,
        },
      }) as any,
    };
    service = new ConciergeEngineService(promptCache as any);
  });

  it('should split stable (cached) and variable blocks for itineraries', async () => {
    await service.generateItinerary({
      language: 'es',
      travelDates: { start: '2026-10-01', end: '2026-10-05' },
      interests: ['food', 'art'],
      budget: 'moderate',
      groupType: 'couple',
    });

    const [req] = promptCache.execute.mock.calls[0];
    expect(req.useCase).toBe('concierge');
    expect(req.stableBlock).toContain('Héctor');
    expect(req.variableBlock).toContain('food, art');
    expect(req.variableBlock).not.toBe(req.stableBlock);
    expect(promptCache.execute).toHaveBeenCalledWith(
      expect.objectContaining({ maxTokens: 2048 }),
    );
  });

  it('should send conversation history only in the variable block for chat', async () => {
    await service.chat({
      sessionId: 's1',
      language: 'en',
      context: { interests: ['nightlife'], lgbtqFriendly: true },
      history: [
        { role: 'user', content: 'Looking for clubs' },
        { role: 'assistant', content: 'Try El Poblado' },
      ],
      message: 'Any LGBTQ+ bars?',
    });

    const [req] = promptCache.execute.mock.calls[0];
    expect(req.stableBlock).toContain('live conversation');
    expect(req.variableBlock).toContain('Looking for clubs');
    expect(req.variableBlock).toContain('Any LGBTQ+ bars?');
    expect(req.variableBlock).not.toContain('## Conversation Rules');
  });

  it('should include preferences and ignore cached block for recommend', async () => {
    await service.recommend({
      userId: 'u1',
      preferences: { interests: ['wellness'], budget: 'luxury', groupType: 'solo' },
    });

    const [req] = promptCache.execute.mock.calls[0];
    expect(req.variableBlock).toContain('wellness');
    expect(req.variableBlock).toContain('luxury');
    expect(req.stableBlock).toContain('recommendations');
  });
});