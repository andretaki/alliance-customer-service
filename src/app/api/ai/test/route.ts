import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { aiService } from '@/services/ai/AIService';

const testSchema = z.object({
  operation: z.enum(['classify', 'route', 'summarize', 'sentiment', 'suggest', 'extract']),
  input: z.string(),
  requestType: z.string().optional(),
  priority: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = testSchema.parse(body);

    // Check if AI service is configured
    if (!aiService.isConfigured()) {
      return NextResponse.json(
        { 
          error: 'AI service not configured',
          instructions: 'Configure AI service first using POST /api/ai/config with provider and apiKey'
        },
        { status: 503 }
      );
    }

    const startTime = Date.now();
    let result: unknown;

    switch (validated.operation) {
      case 'classify':
        result = await aiService.classifyTicket({
          customerMessage: validated.input,
          summary: validated.input,
        });
        break;

      case 'route':
        result = await aiService.analyzeRouting({
          requestType: validated.requestType || 'other',
          priority: validated.priority || 'normal',
          summary: validated.input,
        });
        break;

      case 'summarize':
        result = await aiService.summarizeTranscript(validated.input);
        break;

      case 'sentiment':
        result = await aiService.analyzeSentiment(validated.input);
        break;

      case 'suggest':
        result = await aiService.suggestResponses({
          ticketType: validated.requestType || 'other',
          customerMessage: validated.input,
        });
        break;

      case 'extract':
        result = await aiService.extractEntities(validated.input);
        break;

      default:
        throw new Error(`Unknown operation: ${validated.operation}`);
    }

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      operation: validated.operation,
      provider: aiService.getProviderName(),
      input: validated.input,
      result,
      responseTimeMs: responseTime,
      metrics: aiService.getMetrics(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid test data', details: error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    console.error('AI test failed:', error);
    return NextResponse.json(
      { 
        error: 'AI test failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        provider: aiService.getProviderName(),
      },
      { status: 500 }
    );
  }
}

// Test all AI operations with sample data
export async function GET(request: NextRequest) {
  try {
    if (!aiService.isConfigured()) {
      return NextResponse.json(
        { 
          error: 'AI service not configured',
          instructions: 'Configure AI service first using POST /api/ai/config'
        },
        { status: 503 }
      );
    }

    // Use configured test data instead of hardcoded values
    const { TEST_DATA } = await import('@/config/test-data');
    const sampleText = TEST_DATA.sampleRequest;

    const tests = [];
    const startTime = Date.now();

    // Test classification
    try {
      const classification = await aiService.classifyTicket({
        customerMessage: sampleText,
      });
      tests.push({
        operation: 'classify',
        success: true,
        result: classification,
      });
    } catch (error) {
      tests.push({
        operation: 'classify',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test routing
    try {
      const routing = await aiService.analyzeRouting({
        requestType: 'quote',
        priority: 'urgent',
        summary: sampleText,
      });
      tests.push({
        operation: 'route',
        success: true,
        result: routing,
      });
    } catch (error) {
      tests.push({
        operation: 'route',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test sentiment analysis
    try {
      const sentiment = await aiService.analyzeSentiment(sampleText);
      tests.push({
        operation: 'sentiment',
        success: true,
        result: sentiment,
      });
    } catch (error) {
      tests.push({
        operation: 'sentiment',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test entity extraction
    try {
      const entities = await aiService.extractEntities(sampleText);
      tests.push({
        operation: 'extract',
        success: true,
        result: entities,
      });
    } catch (error) {
      tests.push({
        operation: 'extract',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test response suggestions
    try {
      const suggestions = await aiService.suggestResponses({
        ticketType: 'quote',
        customerMessage: sampleText,
      });
      tests.push({
        operation: 'suggest',
        success: true,
        result: suggestions,
      });
    } catch (error) {
      tests.push({
        operation: 'suggest',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    const totalTime = Date.now() - startTime;
    const successCount = tests.filter(t => t.success).length;

    return NextResponse.json({
      success: true,
      provider: aiService.getProviderName(),
      sampleInput: sampleText,
      tests,
      summary: {
        totalTests: tests.length,
        successfulTests: successCount,
        failedTests: tests.length - successCount,
        successRate: `${(successCount / tests.length * 100).toFixed(2)}%`,
        totalTimeMs: totalTime,
      },
      metrics: aiService.getMetrics(),
    });
  } catch (error) {
    console.error('AI comprehensive test failed:', error);
    return NextResponse.json(
      { 
        error: 'AI comprehensive test failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}