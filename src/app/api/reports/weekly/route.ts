import { NextRequest, NextResponse } from 'next/server';
import { Reporter } from '@/services/analytics/Reporter';

const reporter = new Reporter();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const weekOffset = parseInt(searchParams.get('weekOffset') || '0', 10);

    const report = await reporter.getWeeklyReport(weekOffset);

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error('Failed to generate weekly report:', error);
    return NextResponse.json(
      { error: 'Failed to generate weekly report' },
      { status: 500 }
    );
  }
}