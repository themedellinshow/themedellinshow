import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface SessionState {
  sessionId: string;
  userId: string;
  language: 'es' | 'en' | 'pt';
  createdAt: number;
  updatedAt: number;
  turns: ChatTurn[];
  context?: {
    interests?: string[];
    currentLocation?: string;
    lgbtqFriendly?: boolean;
  };
}

const SESSION_PREFIX = 'concierge:session:';
const USER_SESSIONS_PREFIX = 'concierge:user-sessions:';
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const MAX_TURNS = 40;

@Injectable()
export class ConciergeSessionService implements OnModuleDestroy {
  private redis: Redis;

  constructor(private config: ConfigService) {
    this.redis = new Redis({
      host: this.config.get('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      password: this.config.get('REDIS_PASSWORD') || undefined,
      lazyConnect: false,
      maxRetriesPerRequest: 2,
    });
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => undefined);
  }

  async createSession(
    userId: string,
    language: 'es' | 'en' | 'pt',
    context?: SessionState['context'],
  ): Promise<SessionState> {
    const now = Date.now();
    const session: SessionState = {
      sessionId: randomUUID(),
      userId,
      language,
      createdAt: now,
      updatedAt: now,
      turns: [],
      context,
    };
    await this.persist(session);
    await this.redis.sadd(`${USER_SESSIONS_PREFIX}${userId}`, session.sessionId);
    return session;
  }

  async getSession(sessionId: string): Promise<SessionState | null> {
    const raw = await this.redis.get(`${SESSION_PREFIX}${sessionId}`);
    return raw ? (JSON.parse(raw) as SessionState) : null;
  }

  async getOrCreate(
    sessionId: string | undefined,
    userId: string,
    language: 'es' | 'en' | 'pt',
    context?: SessionState['context'],
  ): Promise<SessionState> {
    if (sessionId) {
      const existing = await this.getSession(sessionId);
      if (existing && existing.userId === userId) return existing;
    }
    return this.createSession(userId, language, context);
  }

  async appendTurn(sessionId: string, turn: ChatTurn): Promise<SessionState> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');
    session.turns.push(turn);
    if (session.turns.length > MAX_TURNS) {
      session.turns = session.turns.slice(-MAX_TURNS);
    }
    session.updatedAt = Date.now();
    await this.persist(session);
    return session;
  }

  async listUserSessions(userId: string): Promise<SessionState[]> {
    const ids = await this.redis.smembers(`${USER_SESSIONS_PREFIX}${userId}`);
    if (!ids.length) return [];
    const raws = await this.redis.mget(ids.map((id) => `${SESSION_PREFIX}${id}`));
    const sessions = raws
      .filter((r): r is string => !!r)
      .map((r) => JSON.parse(r) as SessionState);
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async deleteSession(sessionId: string, userId: string): Promise<void> {
    await this.redis.del(`${SESSION_PREFIX}${sessionId}`);
    await this.redis.srem(`${USER_SESSIONS_PREFIX}${userId}`, sessionId);
  }

  private async persist(session: SessionState): Promise<void> {
    await this.redis.set(
      `${SESSION_PREFIX}${session.sessionId}`,
      JSON.stringify(session),
      'EX',
      DEFAULT_TTL_SECONDS,
    );
  }
}
