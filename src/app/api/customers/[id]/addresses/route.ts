import { NextRequest, NextResponse } from 'next/server';
import { CustomerService } from '@/services/CustomerService';
import { createAddressSchema } from '@/types';

const customerService = new CustomerService();

// POST /api/customers/[id]/addresses - Add address to customer
export async function POST(
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

    // Validate address data
    const validationResult = createAddressSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.flatten().fieldErrors;
      console.warn('[POST /api/customers/[id]/addresses] Validation error:', errors);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid address data', 
          details: errors 
        }, 
        { status: 400 }
      );
    }

    const result = await customerService.addCustomerAddress(customerId, validationResult.data);

    if (result.success) {
      return NextResponse.json(
        { 
          success: true, 
          data: result.data,
          message: result.message 
        }, 
        { status: 201 }
      );
    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error 
        }, 
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[POST /api/customers/[id]/addresses] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error' 
      }, 
      { status: 500 }
    );
  }
}

// GET /api/customers/[id]/addresses - Get customer addresses
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

    // Get addresses for the customer
    const { db } = await import('@/db');
    const { customerAddresses } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    
    const addresses = await db
      .select()
      .from(customerAddresses)
      .where(eq(customerAddresses.customerId, customerId));
    
    return NextResponse.json({
      success: true,
      addresses
    });
  } catch (error) {
    console.error('[GET /api/customers/[id]/addresses] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error' 
      }, 
      { status: 500 }
    );
  }
}