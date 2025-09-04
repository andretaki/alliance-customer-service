import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { TicketService } from '@/services/tickets/TicketService';
import { Router } from '@/services/routing/Router';
// import { freightListService } from '@/services/freight/FreightListService'; // TODO: Implement freight service

const ticketService = new TicketService();
const router = new Router();

const createTicketSchema = z.object({
  callId: z.string().optional(),
  requestType: z.enum(['quote', 'coa', 'freight', 'claim', 'other']).optional(), // Made optional for AI classification
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  summary: z.string().optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  customerName: z.string().optional(),
  data: z.record(z.string(), z.any()).optional(),
  autoRoute: z.boolean().default(true),
  enableAI: z.boolean().default(false), // Enable AI features
  transcriptText: z.string().optional(), // For AI classification from transcripts
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createTicketSchema.parse(body);

    // Create the ticket with AI features if enabled
    const ticket = await ticketService.createTicket({
      callId: validated.callId,
      requestType: validated.requestType,
      priority: validated.priority,
      summary: validated.summary,
      customerEmail: validated.customerEmail,
      customerPhone: validated.customerPhone,
      customerName: validated.customerName,
      data: validated.data,
      enableAI: validated.enableAI,
      transcriptText: validated.transcriptText,
    });

    // Auto-route if requested
    let assignees: string[] = [];
    if (validated.autoRoute) {
      try {
        assignees = await router.assignTicket(ticket.id, validated.enableAI);
      } catch (routingError) {
        console.error('Failed to auto-route ticket:', routingError);
      }
    }

    // If it's a freight request, automatically add to freight list
    if (ticket.requestType === 'freight') {
      // TODO: Implement freight list service
      /*
      try {
        await freightListService.addToFreightList({
          ticketId: ticket.id,
          customerName: ticket.customerName || 'Unknown',
          customerEmail: ticket.customerEmail,
          customerPhone: ticket.customerPhone,
          products: validated.data?.products,
          estimatedWeight: validated.data?.weight,
          originCity: validated.data?.originCity,
          originState: validated.data?.originState,
          originZip: validated.data?.originZip,
          destinationCity: validated.data?.destinationCity,
          destinationState: validated.data?.destinationState,
          destinationZip: validated.data?.destinationZip,
          hazmat: validated.data?.hazmat,
          needsLiftgate: validated.data?.needsLiftgate,
          notes: ticket.summary,
        });
        
        console.log(`Freight ticket #${ticket.id} added to freight list`);
      } catch (freightError) {
        console.error('Failed to add to freight list:', freightError);
        // Don't fail the ticket creation, just log the error
      }
      */
    }

    return NextResponse.json({
      success: true,
      ticket: {
        ...ticket,
        assignees,
      },
      ai: validated.enableAI ? {
        classification: ticket.aiClassification,
        sentiment: ticket.aiSentiment,
        sentimentScore: ticket.aiSentimentScore,
        confidence: ticket.aiConfidence,
        extractedEntities: ticket.aiExtractedEntities,
        routingSuggestion: ticket.aiRoutingSuggestion,
      } : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Failed to create ticket:', error);
    return NextResponse.json(
      { error: 'Failed to create ticket' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const unassigned = searchParams.get('unassigned') === 'true';

    let tickets;
    
    if (unassigned) {
      tickets = await ticketService.getUnassignedTickets();
    } else if (status) {
      tickets = await ticketService.getTicketsByStatus(
        status as 'open' | 'routed' | 'in_progress' | 'resolved' | 'closed'
      );
    } else {
      // Return all open tickets by default
      tickets = await ticketService.getTicketsByStatus('open');
    }

    return NextResponse.json({
      success: true,
      tickets,
    });
  } catch (error) {
    console.error('Failed to get tickets:', error);
    return NextResponse.json(
      { error: 'Failed to get tickets' },
      { status: 500 }
    );
  }
}