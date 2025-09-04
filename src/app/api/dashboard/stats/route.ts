import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tickets, ticketActions, calls, aiOperations } from '@/db/ticketing';
import { eq, and, gte, lte, count, desc, sql, inArray } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // Get current date boundaries
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // Get week boundaries for trending
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);

    // Fetch all statistics in parallel for performance
    const [
      openTicketsCount,
      todayTicketsCount,
      activeAlertsCount,
      ticketsByStatus,
      ticketsByType,
      ticketsByPriority,
      recentTickets,
      agentPerformance,
      slaBreaches,
      avgResponseTime,
      systemHealth,
      aiOperationsToday,
    ] = await Promise.all([
      // Open tickets count
      db.select({ count: count() })
        .from(tickets)
        .where(inArray(tickets.status, ['open', 'routed', 'in_progress'])),
      
      // Today's tickets count
      db.select({ count: count() })
        .from(tickets)
        .where(
          and(
            gte(tickets.createdAt, todayStart),
            lte(tickets.createdAt, todayEnd)
          )
        ),
      
      // Active alerts (high priority or breached SLA)
      db.select({ count: count() })
        .from(tickets)
        .where(
          and(
            inArray(tickets.status, ['open', 'routed', 'in_progress']),
            sql`(${tickets.priority} = 'urgent' OR ${tickets.priority} = 'high' OR ${tickets.breached} = true)`
          )
        ),
      
      // Tickets by status
      db.select({
        status: tickets.status,
        count: count(),
      })
        .from(tickets)
        .groupBy(tickets.status),
      
      // Tickets by type
      db.select({
        type: tickets.requestType,
        count: count(),
      })
        .from(tickets)
        .where(
          and(
            gte(tickets.createdAt, weekStart),
            lte(tickets.createdAt, now)
          )
        )
        .groupBy(tickets.requestType),
      
      // Tickets by priority
      db.select({
        priority: tickets.priority,
        count: count(),
      })
        .from(tickets)
        .where(inArray(tickets.status, ['open', 'routed', 'in_progress']))
        .groupBy(tickets.priority),
      
      // Recent tickets (last 10)
      db.select({
        id: tickets.id,
        requestType: tickets.requestType,
        status: tickets.status,
        priority: tickets.priority,
        summary: tickets.summary,
        customerName: tickets.customerName,
        customerEmail: tickets.customerEmail,
        assignee: tickets.assignee,
        createdAt: tickets.createdAt,
        aiSentiment: tickets.aiSentiment,
        breached: tickets.breached,
      })
        .from(tickets)
        .orderBy(desc(tickets.createdAt))
        .limit(10),
      
      // Agent performance
      db.select({
        assignee: tickets.assignee,
        count: count(),
        avgResolutionTime: sql<number>`
          AVG(
            CASE 
              WHEN ${tickets.resolvedAt} IS NOT NULL 
              THEN EXTRACT(EPOCH FROM (${tickets.resolvedAt} - ${tickets.createdAt})) / 60
              ELSE NULL
            END
          )
        `,
      })
        .from(tickets)
        .where(
          and(
            gte(tickets.createdAt, weekStart),
            lte(tickets.createdAt, now)
          )
        )
        .groupBy(tickets.assignee),
      
      // SLA breaches today
      db.select({ count: count() })
        .from(tickets)
        .where(
          and(
            gte(tickets.createdAt, todayStart),
            lte(tickets.createdAt, todayEnd),
            eq(tickets.breached, true)
          )
        ),
      
      // Average first response time today
      db.select({
        avgTime: sql<number>`
          AVG(
            CASE 
              WHEN ${tickets.firstResponseAt} IS NOT NULL 
              THEN EXTRACT(EPOCH FROM (${tickets.firstResponseAt} - ${tickets.createdAt})) / 60
              ELSE NULL
            END
          )
        `,
      })
        .from(tickets)
        .where(
          and(
            gte(tickets.createdAt, todayStart),
            lte(tickets.createdAt, todayEnd)
          )
        ),
      
      // System health checks
      Promise.all([
        // Check AI service
        db.select({ count: count() })
          .from(aiOperations)
          .where(
            and(
              gte(aiOperations.createdAt, todayStart),
              eq(aiOperations.success, true)
            )
          ),
        // Check recent failures
        db.select({ count: count() })
          .from(aiOperations)
          .where(
            and(
              gte(aiOperations.createdAt, todayStart),
              eq(aiOperations.success, false)
            )
          ),
      ]),
      
      // AI operations today
      db.select({
        operation: aiOperations.operation,
        count: count(),
        avgResponseTime: sql<number>`AVG(${aiOperations.responseTimeMs})`,
      })
        .from(aiOperations)
        .where(
          and(
            gte(aiOperations.createdAt, todayStart),
            lte(aiOperations.createdAt, todayEnd)
          )
        )
        .groupBy(aiOperations.operation),
    ]);

    // Calculate SLA statistics
    const slaStats = {
      total: todayTicketsCount[0]?.count || 0,
      breached: slaBreaches[0]?.count || 0,
      atRisk: 0, // TODO: Calculate based on time remaining
      healthy: 0,
    };
    slaStats.healthy = slaStats.total - slaStats.breached - slaStats.atRisk;

    // Process system health
    const aiSuccessCount = systemHealth[0][0]?.count || 0;
    const aiFailureCount = systemHealth[1][0]?.count || 0;
    const aiHealthScore = aiSuccessCount + aiFailureCount > 0
      ? (aiSuccessCount / (aiSuccessCount + aiFailureCount)) * 100
      : 100;

    // Format response
    const stats = {
      overview: {
        openTickets: openTicketsCount[0]?.count || 0,
        todayTickets: todayTicketsCount[0]?.count || 0,
        activeAlerts: activeAlertsCount[0]?.count || 0,
        avgResponseTime: Math.round(avgResponseTime[0]?.avgTime || 0),
      },
      ticketDistribution: {
        byStatus: ticketsByStatus.reduce((acc, item) => {
          acc[item.status] = item.count;
          return acc;
        }, {} as Record<string, number>),
        byType: ticketsByType.reduce((acc, item) => {
          acc[item.type] = item.count;
          return acc;
        }, {} as Record<string, number>),
        byPriority: ticketsByPriority.reduce((acc, item) => {
          acc[item.priority || 'normal'] = item.count;
          return acc;
        }, {} as Record<string, number>),
      },
      sla: slaStats,
      recentTickets: recentTickets.map(ticket => ({
        ...ticket,
        timeAgo: getTimeAgo(ticket.createdAt),
      })),
      agentPerformance: agentPerformance
        .filter(agent => agent.assignee)
        .map(agent => ({
          name: agent.assignee,
          ticketsHandled: agent.count,
          avgResolutionTime: Math.round(agent.avgResolutionTime || 0),
        }))
        .sort((a, b) => b.ticketsHandled - a.ticketsHandled),
      systemHealth: {
        ai: {
          status: aiHealthScore >= 90 ? 'healthy' : aiHealthScore >= 70 ? 'degraded' : 'critical',
          score: Math.round(aiHealthScore),
          operations: aiOperationsToday.reduce((acc, op) => {
            acc[op.operation] = {
              count: op.count,
              avgResponseTime: Math.round(op.avgResponseTime || 0),
            };
            return acc;
          }, {} as Record<string, any>),
        },
        integrations: {
          shopify: 'connected', // TODO: Check actual status
          quickbooks: 'connected', // TODO: Check actual status
          threeCX: 'connected', // TODO: Check actual status
          teams: 'connected', // TODO: Check actual status
        },
      },
      trends: {
        ticketVolume: [], // TODO: Implement hourly trend
        responseTime: [], // TODO: Implement daily trend
      },
    };

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    );
  }
}

function getTimeAgo(date: Date | null): string {
  if (!date) return '';
  
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}