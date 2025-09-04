interface SlackMessage {
  text: string;
  blocks?: any[];
  attachments?: any[];
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

export async function notifySlack(text: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log('Slack webhook not configured, skipping notification');
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.status}`);
    }
  } catch (error) {
    console.error('Failed to send Slack notification:', error);
    // Don't throw - Slack notifications should not break the main flow
  }
}

export async function notifySlackRichMessage(message: SlackMessage): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log('Slack webhook not configured, skipping notification');
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
      throw new Error(`Slack webhook failed: ${response.status}`);
    }
  } catch (error) {
    console.error('Failed to send Slack notification:', error);
  }
}

export async function notifyTicketCreated(ticket: TicketNotification): Promise<void> {
  const priorityEmojis: Record<string, string> = {
    urgent: '🚨',
    high: '⚠️',
    normal: '📋',
    low: '📝'
  };

  const sentimentEmojis: Record<string, string> = {
    positive: '😊',
    neutral: '😐',
    negative: '😟'
  };

  const emoji = priorityEmojis[ticket.priority || 'normal'] || '📋';
  const sentimentEmoji = ticket.aiSentiment ? sentimentEmojis[ticket.aiSentiment] || '' : '';

  const message: SlackMessage = {
    text: `${emoji} New ${ticket.requestType.toUpperCase()} ticket #${ticket.id} assigned to ${ticket.assignee || 'unassigned'}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} New Ticket #${ticket.id}`,
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Type:*\n${ticket.requestType.toUpperCase()}`
          },
          {
            type: 'mrkdwn',
            text: `*Priority:*\n${ticket.priority?.toUpperCase() || 'NORMAL'}`
          },
          {
            type: 'mrkdwn',
            text: `*Customer:*\n${ticket.customerName || 'Unknown'}`
          },
          {
            type: 'mrkdwn',
            text: `*Assigned To:*\n${ticket.assignee || 'Unassigned'}`
          }
        ]
      }
    ]
  };

  // Add summary if available
  if (ticket.summary) {
    message.blocks!.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Summary:*\n${ticket.summary.substring(0, 200)}${ticket.summary.length > 200 ? '...' : ''}`
      }
    });
  }

  // Add sentiment if available
  if (ticket.aiSentiment) {
    message.blocks!.push({
      type: 'context',
      elements: [
        {
          type: 'plain_text',
          text: `${sentimentEmoji} Customer sentiment: ${ticket.aiSentiment}`,
          emoji: true
        }
      ]
    });
  }

  // Add action button
  message.blocks!.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'View Ticket',
          emoji: true
        },
        url: `${process.env.APP_URL}/tickets/${ticket.id}`,
        style: ticket.priority === 'urgent' ? 'danger' : 'primary'
      }
    ]
  });

  await notifySlackRichMessage(message);
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
  
  await notifySlack(text);
}

export async function notifySLABreach(
  ticketId: number,
  requestType: string,
  assignee: string | null,
  minutesOverdue: number
): Promise<void> {
  const message: SlackMessage = {
    text: `🚨 SLA BREACH: Ticket #${ticketId}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚨 SLA Breach Alert',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Ticket:*\n#${ticketId}`
          },
          {
            type: 'mrkdwn',
            text: `*Type:*\n${requestType.toUpperCase()}`
          },
          {
            type: 'mrkdwn',
            text: `*Assignee:*\n${assignee || 'Unassigned'}`
          },
          {
            type: 'mrkdwn',
            text: `*Overdue:*\n${Math.round(minutesOverdue)} minutes`
          }
        ]
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Handle Now',
              emoji: true
            },
            url: `${process.env.APP_URL}/tickets/${ticketId}`,
            style: 'danger'
          }
        ]
      }
    ]
  };

  await notifySlackRichMessage(message);
}