export interface AIProvider {
  name: string;
  classifyTicket(data: TicketClassificationInput): Promise<TicketClassification>;
  analyzeRouting(ticket: TicketRoutingInput): Promise<RoutingSuggestion>;
  summarizeTranscript(transcript: string): Promise<TranscriptSummary>;
  analyzeSentiment(text: string): Promise<SentimentAnalysis>;
  suggestResponses(context: ResponseContext): Promise<SuggestedResponses>;
  extractEntities(text: string): Promise<ExtractedEntities>;
}

export interface TicketClassificationInput {
  summary?: string;
  customerMessage?: string;
  transcriptText?: string;
  attachments?: Array<{ type: string; url: string }>;
}

export interface TicketClassification {
  requestType: 'quote' | 'coa' | 'freight' | 'claim' | 'other';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  confidence: number;
  suggestedTags?: string[];
  extractedProducts?: string[];
  extractedQuantities?: Record<string, number>;
  extractedDates?: Record<string, string>;
  reasoning?: string;
}

export interface TicketRoutingInput {
  requestType: string;
  priority: string;
  summary?: string;
  customerEmail?: string;
  data?: Record<string, any>;
  historicalAssignments?: Array<{ requestType: string; assignee: string }>;
}

export interface RoutingSuggestion {
  suggestedAssignees: string[];
  confidence: number;
  reasoning?: string;
  alternativeAssignees?: string[];
  estimatedResponseTime?: number;
}

export interface TranscriptSummary {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  customerIssue?: string;
  resolution?: string;
  nextSteps?: string[];
}

export interface SentimentAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative';
  score: number;
  emotions?: Record<string, number>;
  urgencyIndicators?: string[];
}

export interface ResponseContext {
  ticketType: string;
  customerMessage: string;
  ticketHistory?: Array<{ message: string; sender: string }>;
  customerSentiment?: string;
  previousResolutions?: string[];
}

export interface SuggestedResponses {
  responses: Array<{
    text: string;
    tone: 'formal' | 'friendly' | 'apologetic' | 'informative';
    confidence: number;
    tags?: string[];
  }>;
  recommendedAction?: string;
  escalationNeeded?: boolean;
}

export interface ExtractedEntities {
  customerName?: string;
  companyName?: string;
  phoneNumbers?: string[];
  emails?: string[];
  addresses?: string[];
  products?: Array<{ name: string; quantity?: number; unit?: string }>;
  orderNumbers?: string[];
  trackingNumbers?: string[];
  dates?: Record<string, string>;
  amounts?: Array<{ value: number; currency: string; type: string }>;
}

export interface AIConfig {
  provider: 'openai' | 'gemini';
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  enableCaching?: boolean;
  cacheExpiry?: number;
}

export interface AIMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  costEstimate?: number;
  lastError?: string;
  lastErrorTime?: Date;
}