import { NextRequest, NextResponse } from 'next/server';
import { reportService } from '@/services/reports/ReportService';

// This endpoint can be called by Vercel Cron to send weekly reports
// Configure in vercel.json:
// {
//   "crons": [{
//     "path": "/api/jobs/weekly-report",
//     "schedule": "0 8 * * 1"  // Every Monday at 8 AM UTC
//   }]
// }

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

    // Send the weekly report
    await reportService.sendWeeklyReport();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: 'Weekly report sent successfully'
    });
  } catch (error) {
    console.error('Weekly report job failed:', error);
    return NextResponse.json(
      { 
        error: 'Weekly report failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET endpoint for manual trigger or configuration info
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      message: 'Weekly report endpoint is active',
      configuration: {
        endpoint: '/api/jobs/weekly-report',
        method: 'POST',
        authentication: 'Bearer token required (use SERVICE_SECRET or CRON_SECRET)',
        schedule: 'Recommended: Every Monday at 8 AM',
        recipients: 'Configured in environment or defaults to management team'
      },
      instructions: {
        vercelCron: 'Add to vercel.json: { "crons": [{ "path": "/api/jobs/weekly-report", "schedule": "0 8 * * 1" }] }',
        externalCron: 'POST to this endpoint with Bearer token every Monday morning',
        manual: 'POST to this endpoint to send report immediately',
        testing: 'Use GET /api/reports/weekly to preview stats without sending email'
      },
      nextScheduledRun: getNextMonday()
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get weekly report configuration' },
      { status: 500 }
    );
  }
}

function getNextMonday(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7;
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(8, 0, 0, 0); // 8 AM
  return nextMonday.toISOString();
}