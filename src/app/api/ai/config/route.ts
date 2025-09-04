import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { aiService } from '@/services/ai/AIService';

const configSchema = z.object({
  provider: z.enum(['openai', 'gemini']),
  apiKey: z.string().min(1),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(100).max(8000).optional(),
  systemPrompt: z.string().optional(),
  enableCaching: z.boolean().optional(),
  cacheExpiry: z.number().min(60000).optional(), // Min 1 minute
});

export async function GET() {
  try {
    const config = aiService.getConfig();
    const metrics = aiService.getMetrics();
    
    return NextResponse.json({
      configured: aiService.isConfigured(),
      provider: aiService.getProviderName(),
      config: config ? {
        ...config,
        apiKey: config.apiKey ? '***' : undefined, // Hide API key
      } : null,
      metrics,
    });
  } catch (error) {
    console.error('Failed to get AI config:', error);
    return NextResponse.json(
      { error: 'Failed to get AI configuration' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = configSchema.parse(body);

    // Initialize AI service with new configuration
    aiService.initialize({
      provider: validated.provider,
      apiKey: validated.apiKey,
      model: validated.model,
      temperature: validated.temperature,
      maxTokens: validated.maxTokens,
      systemPrompt: validated.systemPrompt,
      enableCaching: validated.enableCaching,
      cacheExpiry: validated.cacheExpiry,
    });

    return NextResponse.json({
      success: true,
      message: `AI service configured with ${validated.provider}`,
      provider: aiService.getProviderName(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid configuration', details: error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    console.error('Failed to configure AI service:', error);
    return NextResponse.json(
      { error: 'Failed to configure AI service' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Clear AI cache
    aiService.clearCache();
    
    return NextResponse.json({
      success: true,
      message: 'AI cache cleared',
    });
  } catch (error) {
    console.error('Failed to clear AI cache:', error);
    return NextResponse.json(
      { error: 'Failed to clear AI cache' },
      { status: 500 }
    );
  }
}