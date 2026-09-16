import { Injectable } from '@nestjs/common';
import { PromptCacheService } from '../cache/prompt-cache.service';
import { NEWS_FILTER_SYSTEM_PROMPT_V1 } from '../prompts/news-filter.v1';

export interface NewsClassificationRequest {
  title: string;
  content: string;
  source: string;
  publishedAt: string;
}

export interface NewsClassificationResult {
  category: 'HIGHLY_RELEVANT' | 'RELEVANT' | 'LOW_RELEVANCE' | 'IRRELEVANT' | 'FLAGGED';
  confidence: number;
  summaryEs: string;
  summaryEn: string;
  tags: string[];
  reason: string;
  cacheHit: boolean;
}

@Injectable()
export class NewsFilterService {
  constructor(private promptCache: PromptCacheService) {}

  async classifyArticle(request: NewsClassificationRequest): Promise<NewsClassificationResult> {
    const variableBlock = `
Classify this news article:

Title: ${request.title}
Source: ${request.source}
Published: ${request.publishedAt}

Content:
${request.content}
`.trim();

    const response = await this.promptCache.execute({
      useCase: 'news-filter',
      stableBlock: NEWS_FILTER_SYSTEM_PROMPT_V1, // CACHED
      variableBlock, // NEVER CACHED
      maxTokens: 512,
    });

    try {
      const parsed = JSON.parse(response.content);
      return {
        category: parsed.category,
        confidence: parsed.confidence,
        summaryEs: parsed.summary_es,
        summaryEn: parsed.summary_en,
        tags: parsed.tags || [],
        reason: parsed.reason,
        cacheHit: response.cacheHit,
      };
    } catch {
      return {
        category: 'FLAGGED',
        confidence: 0,
        summaryEs: '',
        summaryEn: '',
        tags: [],
        reason: 'Failed to parse AI response',
        cacheHit: response.cacheHit,
      };
    }
  }
}
