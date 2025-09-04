interface TeamsMessage {
  "@type": "MessageCard";
  "@context": "https://schema.org/extensions";
  themeColor?: string;
  summary: string;
  sections?: TeamsSection[];
  potentialAction?: TeamsAction[];
}

interface TeamsSection {
  activityTitle?: string;
  activitySubtitle?: string;
  activityImage?: string;
  facts?: TeamsFact[];
  text?: string;
  markdown?: boolean;
}

interface TeamsFact {
  name: string;
  value: string;
}

interface TeamsAction {
  "@type": "OpenUri";
  name: string;
  targets: Array<{
    os: "default";
    uri: string;
  }>;
}

interface TicketNotification {
  id: number;
  requestType: string;
  priority?: string;
  customerName?: string;
  assignee?: string;
  summary?: string;
  aiSentiment?: string;
}

export async function notifyTeams(text: string): Promise<void> {
  const webhookUrl = process.env.TEAMS_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log('Teams webhook not configured, skipping notification');
    return;
  }

  try {
    const message: TeamsMessage = {
      "@type": "MessageCard",
      "@context": "https://schema.org/extensions",
      summary: text,
      sections: [{
        text: text,
        markdown: true
      }]
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Teams webhook failed: ${response.status}`);
    }
  } catch (error) {
    console.error('Failed to send Teams notification:', error);
    // Don't throw - Teams notifications should not break the main flow
  }
}

export async function notifyTeamsRichMessage(message: TeamsMessage): Promise<void> {
  const webhookUrl = process.env.TEAMS_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log('Teams webhook not configured, skipping notification');
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Teams webhook failed: ${response.status}`);
    }
  } catch (error) {
    console.error('Failed to send Teams notification:', error);
  }
}

export async function notifyTicketCreated(ticket: TicketNotification): Promise<void> {
  const priorityColors: Record<string, string> = {
    urgent: 'DC3545',
    high: 'FD7E14',
    normal: '28A745',
    low: '6C757D'
  };

  const sentimentEmojis: Record<string, string> = {
    positive: '😊',
    neutral: '😐',
    negative: '😟'
  };

  const color = priorityColors[ticket.priority || 'normal'] || priorityColors.normal;
  const sentimentEmoji = ticket.aiSentiment ? sentimentEmojis[ticket.aiSentiment] || '' : '';

  const message: TeamsMessage = {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    themeColor: color,
    summary: `New ${ticket.requestType.toUpperCase()} ticket #${ticket.id} assigned to ${ticket.assignee || 'unassigned'}`,
    sections: [
      {
        activityTitle: `New Ticket #${ticket.id}`,
        activitySubtitle: `${ticket.requestType.toUpperCase()} • ${ticket.priority?.toUpperCase() || 'NORMAL'} Priority`,
        facts: [
          {
            name: "Customer",
            value: ticket.customerName || "Unknown"
          },
          {
            name: "Assigned To",
            value: ticket.assignee || "Unassigned"
          }
        ]
      }
    ]
  };

  // Add summary section if available
  if (ticket.summary) {
    message.sections!.push({
      text: `**Summary:**\n${ticket.summary.substring(0, 500)}${ticket.summary.length > 500 ? '...' : ''}`,
      markdown: true
    });
  }

  // Add sentiment if available
  if (ticket.aiSentiment) {
    message.sections!.push({
      text: `${sentimentEmoji} Customer sentiment: ${ticket.aiSentiment}`,
      markdown: true
    });
  }

  // Add action button
  message.potentialAction = [
    {
      "@type": "OpenUri",
      name: "View Ticket",
      targets: [
        {
          os: "default",
          uri: `${process.env.APP_URL}/tickets/${ticket.id}`
        }
      ]
    }
  ];

  await notifyTeamsRichMessage(message);
}

export async function notifyTicketRouted(
  ticketId: number,
  requestType: string,
  fromAssignee: string | null,
  toAssignee: string
): Promise<void> {
  const text = fromAssignee
    ? `🔄 Ticket #${ticketId} (${requestType}) reassigned from ${fromAssignee} to ${toAssignee}`
    : `📨 Ticket #${ticketId} (${requestType}) assigned to ${toAssignee}`;
  
  await notifyTeams(text);
}

export async function notifySLABreach(
  ticketId: number,
  requestType: string,
  assignee: string | null,
  minutesOverdue: number
): Promise<void> {
  const message: TeamsMessage = {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    themeColor: "DC3545",
    summary: `🚨 SLA BREACH: Ticket #${ticketId}`,
    sections: [
      {
        activityTitle: "🚨 SLA Breach Alert",
        activitySubtitle: `Immediate attention required`,
        facts: [
          {
            name: "Ticket",
            value: `#${ticketId}`
          },
          {
            name: "Type",
            value: requestType.toUpperCase()
          },
          {
            name: "Assignee",
            value: assignee || "Unassigned"
          },
          {
            name: "Overdue",
            value: `${Math.round(minutesOverdue)} minutes`
          }
        ]
      }
    ],
    potentialAction: [
      {
        "@type": "OpenUri",
        name: "Handle Now",
        targets: [
          {
            os: "default",
            uri: `${process.env.APP_URL}/tickets/${ticketId}`
          }
        ]
      }
    ]
  };

  await notifyTeamsRichMessage(message);
}

export async function notifyWeeklyReport(stats: {
  totalTickets: number;
  byType: Record<string, number>;
  avgResponseTime: number;
  breachedSLA: number;
}): Promise<void> {
  const message: TeamsMessage = {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    themeColor: "0078D4",
    summary: "📊 Weekly Customer Service Report",
    sections: [
      {
        activityTitle: "📊 Weekly Report",
        activitySubtitle: `Week ending ${new Date().toLocaleDateString()}`,
        facts: [
          {
            name: "Total Tickets",
            value: stats.totalTickets.toString()
          },
          {
            name: "Quotes",
            value: (stats.byType.quote || 0).toString()
          },
          {
            name: "COA Requests",
            value: (stats.byType.coa || 0).toString()
          },
          {
            name: "Freight",
            value: (stats.byType.freight || 0).toString()
          },
          {
            name: "Claims",
            value: (stats.byType.claim || 0).toString()
          },
          {
            name: "Avg Response Time",
            value: `${Math.round(stats.avgResponseTime)} minutes`
          },
          {
            name: "SLA Breaches",
            value: stats.breachedSLA.toString()
          }
        ]
      }
    ],
    potentialAction: [
      {
        "@type": "OpenUri",
        name: "View Dashboard",
        targets: [
          {
            os: "default",
            uri: `${process.env.APP_URL}/dashboard`
          }
        ]
      }
    ]
  };

  await notifyTeamsRichMessage(message);
}