import { NextRequest, NextResponse } from 'next/server';
import { QuickbooksIntegrationService } from '@/services/integrations/QuickbooksIntegrationService';

// GET /api/integrations/quickbooks/auth - Get QuickBooks authorization URL
export async function GET(request: NextRequest) {
  try {
    const quickbooksService = new QuickbooksIntegrationService();
    const state = request.nextUrl.searchParams.get('state') || 'default';
    
    const authUrl = quickbooksService.getAuthorizationUrl(state);

    return NextResponse.json({
      success: true,
      authUrl,
      message: 'Authorization URL generated successfully'
    });
  } catch (error) {
    console.error('[GET /api/integrations/quickbooks/auth] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to generate authorization URL'
      }, 
      { status: 500 }
    );
  }
}

// POST /api/integrations/quickbooks/auth - Handle OAuth callback
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, realmId, state } = body;

    if (!code || !realmId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing authorization code or realm ID' 
        }, 
        { status: 400 }
      );
    }

    const quickbooksService = new QuickbooksIntegrationService();
    const result = await quickbooksService.exchangeCodeForTokens(code, realmId);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'QuickBooks authentication successful',
        realmId
      });
    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error || 'Authentication failed'
        }, 
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[POST /api/integrations/quickbooks/auth] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Authentication failed'
      }, 
      { status: 500 }
    );
  }
}