import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { TicketService } from '@/services/tickets/TicketService';
import { ShopifyIntegrationService } from '@/services/integrations/ShopifyIntegrationService';
import { QuickbooksIntegrationService } from '@/services/integrations/QuickbooksIntegrationService';

const ticketService = new TicketService();

const createQuoteSchema = z.object({
  products: z.array(z.object({
    name: z.string(),
    sku: z.string(),
    quantity: z.number(),
    price: z.number(),
    weight: z.number().optional(),
  })),
  customer: z.object({
    email: z.string().email(),
    firstName: z.string(),
    lastName: z.string(),
    company: z.string().optional(),
    phone: z.string().optional(),
  }),
  shippingAddress: z.object({
    address1: z.string(),
    address2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string().default('US'),
  }),
  notes: z.string().optional(),
  discountPercentage: z.number().optional(),
  shippingCost: z.number().optional(),
});

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

    const body = await request.json();
    const validated = createQuoteSchema.parse(body);

    // Get ticket
    const ticket = await ticketService.getTicket(ticketId);
    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    const results = {
      shopifyDraft: null as any,
      quickbooksEstimate: null as any,
      errors: [] as string[],
    };

    // Create Shopify draft order
    try {
      const shopifyService = new ShopifyIntegrationService();
      
      // Find or create customer
      let shopifyCustomer = await shopifyService.findCustomerByEmail(validated.customer.email);
      
      if (!shopifyCustomer) {
        shopifyCustomer = await shopifyService.createCustomer({
          email: validated.customer.email,
          firstName: validated.customer.firstName,
          lastName: validated.customer.lastName,
          phone: validated.customer.phone || '',
        });
      }

      // TODO: Implement createDraftOrder method in ShopifyIntegrationService
      // For now, skip draft order creation
      console.log('[Quote] Draft order creation not implemented yet');
      results.errors.push('Shopify draft order creation not yet implemented');
    } catch (error) {
      console.error('Failed to create Shopify draft:', error);
      results.errors.push(`Shopify: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Create QuickBooks estimate
    try {
      const quickbooksService = new QuickbooksIntegrationService();
      
      // Find or create customer
      let qbCustomer = await quickbooksService.findCustomerByEmail(validated.customer.email);
      
      if (!qbCustomer) {
        qbCustomer = await quickbooksService.createCustomer({
          email: validated.customer.email,
          firstName: validated.customer.firstName,
          lastName: validated.customer.lastName,
          company: validated.customer.company,
          phone: validated.customer.phone,
        });
      }

      // TODO: Implement createEstimate method in QuickbooksIntegrationService
      // For now, skip estimate creation
      console.log('[Quote] QuickBooks estimate creation not implemented yet');
      results.errors.push('QuickBooks estimate creation not yet implemented');
    } catch (error) {
      console.error('Failed to create QuickBooks estimate:', error);
      results.errors.push(`QuickBooks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Update ticket status
    await ticketService.updateTicket(ticketId, {
      status: 'in_progress',
    });

    return NextResponse.json({
      success: results.errors.length === 0,
      shopifyDraft: results.shopifyDraft,
      quickbooksEstimate: results.quickbooksEstimate,
      errors: results.errors.length > 0 ? results.errors : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Failed to create quote:', error);
    return NextResponse.json(
      { error: 'Failed to create quote' },
      { status: 500 }
    );
  }
}