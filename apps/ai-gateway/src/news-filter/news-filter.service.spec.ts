import { NewsFilterService } from './news-filter.service';
import { PromptCacheService } from '../cache/prompt-cache.service';

describe('NewsFilterService', () => {
  let service: NewsFilterService;
  let promptCache: jest.Mocked<Pick<PromptCacheService, 'execute'>>;

  beforeEach(() => {
    promptCache = {
      execute: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          category: 'HIGHLY_RELEVANT',
          confidence: 0.92,
          summary_es: 'Nuevo festival',
          summary_en: 'New festival',
          tags: ['festival'],
          reason: 'Direct tourism impact',
        }),
        cacheHit: false,
        usage: { inputTokens: 10, outputTokens: 20 },
      }) as any,
    };
    service = new NewsFilterService(promptCache as any);
  });

  it('should classify an article into mapped fields', async () => {
    const result = await service.classifyArticle({
      title: 'Festival de Flores 2026',
      content: 'Medellín se prepara para el desfile de silleteros.',
      source: 'El Colombiano',
      publishedAt: '2026-08-01',
    });

    expect(result.category).toBe('HIGHLY_RELEVANT');
    expect(result.confidence).toBe(0.92);
    expect(result.summaryEs).toBe('Nuevo festival');
    expect(result.summaryEn).toBe('New festival');
    expect(result.tags).toEqual(['festival']);
  });

  it('should flag FLAGGED when AI output is not parseable', async () => {
    promptCache.execute.mockResolvedValueOnce({
      content: 'not json',
      cacheHit: false,
      usage: { inputTokens: 1, outputTokens: 1 },
    } as any);

    const result = await service.classifyArticle({
      title: 'x',
      content: 'y',
      source: 'z',
      publishedAt: '2026-08-01',
    });

    expect(result.category).toBe('FLAGGED');
    expect(result.reason).toContain('Failed to parse');
  });

  it('should mark the stable block for caching and keep variable block separate', async () => {
    await service.classifyArticle({
      title: 't',
      content: 'c',
      source: 's',
      publishedAt: '2026-08-01',
    });

    const [req] = promptCache.execute.mock.calls[0];
    expect(req.stableBlock).toContain('news curator');
    expect(req.variableBlock).toContain('Title: t');
    expect(req.variableBlock).not.toContain('news curator');
  });
});