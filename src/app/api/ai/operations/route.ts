import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { aiOperations } from '@/db/ticketing';
import { desc, eq, and, gte, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const operation = searchParams.get('operation');
    const ticketId = searchParams.get('ticketId');
    const limit = parseInt(searchParams.get('limit') || '100');
    const success = searchParams.get('success');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build query conditions
    const conditions = [];
    
    if (operation) {
      conditions.push(eq(aiOperations.operation, operation));
    }
    
    if (ticketId) {
      conditions.push(eq(aiOperations.ticketId, parseInt(ticketId)));
    }
    
    if (success !== null) {
      conditions.push(eq(aiOperations.success, success === 'true'));
    }
    
    if (startDate) {
      conditions.push(gte(aiOperations.createdAt, new Date(startDate)));
    }

    // Get operations
    const operations = await db
      .select()
      .from(aiOperations)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(aiOperations.createdAt))
      .limit(limit);

    // Get statistics
    const stats = await db
      .select({
        operation: aiOperations.operation,
        provider: aiOperations.provider,
        totalCount: sql<number>`count(*)::int`,
        successCount: sql<number>`sum(case when ${aiOperations.success} then 1 else 0 end)::int`,
        avgResponseTime: sql<number>`avg(${aiOperations.responseTimeMs})::int`,
        totalCost: sql<number>`sum(coalesce(${aiOperations.costEstimate}, 0))::int`,
      })
      .from(aiOperations)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(aiOperations.operation, aiOperations.provider);

    return NextResponse.json({
      success: true,
      operations,
      statistics: stats,
      summary: {
        totalOperations: operations.length,
        uniqueProviders: [...new Set(operations.map(op => op.provider))],
        uniqueOperationTypes: [...new Set(operations.map(op => op.operation))],
        overallSuccessRate: operations.length > 0
          ? (operations.filter(op => op.success).length / operations.length * 100).toFixed(2)
          : 0,
      },
    });
  } catch (error) {
    console.error('Failed to get AI operations:', error);
    return NextResponse.json(
      { error: 'Failed to get AI operations' },
      { status: 500 }
    );
  }
}