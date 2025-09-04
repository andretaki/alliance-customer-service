import { NextRequest, NextResponse } from 'next/server';
import { runSlaCheck } from '@/jobs/sla-check';

// This endpoint can be called by a cron job (e.g., Vercel Cron, AWS EventBridge, or external service)
export async function POST(request: NextRequest) {
  try {
    // Optional: Add basic auth or secret validation for security
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET || process.env.SERVICE_SECRET;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Run the SLA check
    const result = await runSlaCheck();

    // Return the result
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result: {
        ticketsChecked: result.ticketsChecked,
        breachesDetected: result.breachesDetected,
        warningsSent: result.warningsSent,
        errors: result.errors
      }
    });
  } catch (error) {
    console.error('SLA check endpoint failed:', error);
    return NextResponse.json(
      { 
        error: 'SLA check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET endpoint for manual trigger or health check
export async function GET(request: NextRequest) {
  try {
    // Return SLA configuration and status
    const { SLA_MINUTES } = await import('@/config/sla');
    
    return NextResponse.json({
      success: true,
      message: 'SLA check endpoint is active',
      configuration: {
        slaMinutes: SLA_MINUTES,
        endpoint: '/api/jobs/sla-check',
        method: 'POST',
        authentication: 'Bearer token required (use SERVICE_SECRET or CRON_SECRET)',
        frequency: 'Recommended: Every 5-10 minutes'
      },
      instructions: {
        vercelCron: 'Add to vercel.json: { "crons": [{ "path": "/api/jobs/sla-check", "schedule": "*/5 * * * *" }] }',
        externalCron: 'POST to this endpoint with Bearer token every 5-10 minutes',
        manual: 'POST to this endpoint to trigger SLA check manually'
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get SLA configuration' },
      { status: 500 }
    );
  }
}