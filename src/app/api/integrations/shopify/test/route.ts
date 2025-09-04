import { NextRequest, NextResponse } from 'next/server';
import { ShopifyIntegrationService } from '@/services/integrations/ShopifyIntegrationService';

// GET /api/integrations/shopify/test - Test Shopify connection
export async function GET(request: NextRequest) {
  try {
    const shopifyService = new ShopifyIntegrationService();
    const result = await shopifyService.testConnection();

    return NextResponse.json({
      success: result.success,
      service: 'Shopify',
      message: result.success ? 'Connection successful' : result.error,
      error: result.error
    });
  } catch (error) {
    console.error('[GET /api/integrations/shopify/test] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        service: 'Shopify',
        error: error instanceof Error ? error.message : 'Connection test failed'
      }, 
      { status: 500 }
    );
  }
}