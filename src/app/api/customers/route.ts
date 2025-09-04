import { NextRequest, NextResponse } from 'next/server';
import { CustomerService } from '@/services/CustomerService';
import { createCustomerSchema, customerSearchSchema } from '@/types';

const customerService = new CustomerService();

// POST /api/customers - Create new customer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input data
    const validationResult = createCustomerSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.flatten().fieldErrors;
      console.warn('[POST /api/customers] Validation error:', errors);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid input', 
          details: errors 
        }, 
        { status: 400 }
      );
    }

    const result = await customerService.createCustomer(validationResult.data);

    if (result.success) {
      return NextResponse.json(
        { 
          success: true, 
          data: result.customer,
          customerId: result.customerId,
          shopifyResult: result.shopifyResult,
          quickbooksResult: result.quickbooksResult,
          alreadyExists: result.alreadyExists,
          message: result.alreadyExists ? 'Customer already exists' : 'Customer created successfully'
        }, 
        { status: result.alreadyExists ? 200 : 201 }
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
    console.error('[POST /api/customers] Error:', error);
    if (error instanceof Error) {
      console.error('[POST /api/customers] Stack:', error.stack);
    }
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
      }, 
      { status: 500 }
    );
  }
}

// GET /api/customers - Search customers
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const searchParams = {
      email: url.searchParams.get('email') || undefined,
      phone: url.searchParams.get('phone') || undefined,
      company: url.searchParams.get('company') || undefined,
      name: url.searchParams.get('name') || undefined,
      shopifyId: url.searchParams.get('shopifyId') || undefined,
      quickbooksId: url.searchParams.get('quickbooksId') || undefined,
      limit: parseInt(url.searchParams.get('limit') || '10'),
      offset: parseInt(url.searchParams.get('offset') || '0'),
    };

    // Remove undefined values
    const cleanParams = Object.fromEntries(
      Object.entries(searchParams).filter(([_, value]) => value !== undefined)
    );

    // Validate search parameters
    const validationResult = customerSearchSchema.safeParse(cleanParams);
    if (!validationResult.success) {
      const errors = validationResult.error.flatten().fieldErrors;
      console.warn('[GET /api/customers] Validation error:', errors);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid search parameters', 
          details: errors 
        }, 
        { status: 400 }
      );
    }

    const result = await customerService.searchCustomers(validationResult.data);

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: result.data,
        count: result.data?.length || 0,
        message: `Found ${result.data?.length || 0} customers`
      });
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
    console.error('[GET /api/customers] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error' 
      }, 
      { status: 500 }
    );
  }
}