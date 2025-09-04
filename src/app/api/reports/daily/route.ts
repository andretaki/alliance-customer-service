import { NextRequest, NextResponse } from 'next/server';
import { Reporter } from '@/services/analytics/Reporter';

const reporter = new Reporter();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dateParam = searchParams.get('date');
    
    const date = dateParam ? new Date(dateParam) : new Date();
    
    if (isNaN(date.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date parameter' },
        { status: 400 }
      );
    }

    const metrics = await reporter.getDailyMetrics(date);

    return NextResponse.json({
      success: true,
      metrics,
    });
  } catch (error) {
    console.error('Failed to get daily metrics:', error);
    return NextResponse.json(
      { error: 'Failed to get daily metrics' },
      { status: 500 }
    );
  }
}