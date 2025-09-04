import { db } from '@/db';
import { tickets, ticketActions, calls } from '@/db/ticketing';
import { sql, eq, and, gte, lte, count, avg } from 'drizzle-orm';

export interface WeeklyMetrics {
  period: {
    start: Date;
    end: Date;
  };
  tickets: {
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    byPriority: Record<string, number>;
    avgResolutionTime: number;
    slaBreaches: number;
  };
  calls: {
    total: number;
    inbound: number;
    outbound: number;
    avgDuration: number;
  };
  agents: Array<{
    name: string;
    ticketsHandled: number;
    avgResponseTime: number;
    ticketsResolved: number;
  }>;
}

export class Reporter {
  async getWeeklyReport(weekOffset: number = 0): Promise<WeeklyMetrics> {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() - (weekOffset * 7));
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Get ticket metrics
    const ticketMetrics = await this.getTicketMetrics(weekStart, weekEnd);
    
    // Get call metrics
    const callMetrics = await this.getCallMetrics(weekStart, weekEnd);
    
    // Get agent performance
    const agentMetrics = await this.getAgentMetrics(weekStart, weekEnd);

    return {
      period: {
        start: weekStart,
        end: weekEnd,
      },
      tickets: ticketMetrics,
      calls: callMetrics,
      agents: agentMetrics,
    };
  }

  private async getTicketMetrics(start: Date, end: Date) {
    // Get all tickets in period
    const ticketsInPeriod = await db
      .select()
      .from(tickets)
      .where(
        and(
          gte(tickets.createdAt, start),
          lte(tickets.createdAt, end)
        )
      );

    // Count by status
    const byStatus = ticketsInPeriod.reduce((acc, ticket) => {
      acc[ticket.status] = (acc[ticket.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Count by type
    const byType = ticketsInPeriod.reduce((acc, ticket) => {
      acc[ticket.requestType] = (acc[ticket.requestType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Count by priority
    const byPriority = ticketsInPeriod.reduce((acc, ticket) => {
      const priority = ticket.priority || 'normal';
      acc[priority] = (acc[priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate average resolution time
    const resolvedTickets = ticketsInPeriod.filter(t => t.resolvedAt);
    let avgResolutionTime = 0;
    
    if (resolvedTickets.length > 0) {
      const totalTime = resolvedTickets.reduce((sum, ticket) => {
        const created = new Date(ticket.createdAt!).getTime();
        const resolved = new Date(ticket.resolvedAt!).getTime();
        return sum + (resolved - created);
      }, 0);
      avgResolutionTime = totalTime / resolvedTickets.length / (1000 * 60); // in minutes
    }

    // Count SLA breaches
    const slaBreaches = ticketsInPeriod.filter(t => t.breached).length;

    return {
      total: ticketsInPeriod.length,
      byStatus,
      byType,
      byPriority,
      avgResolutionTime,
      slaBreaches,
    };
  }

  private async getCallMetrics(start: Date, end: Date) {
    // Get all calls in period
    const callsInPeriod = await db
      .select()
      .from(calls)
      .where(
        and(
          gte(calls.startedAt, start),
          lte(calls.startedAt, end)
        )
      );

    // Count by direction
    const inbound = callsInPeriod.filter(c => c.direction === 'inbound').length;
    const outbound = callsInPeriod.filter(c => c.direction === 'outbound').length;

    // Calculate average duration
    let avgDuration = 0;
    const completedCalls = callsInPeriod.filter(c => c.endedAt);
    
    if (completedCalls.length > 0) {
      const totalDuration = completedCalls.reduce((sum, call) => {
        const start = new Date(call.startedAt).getTime();
        const end = new Date(call.endedAt!).getTime();
        return sum + (end - start);
      }, 0);
      avgDuration = totalDuration / completedCalls.length / (1000 * 60); // in minutes
    }

    return {
      total: callsInPeriod.length,
      inbound,
      outbound,
      avgDuration,
    };
  }

  private async getAgentMetrics(start: Date, end: Date) {
    // Get tickets assigned to agents in period
    const agentTickets = await db
      .select()
      .from(tickets)
      .where(
        and(
          gte(tickets.createdAt, start),
          lte(tickets.createdAt, end),
          sql`${tickets.assignee} IS NOT NULL`
        )
      );

    // Group by agent
    const agentMap = new Map<string, {
      ticketsHandled: number;
      totalResponseTime: number;
      responseCount: number;
      ticketsResolved: number;
    }>();

    for (const ticket of agentTickets) {
      const agent = ticket.assignee!;
      
      if (!agentMap.has(agent)) {
        agentMap.set(agent, {
          ticketsHandled: 0,
          totalResponseTime: 0,
          responseCount: 0,
          ticketsResolved: 0,
        });
      }

      const metrics = agentMap.get(agent)!;
      metrics.ticketsHandled++;

      if (ticket.firstResponseAt) {
        const created = new Date(ticket.createdAt!).getTime();
        const responded = new Date(ticket.firstResponseAt).getTime();
        metrics.totalResponseTime += (responded - created);
        metrics.responseCount++;
      }

      if (ticket.status === 'resolved' || ticket.status === 'closed') {
        metrics.ticketsResolved++;
      }
    }

    // Convert to array with averages
    return Array.from(agentMap.entries()).map(([name, metrics]) => ({
      name,
      ticketsHandled: metrics.ticketsHandled,
      avgResponseTime: metrics.responseCount > 0
        ? metrics.totalResponseTime / metrics.responseCount / (1000 * 60) // in minutes
        : 0,
      ticketsResolved: metrics.ticketsResolved,
    }));
  }

  async getDailyMetrics(date: Date = new Date()) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    // Get hourly ticket creation
    const ticketsToday = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${tickets.createdAt})`,
        count: count(),
      })
      .from(tickets)
      .where(
        and(
          gte(tickets.createdAt, dayStart),
          lte(tickets.createdAt, dayEnd)
        )
      )
      .groupBy(sql`EXTRACT(HOUR FROM ${tickets.createdAt})`);

    // Get current open tickets
    const openTickets = await db
      .select({ count: count() })
      .from(tickets)
      .where(eq(tickets.status, 'open'));

    // Get today's SLA breaches
    const breachesToday = await db
      .select({ count: count() })
      .from(tickets)
      .where(
        and(
          gte(tickets.createdAt, dayStart),
          lte(tickets.createdAt, dayEnd),
          eq(tickets.breached, true)
        )
      );

    return {
      date: date.toISOString().split('T')[0],
      ticketsByHour: ticketsToday,
      openTickets: openTickets[0]?.count || 0,
      breachesToday: breachesToday[0]?.count || 0,
    };
  }
}