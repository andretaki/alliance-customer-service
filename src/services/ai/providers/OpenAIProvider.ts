import OpenAI from 'openai';
import {
  AIProvider,
  TicketClassificationInput,
  TicketClassification,
  TicketRoutingInput,
  RoutingSuggestion,
  TranscriptSummary,
  SentimentAnalysis,
  ResponseContext,
  SuggestedResponses,
  ExtractedEntities,
  AIConfig
} from '../types';

export class OpenAIProvider implements AIProvider {
  name = 'OpenAI';
  private client: OpenAI;
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor(config: AIConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
    });
    this.model = config.model || 'gpt-4o-mini';
    this.temperature = config.temperature || 0.7;
    this.maxTokens = config.maxTokens || 2000;
  }

  async classifyTicket(data: TicketClassificationInput): Promise<TicketClassification> {
    const prompt = `Analyze the following customer service request and classify it:

${data.customerMessage || data.summary || data.transcriptText || ''}

Classify this into one of these request types:
- quote: Request for pricing or product quotes
- coa: Certificate of Analysis request
- freight: Shipping, delivery, or logistics inquiries
- claim: Complaints, issues, or damage claims
- other: Anything else

Also determine priority (low, normal, high, urgent) based on:
- Customer sentiment and urgency
- Business impact
- Time sensitivity

Extract any mentioned products, quantities, and dates.

Respond in JSON format with:
{
  "requestType": "...",
  "priority": "...",
  "confidence": 0.0-1.0,
  "suggestedTags": [],
  "extractedProducts": [],
  "extractedQuantities": {},
  "extractedDates": {},
  "reasoning": "..."
}`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are an AI assistant specialized in classifying customer service tickets for a chemical supply company.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return result as TicketClassification;
    } catch (error) {
      console.error('OpenAI classification error:', error);
      return {
        requestType: 'other',
        priority: 'normal',
        confidence: 0.5,
        reasoning: 'Failed to classify due to error'
      };
    }
  }

  async analyzeRouting(ticket: TicketRoutingInput): Promise<RoutingSuggestion> {
    const prompt = `Analyze this ticket and suggest the best team/person to handle it:

Request Type: ${ticket.requestType}
Priority: ${ticket.priority}
Summary: ${ticket.summary || 'N/A'}
Customer Email: ${ticket.customerEmail || 'N/A'}
Additional Data: ${JSON.stringify(ticket.data || {})}

${ticket.historicalAssignments ? `Historical assignments for similar tickets:
${ticket.historicalAssignments.map(h => `${h.requestType} -> ${h.assignee}`).join('\n')}` : ''}

Available teams/assignees:
- sales-team: Handles quotes and pricing
- coa-team: Handles Certificate of Analysis requests
- logistics-team: Handles freight and shipping
- customer-service: General inquiries and claims
- Adnan: Senior sales specialist for complex quotes
- Lori: Logistics manager for freight issues

Suggest primary and alternative assignees with reasoning.

Respond in JSON format:
{
  "suggestedAssignees": [],
  "confidence": 0.0-1.0,
  "reasoning": "...",
  "alternativeAssignees": [],
  "estimatedResponseTime": minutes
}`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are an AI routing specialist for customer service tickets.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4,
        max_tokens: 800,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return result as RoutingSuggestion;
    } catch (error) {
      console.error('OpenAI routing error:', error);
      return {
        suggestedAssignees: ['customer-service'],
        confidence: 0.5,
        reasoning: 'Default routing due to error'
      };
    }
  }

  async summarizeTranscript(transcript: string): Promise<TranscriptSummary> {
    const prompt = `Summarize this customer service call transcript:

${transcript}

Provide:
1. A concise summary (2-3 sentences)
2. Key points discussed
3. Action items identified
4. Customer's main issue
5. Resolution provided (if any)
6. Next steps

Respond in JSON format:
{
  "summary": "...",
  "keyPoints": [],
  "actionItems": [],
  "customerIssue": "...",
  "resolution": "...",
  "nextSteps": []
}`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are an AI assistant specialized in summarizing customer service calls.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 1200,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return result as TranscriptSummary;
    } catch (error) {
      console.error('OpenAI summarization error:', error);
      return {
        summary: 'Unable to generate summary',
        keyPoints: [],
        actionItems: []
      };
    }
  }

  async analyzeSentiment(text: string): Promise<SentimentAnalysis> {
    const prompt = `Analyze the sentiment and emotional tone of this customer message:

${text}

Determine:
1. Overall sentiment (positive, neutral, negative)
2. Confidence score (0.0-1.0)
3. Detected emotions and their intensities
4. Any urgency indicators

Respond in JSON format:
{
  "sentiment": "...",
  "score": 0.0-1.0,
  "emotions": {
    "anger": 0.0-1.0,
    "frustration": 0.0-1.0,
    "satisfaction": 0.0-1.0,
    "urgency": 0.0-1.0
  },
  "urgencyIndicators": []
}`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are an AI sentiment analysis specialist.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return result as SentimentAnalysis;
    } catch (error) {
      console.error('OpenAI sentiment error:', error);
      return {
        sentiment: 'neutral',
        score: 0.5
      };
    }
  }

  async suggestResponses(context: ResponseContext): Promise<SuggestedResponses> {
    const prompt = `Generate suggested responses for this customer service situation:

Ticket Type: ${context.ticketType}
Customer Message: ${context.customerMessage}
Customer Sentiment: ${context.customerSentiment || 'unknown'}

${context.ticketHistory ? `Previous Messages:
${context.ticketHistory.map(h => `${h.sender}: ${h.message}`).join('\n')}` : ''}

Generate 3 different response options with varying tones (formal, friendly, apologetic).
Consider the customer's sentiment and the type of request.

Respond in JSON format:
{
  "responses": [
    {
      "text": "...",
      "tone": "...",
      "confidence": 0.0-1.0,
      "tags": []
    }
  ],
  "recommendedAction": "...",
  "escalationNeeded": boolean
}`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are an AI assistant helping customer service agents craft responses.' },
          { role: 'user', content: prompt }
        ],
        temperature: this.temperature,
        max_tokens: 1500,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return result as SuggestedResponses;
    } catch (error) {
      console.error('OpenAI response suggestion error:', error);
      return {
        responses: [],
        escalationNeeded: false
      };
    }
  }

  async extractEntities(text: string): Promise<ExtractedEntities> {
    const prompt = `Extract all relevant entities from this customer service text:

${text}

Extract:
- Customer name
- Company name
- Phone numbers
- Email addresses
- Physical addresses
- Product names with quantities
- Order numbers
- Tracking numbers
- Dates mentioned
- Money amounts

Respond in JSON format:
{
  "customerName": "...",
  "companyName": "...",
  "phoneNumbers": [],
  "emails": [],
  "addresses": [],
  "products": [{"name": "...", "quantity": 0, "unit": "..."}],
  "orderNumbers": [],
  "trackingNumbers": [],
  "dates": {},
  "amounts": [{"value": 0, "currency": "USD", "type": "..."}]
}`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are an AI entity extraction specialist.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return result as ExtractedEntities;
    } catch (error) {
      console.error('OpenAI entity extraction error:', error);
      return {};
    }
  }
}