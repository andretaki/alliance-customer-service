import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { TicketService } from '@/services/tickets/TicketService';

const ticketService = new TicketService();

const updateTicketSchema = z.object({
  status: z.enum(['open', 'routed', 'in_progress', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  summary: z.string().optional(),
  assignee: z.string().optional(),
  data: z.record(z.string(), z.any()).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ticketId = parseInt(id, 10);
    
    if (isNaN(ticketId)) {
      return NextResponse.json(
        { error: 'Invalid ticket ID' },
        { status: 400 }
      );
    }

    const ticket = await ticketService.getTicket(ticketId);
    
    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    // Check SLA breach
    const breached = await ticketService.checkSLABreach(ticketId);

    return NextResponse.json({
      success: true,
      ticket: {
        ...ticket,
        slaBreached: breached,
      },
    });
  } catch (error) {
    console.error('Failed to get ticket:', error);
    return NextResponse.json(
      { error: 'Failed to get ticket' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ticketId = parseInt(id, 10);
    
    if (isNaN(ticketId)) {
      return NextResponse.json(
        { error: 'Invalid ticket ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = updateTicketSchema.parse(body);

    const updated = await ticketService.updateTicket(ticketId, validated);

    return NextResponse.json({
      success: true,
      ticket: updated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Failed to update ticket:', error);
    return NextResponse.json(
      { error: 'Failed to update ticket' },
      { status: 500 }
    );
  }
}