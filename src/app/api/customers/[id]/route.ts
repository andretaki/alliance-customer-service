import { NextRequest, NextResponse } from 'next/server';
import { CustomerService } from '@/services/CustomerService';
import { db } from '@/db';
import { customers } from '@/db';
import { eq } from 'drizzle-orm';
import { ShopifyIntegrationService } from '@/services/integrations/ShopifyIntegrationService';
import { QuickbooksIntegrationService } from '@/services/integrations/QuickbooksIntegrationService';

const customerService = new CustomerService();

// GET /api/customers/[id] - Get customer by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customerId = parseInt(id);
    
    if (isNaN(customerId)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid customer ID' 
        }, 
        { status: 400 }
      );
    }

    // For now, we'll use searchCustomers with empty params and then filter by ID
    // In a real implementation, you'd add a getCustomerById method to CustomerService
    const result = await customerService.searchCustomers({ limit: 1, offset: 0 });
    
    if (result.success && result.data) {
      const customer = result.data.find(c => c.id === customerId);
      
      if (customer) {
        return NextResponse.json({
          success: true,
          data: customer,
          message: 'Customer found'
        });
      } else {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Customer not found' 
          }, 
          { status: 404 }
        );
      }
    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error || 'Failed to fetch customer'
        }, 
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[GET /api/customers/[id]] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error' 
      }, 
      { status: 500 }
    );
  }
}

// PUT /api/customers/[id] - Update customer
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customerId = parseInt(id);
    
    if (isNaN(customerId)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid customer ID' 
        }, 
        { status: 400 }
      );
    }

    const body = await request.json();
    
    // Update customer in database
    // Split name into first and last if provided
    const nameParts = body.name ? body.name.split(' ') : [];
    const firstName = nameParts[0] || undefined;
    const lastName = nameParts.slice(1).join(' ') || undefined;

    const updatedCustomer = await db
      .update(customers)
      .set({
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        email: body.email,
        phone: body.phone,
        company: body.company,
        notes: body.notes,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customerId))
      .returning();

    if (!updatedCustomer || updatedCustomer.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Customer not found' 
        }, 
        { status: 404 }
      );
    }
    
    // Sync updates to external services if IDs exist
    const customer = updatedCustomer[0];
    const syncResults = [];
    
    if (customer.shopifyId) {
      const shopifyService = new ShopifyIntegrationService();
      const shopifyResult = await shopifyService.updateCustomer(
        customer.shopifyId?.toString() || '',
        {
          email: customer.email,
          firstName: customer.firstName || undefined,
          lastName: customer.lastName || undefined,
          phone: customer.phone || undefined,
          company: customer.company || undefined,
        }
      );
      syncResults.push({ service: 'Shopify', success: shopifyResult.success });
    }
    
    if (customer.quickbooksId) {
      const quickbooksService = new QuickbooksIntegrationService();
      const quickbooksResult = await quickbooksService.updateCustomer(
        customer.quickbooksId,
        {
          email: customer.email,
          firstName: customer.firstName || undefined,
          lastName: customer.lastName || undefined,
          phone: customer.phone || undefined,
          company: customer.company || undefined,
        }
      );
      syncResults.push({ service: 'QuickBooks', success: quickbooksResult.success });
    }
    
    return NextResponse.json({
      success: true,
      customer: updatedCustomer[0],
      syncResults
    });
  } catch (error) {
    console.error('[PUT /api/customers/[id]] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error' 
      }, 
      { status: 500 }
    );
  }
}

// DELETE /api/customers/[id] - Delete customer (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customerId = parseInt(id);
    
    if (isNaN(customerId)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid customer ID' 
        }, 
        { status: 400 }
      );
    }

    // Soft delete - mark as archived
    const deletedCustomer = await db
      .update(customers)
      .set({
        status: 'archived',
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customerId))
      .returning();

    if (!deletedCustomer || deletedCustomer.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Customer not found' 
        }, 
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Customer archived successfully',
      customer: deletedCustomer[0]
    });
  } catch (error) {
    console.error('[DELETE /api/customers/[id]] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error' 
      }, 
      { status: 500 }
    );
  }
}