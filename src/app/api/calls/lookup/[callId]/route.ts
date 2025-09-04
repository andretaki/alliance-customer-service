import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { calls, tickets } from '@/db/ticketing';
import { eq, desc, or } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const { callId } = await params;

    // First, get the call information
    const call = await db
      .select()
      .from(calls)
      .where(eq(calls.callId, callId))
      .limit(1);

    if (call.length === 0) {
      return NextResponse.json({
        callId,
        found: false,
        message: 'Call not found'
      });
    }

    const callRecord = call[0];
    const phoneNumber = callRecord.fromNumber;

    // Look up previous tickets by phone number
    const previousTickets = await db
      .select({
        id: tickets.id,
        requestType: tickets.requestType,
        status: tickets.status,
        createdAt: tickets.createdAt,
        customerName: tickets.customerName,
        customerEmail: tickets.customerEmail,
        summary: tickets.summary,
      })
      .from(tickets)
      .where(eq(tickets.customerPhone, phoneNumber))
      .orderBy(desc(tickets.createdAt))
      .limit(10);

    // Get the most recent customer info from tickets
    const latestCustomerInfo = previousTickets.length > 0 ? previousTickets[0] : null;

    // Check if this is a known customer
    const isKnownCustomer = previousTickets.length > 0;

    // Get statistics
    const ticketStats = {
      total: previousTickets.length,
      quotes: previousTickets.filter(t => t.requestType === 'quote').length,
      coa: previousTickets.filter(t => t.requestType === 'coa').length,
      freight: previousTickets.filter(t => t.requestType === 'freight').length,
      claims: previousTickets.filter(t => t.requestType === 'claim').length,
      lastContact: latestCustomerInfo?.createdAt || null,
    };

    // Try to fetch additional customer data from integrations if available
    let additionalData = null;
    if (latestCustomerInfo?.customerEmail) {
      try {
        const customerResponse = await fetch(
          `${process.env.APP_URL}/api/customers/email/${encodeURIComponent(latestCustomerInfo.customerEmail)}`,
          {
            headers: {
              'Authorization': `Bearer ${process.env.SERVICE_SECRET}`,
              'X-Service-Name': 'alliance-customer-service',
              'X-Request-Timestamp': new Date().toISOString(),
            }
          }
        );
        
        if (customerResponse.ok) {
          additionalData = await customerResponse.json();
        }
      } catch (error) {
        console.error('Failed to fetch additional customer data:', error);
      }
    }

    return NextResponse.json({
      callId,
      found: true,
      call: {
        id: callRecord.id,
        direction: callRecord.direction,
        fromNumber: callRecord.fromNumber,
        toNumber: callRecord.toNumber,
        agentExt: callRecord.agentExt,
        agentName: callRecord.agentName,
        startedAt: callRecord.startedAt,
      },
      isKnownCustomer,
      customerName: latestCustomerInfo?.customerName || '',
      customerEmail: latestCustomerInfo?.customerEmail || '',
      customerPhone: phoneNumber,
      previousTickets: previousTickets.length,
      ticketHistory: previousTickets.slice(0, 5), // Last 5 tickets
      ticketStats,
      shopifyCustomerId: additionalData?.shopifyCustomerId || null,
      quickbooksCustomerId: additionalData?.quickbooksCustomerId || null,
      notes: [
        isKnownCustomer && ticketStats.claims > 0 && '⚠️ Has previous claims',
        isKnownCustomer && ticketStats.total > 10 && '⭐ Frequent customer',
        !isKnownCustomer && '🆕 New customer',
      ].filter(Boolean),
    });
  } catch (error) {
    console.error('Failed to lookup caller:', error);
    return NextResponse.json(
      { error: 'Failed to lookup caller information' },
      { status: 500 }
    );
  }
}