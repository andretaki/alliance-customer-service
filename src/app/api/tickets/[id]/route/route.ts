import { NextRequest, NextResponse } from 'next/server';
import { Router } from '@/services/routing/Router';

const router = new Router();

export async function POST(
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

    const assignees = await router.assignTicket(ticketId);

    return NextResponse.json({
      success: true,
      assignees,
    });
  } catch (error) {
    console.error('Failed to route ticket:', error);
    return NextResponse.json(
      { error: 'Failed to route ticket' },
      { status: 500 }
    );
  }
}