'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface DashboardStats {
  overview: {
    openTickets: number;
    todayTickets: number;
    activeAlerts: number;
    avgResponseTime: number;
  };
  ticketDistribution: {
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    byPriority: Record<string, number>;
  };
  sla: {
    total: number;
    breached: number;
    atRisk: number;
    healthy: number;
  };
  recentTickets: Array<{
    id: number;
    requestType: string;
    status: string;
    priority: string | null;
    summary: string | null;
    customerName: string | null;
    customerEmail: string | null;
    assignee: string | null;
    createdAt: string;
    aiSentiment: string | null;
    breached: boolean;
    timeAgo: string;
  }>;
  agentPerformance: Array<{
    name: string;
    ticketsHandled: number;
    avgResolutionTime: number;
  }>;
  systemHealth: {
    ai: {
      status: string;
      score: number;
      operations: Record<string, { count: number; avgResponseTime: number }>;
    };
    integrations: Record<string, string>;
  };
}

export default function Home() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/dashboard/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data.stats);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return '#3b82f6';
      case 'routed': return '#8b5cf6';
      case 'in_progress': return '#f59e0b';
      case 'resolved': return '#10b981';
      case 'closed': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'urgent': return '#dc2626';
      case 'high': return '#f59e0b';
      case 'normal': return '#3b82f6';
      case 'low': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getSentimentIcon = (sentiment: string | null) => {
    switch (sentiment) {
      case 'positive': return '😊';
      case 'negative': return '😔';
      case 'neutral': return '😐';
      default: return '';
    }
  };

  if (error) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ backgroundColor: '#fee2e2', border: '1px solid #dc2626', borderRadius: '8px', padding: '16px', color: '#dc2626' }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', padding: '0' }}>
      {/* Header */}
      <div style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', padding: '0 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '64px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#111827' }}>
            Alliance Customer Service
          </h1>
          <span style={{ fontSize: '14px', color: '#6b7280' }}>
            Live Dashboard
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 24px' }}>
        {/* Page Title */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>
            Customer Service Dashboard
          </h2>
          <p style={{ fontSize: '14px', color: '#6b7280' }}>
            Real-time overview of tickets, SLA performance, and system health
          </p>
        </div>

        {/* Key Metrics Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', marginBottom: '32px' }}>
          {/* Open Tickets */}
          <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg style={{ width: '24px', height: '24px', color: '#2563eb' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
            <div>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', marginBottom: '4px' }}>
                {loading ? '...' : stats?.overview.openTickets || 0}
              </p>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>
                Open Tickets
              </p>
            </div>
          </div>

          {/* Today's Tickets */}
          <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg style={{ width: '24px', height: '24px', color: '#10b981' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', marginBottom: '4px' }}>
                {loading ? '...' : stats?.overview.todayTickets || 0}
              </p>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>
                Today&apos;s Tickets
              </p>
            </div>
          </div>

          {/* Active Alerts */}
          <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: stats?.overview.activeAlerts ? '#fecaca' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg style={{ width: '24px', height: '24px', color: stats?.overview.activeAlerts ? '#dc2626' : '#6b7280' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            <div>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', marginBottom: '4px' }}>
                {loading ? '...' : stats?.overview.activeAlerts || 0}
              </p>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>
                Active Alerts
              </p>
            </div>
          </div>

          {/* Avg Response Time */}
          <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg style={{ width: '24px', height: '24px', color: '#6366f1' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <div>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', marginBottom: '4px' }}>
                {loading ? '...' : stats?.overview.avgResponseTime || 0}m
              </p>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>
                Avg Response Time
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>
            Quick Actions
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
            <Link href="/intake" style={{ textDecoration: 'none' }}>
              <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', textAlign: 'center', cursor: 'pointer', transition: 'box-shadow 0.2s' }}>
                <svg style={{ width: '32px', height: '32px', margin: '0 auto 8px', color: '#2563eb' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>New Ticket</span>
              </div>
            </Link>

            <Link href="/tickets" style={{ textDecoration: 'none' }}>
              <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', textAlign: 'center', cursor: 'pointer', transition: 'box-shadow 0.2s' }}>
                <svg style={{ width: '32px', height: '32px', margin: '0 auto 8px', color: '#10b981' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>View All Tickets</span>
              </div>
            </Link>

            <Link href="/reports" style={{ textDecoration: 'none' }}>
              <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', textAlign: 'center', cursor: 'pointer', transition: 'box-shadow 0.2s' }}>
                <svg style={{ width: '32px', height: '32px', margin: '0 auto 8px', color: '#8b5cf6' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>Reports</span>
              </div>
            </Link>
          </div>
        </div>

        {/* Two Column Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
          {/* SLA Performance */}
          <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>
              SLA Performance
            </h3>
            {stats?.sla && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: '#374151' }}>Healthy</span>
                  <span style={{ fontSize: '18px', fontWeight: '600', color: '#10b981' }}>{stats.sla.healthy}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: '#374151' }}>At Risk</span>
                  <span style={{ fontSize: '18px', fontWeight: '600', color: '#f59e0b' }}>{stats.sla.atRisk}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: '#374151' }}>Breached</span>
                  <span style={{ fontSize: '18px', fontWeight: '600', color: '#dc2626' }}>{stats.sla.breached}</span>
                </div>
                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '12px', marginTop: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', color: '#374151', fontWeight: '600' }}>Total Today</span>
                    <span style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>{stats.sla.total}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Ticket Distribution */}
          <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>
              Ticket Distribution
            </h3>
            {stats?.ticketDistribution && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* By Type */}
                <div>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px', textTransform: 'uppercase' }}>By Type</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {Object.entries(stats.ticketDistribution.byType).map(([type, count]) => (
                      <span key={type} style={{ backgroundColor: '#f3f4f6', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
                        {type}: <strong>{count}</strong>
                      </span>
                    ))}
                  </div>
                </div>
                {/* By Priority */}
                <div>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px', textTransform: 'uppercase' }}>By Priority</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {Object.entries(stats.ticketDistribution.byPriority).map(([priority, count]) => (
                      <span key={priority} style={{ 
                        backgroundColor: getPriorityColor(priority) + '20', 
                        color: getPriorityColor(priority),
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        {priority}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Tickets */}
        <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', marginBottom: '32px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>
            Recent Tickets
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '8px', color: '#6b7280' }}>ID</th>
                  <th style={{ textAlign: 'left', padding: '8px', color: '#6b7280' }}>Type</th>
                  <th style={{ textAlign: 'left', padding: '8px', color: '#6b7280' }}>Customer</th>
                  <th style={{ textAlign: 'left', padding: '8px', color: '#6b7280' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '8px', color: '#6b7280' }}>Priority</th>
                  <th style={{ textAlign: 'left', padding: '8px', color: '#6b7280' }}>Assignee</th>
                  <th style={{ textAlign: 'left', padding: '8px', color: '#6b7280' }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {stats?.recentTickets.map(ticket => (
                  <tr key={ticket.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px 8px' }}>
                      <Link href={`/tickets/${ticket.id}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                        #{ticket.id}
                      </Link>
                    </td>
                    <td style={{ padding: '12px 8px' }}>{ticket.requestType}</td>
                    <td style={{ padding: '12px 8px' }}>
                      <div>
                        {ticket.customerName || 'Unknown'}
                        {ticket.aiSentiment && <span style={{ marginLeft: '4px' }}>{getSentimentIcon(ticket.aiSentiment)}</span>}
                      </div>
                      {ticket.customerEmail && (
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>{ticket.customerEmail}</div>
                      )}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{ 
                        backgroundColor: getStatusColor(ticket.status) + '20',
                        color: getStatusColor(ticket.status),
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}>
                        {ticket.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{ 
                        backgroundColor: getPriorityColor(ticket.priority) + '20',
                        color: getPriorityColor(ticket.priority),
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}>
                        {ticket.priority || 'normal'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px' }}>{ticket.assignee || '-'}</td>
                    <td style={{ padding: '12px 8px', color: '#6b7280' }}>{ticket.timeAgo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!stats?.recentTickets || stats.recentTickets.length === 0) && (
              <div style={{ textAlign: 'center', padding: '32px', color: '#6b7280' }}>
                No recent tickets
              </div>
            )}
          </div>
        </div>

        {/* System Status */}
        <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>
            System Status
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* AI Service */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ 
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%', 
                  backgroundColor: stats?.systemHealth.ai.status === 'healthy' ? '#10b981' : 
                                  stats?.systemHealth.ai.status === 'degraded' ? '#f59e0b' : '#dc2626'
                }}></div>
                <span style={{ fontSize: '14px', color: '#374151' }}>AI Classification</span>
              </div>
              <span style={{ 
                fontSize: '14px', 
                color: stats?.systemHealth.ai.status === 'healthy' ? '#10b981' : 
                       stats?.systemHealth.ai.status === 'degraded' ? '#f59e0b' : '#dc2626'
              }}>
                {stats?.systemHealth.ai.score}% Health
              </span>
            </div>
            
            {/* Integrations */}
            {stats?.systemHealth.integrations && Object.entries(stats.systemHealth.integrations).map(([service, status]) => (
              <div key={service} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ 
                    width: '8px', 
                    height: '8px', 
                    borderRadius: '50%', 
                    backgroundColor: status === 'connected' ? '#10b981' : '#f59e0b'
                  }}></div>
                  <span style={{ fontSize: '14px', color: '#374151', textTransform: 'capitalize' }}>
                    {service === 'threeCX' ? '3CX Phone System' : service.charAt(0).toUpperCase() + service.slice(1)}
                  </span>
                </div>
                <span style={{ fontSize: '14px', color: status === 'connected' ? '#10b981' : '#f59e0b', textTransform: 'capitalize' }}>
                  {status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}