import { NextRequest, NextResponse } from 'next/server';
import { QuickbooksIntegrationService } from '@/services/integrations/QuickbooksIntegrationService';

// GET /api/integrations/quickbooks/test - Test QuickBooks connection
export async function GET(request: NextRequest) {
  try {
    const quickbooksService = new QuickbooksIntegrationService();
    const result = await quickbooksService.testConnection();

    return NextResponse.json({
      success: result.success,
      service: 'QuickBooks',
      message: result.success ? 'Connection successful' : result.error,
      error: result.error
    });
  } catch (error) {
    console.error('[GET /api/integrations/quickbooks/test] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        service: 'QuickBooks',
        error: error instanceof Error ? error.message : 'Connection test failed'
      }, 
      { status: 500 }
    );
  }
}