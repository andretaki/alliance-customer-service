import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { tickets, suggestedResponses, aiOperations } from '@/db/ticketing';
import { eq } from 'drizzle-orm';
import { aiService } from '@/services/ai/AIService';

const suggestResponsesSchema = z.object({
  additionalContext: z.string().optional(),
  includeHistory: z.boolean().default(false),
  maxResponses: z.number().min(1).max(5).default(3),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ticketId = parseInt(id);
    
    if (isNaN(ticketId)) {
      return NextResponse.json(
        { error: 'Invalid ticket ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = suggestResponsesSchema.parse(body);

    // Get the ticket
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
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
      // Build context for response generation
      const context = {
        ticketType: ticket.requestType,
        customerMessage: ticket.summary || validated.additionalContext || '',
        customerSentiment: ticket.aiSentiment || undefined,
        ticketHistory: validated.includeHistory ? [] : undefined, // Could fetch from ticket_actions
        previousResolutions: [], // Could fetch from resolved similar tickets
      };

      // Generate suggested responses using AI
      const suggestions = await aiService.suggestResponses(context);
      
      // Store suggested responses in database
      const storedResponses = await Promise.all(
        suggestions.responses.slice(0, validated.maxResponses).map(async (response) => {
          const [stored] = await db
            .insert(suggestedResponses)
            .values({
              ticketId: ticketId,
              responseText: response.text,
              tone: response.tone,
              confidence: Math.round(response.confidence * 100),
              tags: response.tags || [],
              selected: false,
              agentId: null,
            })
            .returning();
          return stored;
        })
      );

      // Log AI operation
      await db.insert(aiOperations).values({
        ticketId: ticketId,
        callId: ticket.callId,
        operation: 'suggest',
        provider: aiService.getProviderName() || 'unknown',
        model: aiService.getConfig()?.model || null,
        input: context,
        output: suggestions,
        success: true,
        responseTimeMs: Date.now() - startTime,
        errorMessage: null,
        tokensUsed: null,
        costEstimate: null,
      });

      return NextResponse.json({
        success: true,
        ticketId,
        responses: storedResponses.map(r => ({
          id: r.id,
          text: r.responseText,
          tone: r.tone,
          confidence: r.confidence,
          tags: r.tags,
        })),
        recommendedAction: suggestions.recommendedAction,
        escalationNeeded: suggestions.escalationNeeded,
      });
    } catch (aiError) {
      // Log AI failure
      await db.insert(aiOperations).values({
        ticketId: ticketId,
        callId: ticket.callId,
        operation: 'suggest',
        provider: aiService.getProviderName() || 'unknown',
        model: aiService.getConfig()?.model || null,
        input: { ticketId, additionalContext: validated.additionalContext },
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Failed to generate suggested responses:', error);
    return NextResponse.json(
      { error: 'Failed to generate suggested responses' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ticketId = parseInt(id);
    
    if (isNaN(ticketId)) {
      return NextResponse.json(
        { error: 'Invalid ticket ID' },
        { status: 400 }
      );
    }

    // Get all suggested responses for this ticket
    const responses = await db
      .select()
      .from(suggestedResponses)
      .where(eq(suggestedResponses.ticketId, ticketId))
      .orderBy(suggestedResponses.confidence);

    return NextResponse.json({
      success: true,
      ticketId,
      responses: responses.map(r => ({
        id: r.id,
        text: r.responseText,
        tone: r.tone,
        confidence: r.confidence,
        tags: r.tags,
        selected: r.selected,
        selectedAt: r.selectedAt,
        agentId: r.agentId,
      })),
    });
  } catch (error) {
    console.error('Failed to get suggested responses:', error);
    return NextResponse.json(
      { error: 'Failed to get suggested responses' },
      { status: 500 }
    );
  }
}

// Mark a suggested response as selected
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params;  // We don't use the id param in PATCH, but we need to await it
  try {
    const body = await request.json();
    const { responseId, agentId } = body;

    if (!responseId || typeof responseId !== 'number') {
      return NextResponse.json(
        { error: 'Invalid response ID' },
        { status: 400 }
      );
    }

    // Update the suggested response as selected
    const [updated] = await db
      .update(suggestedResponses)
      .set({
        selected: true,
        selectedAt: new Date(),
        agentId: agentId || null,
      })
      .where(eq(suggestedResponses.id, responseId))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: 'Response not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      response: {
        id: updated.id,
        selected: updated.selected,
        selectedAt: updated.selectedAt,
        agentId: updated.agentId,
      },
    });
  } catch (error) {
    console.error('Failed to update suggested response:', error);
    return NextResponse.json(
      { error: 'Failed to update suggested response' },
      { status: 500 }
    );
  }
}