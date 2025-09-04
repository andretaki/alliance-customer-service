import { db } from '@/db';
import { tickets, calls, ticketActions } from '@/db/ticketing';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { sendEmail } from '@/lib/mailer';
import { notifyWeeklyReport } from '@/lib/teams';

export interface WeeklyStats {
  totalTickets: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  avgResponseTimeMinutes: number;
  avgResolutionTimeHours: number;
  breachedSLA: number;
  totalCalls: number;
  missedCalls: number;
  topAgents: Array<{ name: string; count: number }>;
  topCustomers: Array<{ email: string; count: number }>;
  aiUsage: {
    classificationsPerformed: number;
    coaAutoAttached: number;
    routingSuggestions: number;
  };
}

export class ReportService {
  private static instance: ReportService;
  
  private constructor() {}
  
  static getInstance(): ReportService {
    if (!ReportService.instance) {
      ReportService.instance = new ReportService();
    }
    return ReportService.instance;
  }
  
  /**
   * Generate weekly statistics
   */
  async generateWeeklyStats(startDate?: Date, endDate?: Date): Promise<WeeklyStats> {
    // Default to last 7 days if not specified
    if (!endDate) {
      endDate = new Date();
    }
    if (!startDate) {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
    }
    
    // Get all tickets in date range
    const ticketsInRange = await db
      .select()
      .from(tickets)
      .where(
        and(
          gte(tickets.createdAt, startDate),
          lte(tickets.createdAt, endDate)
        )
      );
    
    // Calculate ticket statistics
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const byAssignee: Record<string, number> = {};
    const byCustomer: Record<string, number> = {};
    
    let totalResponseTime = 0;
    let responseTimeCount = 0;
    let totalResolutionTime = 0;
    let resolutionTimeCount = 0;
    let breachedSLA = 0;
    let coaAutoAttached = 0;
    
    for (const ticket of ticketsInRange) {
      // Count by type
      byType[ticket.requestType] = (byType[ticket.requestType] || 0) + 1;
      
      // Count by status
      byStatus[ticket.status] = (byStatus[ticket.status] || 0) + 1;
      
      // Count by priority
      const priority = ticket.priority || 'normal';
      byPriority[priority] = (byPriority[priority] || 0) + 1;
      
      // Count by assignee
      if (ticket.assignee) {
        byAssignee[ticket.assignee] = (byAssignee[ticket.assignee] || 0) + 1;
      }
      
      // Count by customer
      if (ticket.customerEmail) {
        byCustomer[ticket.customerEmail] = (byCustomer[ticket.customerEmail] || 0) + 1;
      }
      
      // Calculate response time
      if (ticket.firstResponseAt) {
        const responseTime = (new Date(ticket.firstResponseAt).getTime() - new Date(ticket.createdAt).getTime()) / 60000; // in minutes
        totalResponseTime += responseTime;
        responseTimeCount++;
      }
      
      // Calculate resolution time
      if (ticket.resolvedAt) {
        const resolutionTime = (new Date(ticket.resolvedAt).getTime() - new Date(ticket.createdAt).getTime()) / 3600000; // in hours
        totalResolutionTime += resolutionTime;
        resolutionTimeCount++;
      }
      
      // Count breached SLAs
      if (ticket.breached) {
        breachedSLA++;
      }
      
      // Count COA auto-attachments
      if (ticket.data && (ticket.data as any).coaAutoAttached) {
        coaAutoAttached++;
      }
    }
    
    // Get call statistics
    const callsInRange = await db
      .select()
      .from(calls)
      .where(
        and(
          gte(calls.startedAt, startDate),
          lte(calls.startedAt, endDate)
        )
      );
    
    const totalCalls = callsInRange.length;
    const missedCalls = callsInRange.filter(call => 
      call.raw && (call.raw as any).missed === true
    ).length;
    
    // Get AI usage statistics
    const aiClassifications = ticketsInRange.filter(t => t.aiClassification).length;
    const routingSuggestions = ticketsInRange.filter(t => t.aiRoutingSuggestion).length;
    
    // Sort top agents and customers
    const topAgents = Object.entries(byAssignee)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
    
    const topCustomers = Object.entries(byCustomer)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([email, count]) => ({ email, count }));
    
    return {
      totalTickets: ticketsInRange.length,
      byType,
      byStatus,
      byPriority,
      avgResponseTimeMinutes: responseTimeCount > 0 ? Math.round(totalResponseTime / responseTimeCount) : 0,
      avgResolutionTimeHours: resolutionTimeCount > 0 ? Math.round(totalResolutionTime / resolutionTimeCount) : 0,
      breachedSLA,
      totalCalls,
      missedCalls,
      topAgents,
      topCustomers,
      aiUsage: {
        classificationsPerformed: aiClassifications,
        coaAutoAttached,
        routingSuggestions,
      },
    };
  }
  
  /**
   * Generate HTML report
   */
  generateHTMLReport(stats: WeeklyStats, startDate: Date, endDate: Date): string {
    const formatDate = (date: Date) => date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
    h2 { color: #34495e; margin-top: 30px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
    .stat-card { background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #3498db; }
    .stat-value { font-size: 28px; font-weight: bold; color: #2c3e50; }
    .stat-label { color: #7f8c8d; font-size: 14px; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #3498db; color: white; padding: 10px; text-align: left; }
    td { padding: 8px; border-bottom: 1px solid #ecf0f1; }
    tr:hover { background: #f8f9fa; }
    .chart-bar { background: #3498db; height: 20px; border-radius: 3px; }
    .warning { color: #e74c3c; font-weight: bold; }
    .success { color: #27ae60; font-weight: bold; }
  </style>
</head>
<body>
  <h1>📊 Weekly Customer Service Report</h1>
  <p><strong>Period:</strong> ${formatDate(startDate)} - ${formatDate(endDate)}</p>
  
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-value">${stats.totalTickets}</div>
      <div class="stat-label">Total Tickets</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.avgResponseTimeMinutes}</div>
      <div class="stat-label">Avg Response (min)</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.avgResolutionTimeHours}</div>
      <div class="stat-label">Avg Resolution (hrs)</div>
    </div>
    <div class="stat-card">
      <div class="stat-value ${stats.breachedSLA > 0 ? 'warning' : 'success'}">${stats.breachedSLA}</div>
      <div class="stat-label">SLA Breaches</div>
    </div>
  </div>
  
  <h2>📋 Tickets by Type</h2>
  <table>
    <thead>
      <tr>
        <th>Type</th>
        <th>Count</th>
        <th style="width: 40%">Distribution</th>
      </tr>
    </thead>
    <tbody>
      ${Object.entries(stats.byType)
        .sort(([, a], [, b]) => b - a)
        .map(([type, count]) => {
          const percentage = Math.round((count / stats.totalTickets) * 100);
          return `
            <tr>
              <td>${type.toUpperCase()}</td>
              <td>${count}</td>
              <td>
                <div style="display: flex; align-items: center;">
                  <div class="chart-bar" style="width: ${percentage}%;"></div>
                  <span style="margin-left: 10px;">${percentage}%</span>
                </div>
              </td>
            </tr>
          `;
        }).join('')}
    </tbody>
  </table>
  
  <h2>📈 Ticket Status</h2>
  <table>
    <thead>
      <tr>
        <th>Status</th>
        <th>Count</th>
      </tr>
    </thead>
    <tbody>
      ${Object.entries(stats.byStatus)
        .sort(([, a], [, b]) => b - a)
        .map(([status, count]) => `
          <tr>
            <td>${status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}</td>
            <td>${count}</td>
          </tr>
        `).join('')}
    </tbody>
  </table>
  
  <h2>🏆 Top Agents</h2>
  <table>
    <thead>
      <tr>
        <th>Agent</th>
        <th>Tickets Handled</th>
      </tr>
    </thead>
    <tbody>
      ${stats.topAgents.map((agent, index) => `
        <tr>
          <td>${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : ''} ${agent.name}</td>
          <td>${agent.count}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  
  <h2>📞 Call Statistics</h2>
  <table>
    <tr>
      <td>Total Calls:</td>
      <td><strong>${stats.totalCalls}</strong></td>
    </tr>
    <tr>
      <td>Missed Calls:</td>
      <td class="${stats.missedCalls > 0 ? 'warning' : ''}">${stats.missedCalls}</td>
    </tr>
    <tr>
      <td>Answer Rate:</td>
      <td>${stats.totalCalls > 0 ? Math.round(((stats.totalCalls - stats.missedCalls) / stats.totalCalls) * 100) : 0}%</td>
    </tr>
  </table>
  
  <h2>🤖 AI Performance</h2>
  <table>
    <tr>
      <td>AI Classifications:</td>
      <td>${stats.aiUsage.classificationsPerformed}</td>
    </tr>
    <tr>
      <td>COA Auto-Attached:</td>
      <td>${stats.aiUsage.coaAutoAttached}</td>
    </tr>
    <tr>
      <td>Routing Suggestions:</td>
      <td>${stats.aiUsage.routingSuggestions}</td>
    </tr>
  </table>
  
  <h2>🎯 Priority Distribution</h2>
  <table>
    <thead>
      <tr>
        <th>Priority</th>
        <th>Count</th>
      </tr>
    </thead>
    <tbody>
      ${['urgent', 'high', 'normal', 'low']
        .filter(priority => stats.byPriority[priority])
        .map(priority => `
          <tr>
            <td>${priority.toUpperCase()}</td>
            <td>${stats.byPriority[priority] || 0}</td>
          </tr>
        `).join('')}
    </tbody>
  </table>
  
  <hr style="margin-top: 40px; border: 1px solid #ecf0f1;">
  <p style="text-align: center; color: #7f8c8d; font-size: 12px;">
    Generated on ${new Date().toLocaleString('en-US', { 
      dateStyle: 'full', 
      timeStyle: 'short' 
    })} CT<br>
    Alliance Chemical Customer Service System
  </p>
</body>
</html>
    `;
  }
  
  /**
   * Send weekly report via email
   */
  async sendWeeklyReport(recipients?: string[]): Promise<void> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      
      // Generate statistics
      const stats = await this.generateWeeklyStats(startDate, endDate);
      
      // Generate HTML report
      const htmlContent = this.generateHTMLReport(stats, startDate, endDate);
      
      // Default recipients if not specified
      const emailRecipients = recipients || [
        'manager@alliancechemical.com',
        'supervisor@alliancechemical.com',
        'coo@alliancechemical.com',
      ];
      
      // Send email
      await sendEmail({
        to: emailRecipients,
        subject: `Weekly Customer Service Report - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        html: htmlContent,
        text: this.generateTextReport(stats, startDate, endDate),
      });
      
      // Send Teams notification
      await notifyWeeklyReport({
        totalTickets: stats.totalTickets,
        byType: stats.byType,
        avgResponseTime: stats.avgResponseTimeMinutes,
        breachedSLA: stats.breachedSLA,
      });
      
      console.log(`Weekly report sent to ${emailRecipients.length} recipients`);
    } catch (error) {
      console.error('Failed to send weekly report:', error);
      throw error;
    }
  }
  
  /**
   * Generate plain text report
   */
  private generateTextReport(stats: WeeklyStats, startDate: Date, endDate: Date): string {
    return `
WEEKLY CUSTOMER SERVICE REPORT
${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}

SUMMARY
-------
Total Tickets: ${stats.totalTickets}
Avg Response Time: ${stats.avgResponseTimeMinutes} minutes
Avg Resolution Time: ${stats.avgResolutionTimeHours} hours
SLA Breaches: ${stats.breachedSLA}

TICKETS BY TYPE
---------------
${Object.entries(stats.byType)
  .sort(([, a], [, b]) => b - a)
  .map(([type, count]) => `${type.toUpperCase()}: ${count}`)
  .join('\n')}

CALL STATISTICS
---------------
Total Calls: ${stats.totalCalls}
Missed Calls: ${stats.missedCalls}

TOP AGENTS
----------
${stats.topAgents.map((agent, i) => `${i + 1}. ${agent.name}: ${agent.count} tickets`).join('\n')}

---
Alliance Chemical Customer Service System
    `.trim();
  }
}

export const reportService = ReportService.getInstance();