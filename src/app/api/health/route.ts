import { NextResponse } from 'next/server';
import { db } from '@/db';

// GET /api/health - Health check endpoint
export async function GET() {
  try {
    const healthStatus = {
      service: process.env.SERVICE_NAME || 'alliance-customer-service',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.SERVICE_VERSION || '0.1.0',
      environment: process.env.NODE_ENV || 'development',
      checks: {
        database: { status: 'unknown', error: null as string | null },
        shopify: { status: 'unknown', configured: false },
        quickbooks: { status: 'unknown', configured: false }
      }
    };

    // Check database connection
    try {
      await db.execute('SELECT 1');
      healthStatus.checks.database.status = 'healthy';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (dbError: any) {
      healthStatus.checks.database.status = 'unhealthy';
      healthStatus.checks.database.error = dbError.message;
      healthStatus.status = 'degraded';
    }

    // Check Shopify configuration
    healthStatus.checks.shopify.configured = Boolean(
      process.env.SHOPIFY_STORE_URL && process.env.SHOPIFY_ADMIN_ACCESS_TOKEN
    );
    healthStatus.checks.shopify.status = healthStatus.checks.shopify.configured ? 'configured' : 'not_configured';

    // Check QuickBooks configuration
    healthStatus.checks.quickbooks.configured = Boolean(
      process.env.QUICKBOOKS_CLIENT_ID && process.env.QUICKBOOKS_CLIENT_SECRET
    );
    healthStatus.checks.quickbooks.status = healthStatus.checks.quickbooks.configured ? 'configured' : 'not_configured';

    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;

    return NextResponse.json(healthStatus, { status: statusCode });
  } catch (error) {
    console.error('[GET /api/health] Error:', error);
    return NextResponse.json(
      { 
        service: process.env.SERVICE_NAME || 'alliance-customer-service',
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Health check failed'
      }, 
      { status: 503 }
    );
  }
}