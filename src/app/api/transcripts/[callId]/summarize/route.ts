import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { transcripts, aiOperations } from '@/db/ticketing';
import { eq } from 'drizzle-orm';
import { aiService } from '@/services/ai/AIService';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const { callId } = await params;

    // Get the transcript
    const [transcript] = await db
      .select()
      .from(transcripts)
      .where(eq(transcripts.callId, callId))
      .limit(1);

    if (!transcript) {
      return NextResponse.json(
        { error: 'Transcript not found' },
        { status: 404 }
      );
    }

    // Check if AI service is configured
    if (!aiService.isConfigured()) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 503 }
      );
    }

    const startTime = Date.now();
    
    try {
      // Generate summary using AI
      const summary = await aiService.summarizeTranscript(transcript.text);
      
      // Analyze sentiment
      const sentiment = await aiService.analyzeSentiment(transcript.text);
      
      // Update transcript with summary and sentiment
      await db
        .update(transcripts)
        .set({
          summary: summary.summary,
          sentiment: sentiment.sentiment,
          modelMeta: {
            provider: aiService.getProviderName(),
            model: aiService.getConfig()?.model,
            keyPoints: summary.keyPoints,
            actionItems: summary.actionItems,
            customerIssue: summary.customerIssue,
            resolution: summary.resolution,
            nextSteps: summary.nextSteps,
            sentimentScore: sentiment.score,
            emotions: sentiment.emotions,
            urgencyIndicators: sentiment.urgencyIndicators,
          },
        })
        .where(eq(transcripts.id, transcript.id));

      // Log AI operations
      await db.insert(aiOperations).values([
        {
          callId: callId,
          ticketId: null,
          operation: 'summarize',
          provider: aiService.getProviderName() || 'unknown',
          model: aiService.getConfig()?.model || null,
          input: { text: transcript.text.substring(0, 500) }, // Log first 500 chars
          output: summary,
          success: true,
          responseTimeMs: Date.now() - startTime,
          errorMessage: null,
          tokensUsed: null,
          costEstimate: null,
        },
        {
          callId: callId,
          ticketId: null,
          operation: 'sentiment',
          provider: aiService.getProviderName() || 'unknown',
          model: aiService.getConfig()?.model || null,
          input: { text: transcript.text.substring(0, 500) },
          output: sentiment,
          success: true,
          responseTimeMs: Date.now() - startTime,
          errorMessage: null,
          tokensUsed: null,
          costEstimate: null,
        },
      ]);

      return NextResponse.json({
        success: true,
        callId,
        summary: summary.summary,
        keyPoints: summary.keyPoints,
        actionItems: summary.actionItems,
        customerIssue: summary.customerIssue,
        resolution: summary.resolution,
        nextSteps: summary.nextSteps,
        sentiment: sentiment.sentiment,
        sentimentScore: sentiment.score,
        emotions: sentiment.emotions,
        urgencyIndicators: sentiment.urgencyIndicators,
      });
    } catch (aiError) {
      // Log AI failure
      await db.insert(aiOperations).values({
        callId: callId,
        ticketId: null,
        operation: 'summarize',
        provider: aiService.getProviderName() || 'unknown',
        model: aiService.getConfig()?.model || null,
        input: { text: transcript.text.substring(0, 500) },
        output: null,
        success: false,
        responseTimeMs: Date.now() - startTime,
        errorMessage: aiError instanceof Error ? aiError.message : 'Unknown error',
        tokensUsed: null,
        costEstimate: null,
      });

      throw aiError;
    }
  } catch (error) {
    console.error('Failed to summarize transcript:', error);
    return NextResponse.json(
      { error: 'Failed to summarize transcript' },
      { status: 500 }
    );
  }
}