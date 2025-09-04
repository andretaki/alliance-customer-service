import { NextRequest, NextResponse } from 'next/server';
import { CallIngestor } from '@/services/calls/CallIngestor';
import { ThreeCXService } from '@/services/integrations/3cx';
import { TicketService } from '@/services/tickets/TicketService';

const callIngestor = new CallIngestor();
const threeCXService = new ThreeCXService();
const ticketService = new TicketService();

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get('x-3cx-signature') || '';
    
    // Verify webhook signature if configured
    if (process.env.THREE_CX_WEBHOOK_SECRET) {
      const isValid = threeCXService.verifyWebhookSignature(rawBody, signature);
      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid webhook signature' },
          { status: 401 }
        );
      }
    }

    // Parse the payload
    const payload = JSON.parse(rawBody);
    
    // Parse call event
    const callData = threeCXService.parseCallEvent(payload);
    
    // Ingest the call
    const call = await callIngestor.ingestCall({
      callid: callData.callId,
      direction: callData.direction,
      from: callData.from,
      to: callData.to,
      agent: callData.agent,
      startTime: callData.startTime,
      endTime: callData.endTime,
      recordingUrl: callData.recordingUrl,
      raw: payload,
    });

    // Extract metadata for potential ticket creation
    const metadata = threeCXService.extractCallMetadata(payload);
    
    // Auto-create ticket for certain conditions (customize as needed)
    if (shouldCreateTicket(callData, metadata)) {
      const ticket = await ticketService.createTicket({
        callId: callData.callId,
        requestType: determineRequestType(metadata),
        customerPhone: callData.from,
        summary: `Call from ${callData.from}`,
        data: {
          callDirection: callData.direction,
          agent: callData.agent,
          metadata,
        },
      });

      return NextResponse.json({
        success: true,
        call: call,
        ticket: ticket,
      });
    }

    return NextResponse.json({
      success: true,
      call: call,
    });
  } catch (error) {
    console.error('3CX webhook error:', error);
    return NextResponse.json(
      { error: 'Failed to process call event' },
      { status: 500 }
    );
  }
}

function shouldCreateTicket(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  callData: any,
  metadata: Record<string, any>
): boolean {
  // Customize this logic based on your business rules
  // For example, create ticket for:
  // - All inbound calls
  // - Calls to specific queues
  // - Calls with certain tags
  
  if (callData.direction === 'inbound') {
    return true;
  }
  
  if (metadata.queue && ['support', 'sales'].includes(metadata.queue)) {
    return true;
  }
  
  return false;
}

function determineRequestType(metadata: Record<string, any>): 'quote' | 'coa' | 'freight' | 'claim' | 'other' {
  // Customize based on your business logic
  // Could use queue, tags, or other metadata
  
  if (metadata.queue === 'sales' || metadata.tags?.includes('quote')) {
    return 'quote';
  }
  
  if (metadata.tags?.includes('coa') || metadata.tags?.includes('certificate')) {
    return 'coa';
  }
  
  if (metadata.tags?.includes('shipping') || metadata.tags?.includes('freight')) {
    return 'freight';
  }
  
  if (metadata.tags?.includes('claim') || metadata.tags?.includes('complaint')) {
    return 'claim';
  }
  
  return 'other';
}