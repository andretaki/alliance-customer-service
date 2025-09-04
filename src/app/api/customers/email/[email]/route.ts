import { NextRequest, NextResponse } from 'next/server';
import { CustomerService } from '@/services/CustomerService';

const customerService = new CustomerService();

// GET /api/customers/email/[email] - Find customer by email
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const { email: emailParam } = await params;
    const email = decodeURIComponent(emailParam);
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid email format' 
        }, 
        { status: 400 }
      );
    }

    const result = await customerService.findCustomerByEmail(email);

    if (result.success && result.data) {
      return NextResponse.json({
        success: true,
        data: result.data,
        message: 'Customer found'
      });
    } else if (result.error === 'Customer not found') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Customer not found',
          exists: false
        }, 
        { status: 404 }
      );
    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error || 'Failed to search customer'
        }, 
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[GET /api/customers/email/[email]] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error' 
      }, 
      { status: 500 }
    );
  }
}