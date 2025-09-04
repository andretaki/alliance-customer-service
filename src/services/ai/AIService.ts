import { OpenAIProvider } from './providers/OpenAIProvider';
import { GeminiProvider } from './providers/GeminiProvider';
import {
  AIProvider,
  AIConfig,
  TicketClassificationInput,
  TicketClassification,
  TicketRoutingInput,
  RoutingSuggestion,
  TranscriptSummary,
  SentimentAnalysis,
  ResponseContext,
  SuggestedResponses,
  ExtractedEntities,
  AIMetrics
} from './types';

export class AIService {
  private provider: AIProvider | null = null;
  private config: AIConfig | null = null;
  private metrics: AIMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private cache: Map<string, { data: any; expiry: number }> = new Map();

  constructor() {
    this.initializeFromEnv();
  }

  private initializeFromEnv() {
    const provider = process.env.AI_PROVIDER as 'openai' | 'gemini';
    const apiKey = process.env.AI_API_KEY;
    
    if (!provider || !apiKey) {
      console.warn('AI Service: No provider configured. Set AI_PROVIDER and AI_API_KEY environment variables.');
      return;
    }

    this.initialize({
      provider,
      apiKey,
      model: process.env.AI_MODEL,
      temperature: process.env.AI_TEMPERATURE ? parseFloat(process.env.AI_TEMPERATURE) : undefined,
      maxTokens: process.env.AI_MAX_TOKENS ? parseInt(process.env.AI_MAX_TOKENS) : undefined,
      systemPrompt: process.env.AI_SYSTEM_PROMPT,
      enableCaching: process.env.AI_ENABLE_CACHING === 'true',
      cacheExpiry: process.env.AI_CACHE_EXPIRY ? parseInt(process.env.AI_CACHE_EXPIRY) : 300000, // 5 minutes default
    });
  }

  initialize(config: AIConfig) {
    this.config = config;
    
    switch (config.provider) {
      case 'openai':
        this.provider = new OpenAIProvider(config);
        break;
      case 'gemini':
        this.provider = new GeminiProvider(config);
        break;
      default:
        throw new Error(`Unsupported AI provider: ${config.provider}`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getCacheKey(method: string, data: any): string {
    return `${method}:${JSON.stringify(data)}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getFromCache(key: string): any | null {
    if (!this.config?.enableCaching) return null;
    
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private setCache(key: string, data: any) {
    if (!this.config?.enableCaching) return;
    
    const expiry = Date.now() + (this.config.cacheExpiry || 300000);
    this.cache.set(key, { data, expiry });
    
    // Clean up expired cache entries
    if (this.cache.size > 100) {
      const now = Date.now();
      for (const [k, v] of this.cache.entries()) {
        if (v.expiry < now) {
          this.cache.delete(k);
        }
      }
    }
  }

  private async trackMetrics<T>(operation: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    this.metrics.totalRequests++;
    
    try {
      const result = await operation();
      this.metrics.successfulRequests++;
      const responseTime = Date.now() - startTime;
      this.metrics.averageResponseTime = 
        (this.metrics.averageResponseTime * (this.metrics.successfulRequests - 1) + responseTime) / 
        this.metrics.successfulRequests;
      return result;
    } catch (error) {
      this.metrics.failedRequests++;
      this.metrics.lastError = error instanceof Error ? error.message : 'Unknown error';
      this.metrics.lastErrorTime = new Date();
      throw error;
    }
  }

  async classifyTicket(data: TicketClassificationInput): Promise<TicketClassification> {
    if (!this.provider) {
      return {
        requestType: 'other',
        priority: 'normal',
        confidence: 0,
        reasoning: 'AI service not configured'
      };
    }

    const cacheKey = this.getCacheKey('classifyTicket', data);
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const result = await this.trackMetrics(() => this.provider!.classifyTicket(data));
    this.setCache(cacheKey, result);
    return result;
  }

  async analyzeRouting(ticket: TicketRoutingInput): Promise<RoutingSuggestion> {
    if (!this.provider) {
      return {
        suggestedAssignees: ['customer-service'],
        confidence: 0,
        reasoning: 'AI service not configured'
      };
    }

    const cacheKey = this.getCacheKey('analyzeRouting', ticket);
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const result = await this.trackMetrics(() => this.provider!.analyzeRouting(ticket));
    this.setCache(cacheKey, result);
    return result;
  }

  async summarizeTranscript(transcript: string): Promise<TranscriptSummary> {
    if (!this.provider) {
      return {
        summary: 'AI service not configured',
        keyPoints: [],
        actionItems: []
      };
    }

    const cacheKey = this.getCacheKey('summarizeTranscript', transcript);
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const result = await this.trackMetrics(() => this.provider!.summarizeTranscript(transcript));
    this.setCache(cacheKey, result);
    return result;
  }

  async analyzeSentiment(text: string): Promise<SentimentAnalysis> {
    if (!this.provider) {
      return {
        sentiment: 'neutral',
        score: 0
      };
    }

    const cacheKey = this.getCacheKey('analyzeSentiment', text);
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const result = await this.trackMetrics(() => this.provider!.analyzeSentiment(text));
    this.setCache(cacheKey, result);
    return result;
  }

  async suggestResponses(context: ResponseContext): Promise<SuggestedResponses> {
    if (!this.provider) {
      return {
        responses: [],
        escalationNeeded: false
      };
    }

    const result = await this.trackMetrics(() => this.provider!.suggestResponses(context));
    return result;
  }

  async extractEntities(text: string): Promise<ExtractedEntities> {
    if (!this.provider) {
      return {};
    }

    const cacheKey = this.getCacheKey('extractEntities', text);
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const result = await this.trackMetrics(() => this.provider!.extractEntities(text));
    this.setCache(cacheKey, result);
    return result;
  }

  getMetrics(): AIMetrics {
    return { ...this.metrics };
  }

  clearCache() {
    this.cache.clear();
  }

  isConfigured(): boolean {
    return this.provider !== null;
  }

  getProviderName(): string | null {
    return this.provider?.name || null;
  }

  getConfig(): AIConfig | null {
    if (!this.config) return null;
    return {
      ...this.config,
      apiKey: '***' // Don't expose API key
    };
  }
}

// Export singleton instance
export const aiService = new AIService();