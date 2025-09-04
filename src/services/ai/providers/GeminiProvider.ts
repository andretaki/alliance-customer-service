import { GoogleGenerativeAI } from '@google/generative-ai';
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

export class GeminiProvider implements AIProvider {
  name = 'Gemini';
  private client: GoogleGenerativeAI;
  private model: any;
  private temperature: number;
  private maxTokens: number;

  constructor(config: AIConfig) {
    this.client = new GoogleGenerativeAI(config.apiKey);
    const modelName = config.model || 'gemini-1.5-flash';
    this.model = this.client.getGenerativeModel({ model: modelName });
    this.temperature = config.temperature || 0.7;
    this.maxTokens = config.maxTokens || 2000;
  }

  private async generateJSON(prompt: string): Promise<any> {
    try {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: this.temperature,
          maxOutputTokens: this.maxTokens,
          responseMimeType: 'application/json'
        },
      });
      const response = await result.response;
      const text = response.text();
      return JSON.parse(text);
    } catch (error) {
      console.error('Gemini generation error:', error);
      return null;
    }
  }

  async classifyTicket(data: TicketClassificationInput): Promise<TicketClassification> {
    const prompt = `You are an AI assistant specialized in classifying customer service tickets for a chemical supply company.

Analyze the following customer service request and classify it:

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
  "requestType": "quote|coa|freight|claim|other",
  "priority": "low|normal|high|urgent",
  "confidence": 0.85,
  "suggestedTags": ["tag1", "tag2"],
  "extractedProducts": ["product1", "product2"],
  "extractedQuantities": {"product1": 100},
  "extractedDates": {"delivery": "2024-01-15"},
  "reasoning": "Brief explanation of classification"
}`;

    try {
      const result = await this.generateJSON(prompt);
      if (result) {
        return result as TicketClassification;
      }
    } catch (error) {
      console.error('Gemini classification error:', error);
    }

    return {
      requestType: 'other',
      priority: 'normal',
      confidence: 0.5,
      reasoning: 'Failed to classify due to error'
    };
  }

  async analyzeRouting(ticket: TicketRoutingInput): Promise<RoutingSuggestion> {
    const prompt = `You are an AI routing specialist for customer service tickets.

Analyze this ticket and suggest the best team/person to handle it:

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
  "suggestedAssignees": ["primary-assignee"],
  "confidence": 0.85,
  "reasoning": "Explanation for routing decision",
  "alternativeAssignees": ["alt1", "alt2"],
  "estimatedResponseTime": 30
}`;

    try {
      const result = await this.generateJSON(prompt);
      if (result) {
        return result as RoutingSuggestion;
      }
    } catch (error) {
      console.error('Gemini routing error:', error);
    }

    return {
      suggestedAssignees: ['customer-service'],
      confidence: 0.5,
      reasoning: 'Default routing due to error'
    };
  }

  async summarizeTranscript(transcript: string): Promise<TranscriptSummary> {
    const prompt = `You are an AI assistant specialized in summarizing customer service calls.

Summarize this customer service call transcript:

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
  "summary": "Brief 2-3 sentence summary",
  "keyPoints": ["point1", "point2"],
  "actionItems": ["action1", "action2"],
  "customerIssue": "Main issue description",
  "resolution": "Resolution if provided",
  "nextSteps": ["step1", "step2"]
}`;

    try {
      const result = await this.generateJSON(prompt);
      if (result) {
        return result as TranscriptSummary;
      }
    } catch (error) {
      console.error('Gemini summarization error:', error);
    }

    return {
      summary: 'Unable to generate summary',
      keyPoints: [],
      actionItems: []
    };
  }

  async analyzeSentiment(text: string): Promise<SentimentAnalysis> {
    const prompt = `You are an AI sentiment analysis specialist.

Analyze the sentiment and emotional tone of this customer message:

${text}

Determine:
1. Overall sentiment (positive, neutral, negative)
2. Confidence score (0.0-1.0)
3. Detected emotions and their intensities
4. Any urgency indicators

Respond in JSON format:
{
  "sentiment": "positive|neutral|negative",
  "score": 0.85,
  "emotions": {
    "anger": 0.1,
    "frustration": 0.2,
    "satisfaction": 0.7,
    "urgency": 0.3
  },
  "urgencyIndicators": ["urgent keyword 1", "urgent phrase 2"]
}`;

    try {
      const result = await this.generateJSON(prompt);
      if (result) {
        return result as SentimentAnalysis;
      }
    } catch (error) {
      console.error('Gemini sentiment error:', error);
    }

    return {
      sentiment: 'neutral',
      score: 0.5
    };
  }

  async suggestResponses(context: ResponseContext): Promise<SuggestedResponses> {
    const prompt = `You are an AI assistant helping customer service agents craft responses.

Generate suggested responses for this customer service situation:

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
      "text": "Response text here",
      "tone": "formal|friendly|apologetic|informative",
      "confidence": 0.85,
      "tags": ["tag1", "tag2"]
    }
  ],
  "recommendedAction": "Recommended next action",
  "escalationNeeded": false
}`;

    try {
      const result = await this.generateJSON(prompt);
      if (result) {
        return result as SuggestedResponses;
      }
    } catch (error) {
      console.error('Gemini response suggestion error:', error);
    }

    return {
      responses: [],
      escalationNeeded: false
    };
  }

  async extractEntities(text: string): Promise<ExtractedEntities> {
    const prompt = `You are an AI entity extraction specialist.

Extract all relevant entities from this customer service text:

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

Respond in JSON format with extracted entities. Return empty arrays/objects for any entities not found in the text.`;

    try {
      const result = await this.generateJSON(prompt);
      if (result) {
        return result as ExtractedEntities;
      }
    } catch (error) {
      console.error('Gemini entity extraction error:', error);
    }

    return {};
  }
}