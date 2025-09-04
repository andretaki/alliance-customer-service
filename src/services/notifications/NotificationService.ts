import { sendEmail } from '@/lib/mailer';
import { ticketEmail, ticketEmailText } from '@/lib/templates/ticket-email';
import { notifyTicketCreated, notifyTicketRouted, notifySLABreach } from '@/lib/teams';
import { db } from '@/db';
import { tickets } from '@/db/ticketing';
import { eq } from 'drizzle-orm';
import { NOTIFICATION_EMAILS } from '@/config/test-data';

export interface NotificationOptions {
  sendEmail?: boolean;
  sendTeams?: boolean;
  emailRecipients?: string[];
}

export class NotificationService {
  private static instance: NotificationService;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async notifyTicketCreated(
    ticketId: number,
    options: NotificationOptions = { sendEmail: true, sendTeams: true }
  ): Promise<void> {
    try {
      // Get ticket data
      const [ticket] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .limit(1);

      if (!ticket) {
        throw new Error('Ticket not found');
      }

      // Send email notification
      if (options.sendEmail) {
        const recipients = options.emailRecipients || this.getRecipientsForTicket(ticket);
        
        if (recipients.length > 0) {
          // Convert nulls to undefined for email template
          const ticketData = {
            ...ticket,
            priority: ticket.priority || undefined,
            customerName: ticket.customerName || undefined,
            customerEmail: ticket.customerEmail || undefined,
            customerPhone: ticket.customerPhone || undefined,
            summary: ticket.summary || undefined,
            assignee: ticket.assignee || undefined,
            aiClassification: ticket.aiClassification || undefined,
            aiSentiment: ticket.aiSentiment || undefined,
            aiSentimentScore: ticket.aiSentimentScore || undefined,
          };
          const htmlContent = ticketEmail(ticketData);
          const textContent = ticketEmailText(ticketData);

          await sendEmail({
            to: recipients,
            subject: `New ${ticket.requestType.toUpperCase()} Ticket #${ticket.id} - ${ticket.priority?.toUpperCase() || 'NORMAL'} Priority`,
            html: htmlContent,
            text: textContent,
          });
        }
      }

      // Send Teams notification
      if (options.sendTeams) {
        await notifyTicketCreated({
          id: ticket.id,
          requestType: ticket.requestType,
          priority: ticket.priority || undefined,
          customerName: ticket.customerName || undefined,
          assignee: ticket.assignee || undefined,
          summary: ticket.summary || undefined,
          aiSentiment: ticket.aiSentiment || undefined,
        });
      }
    } catch (error) {
      console.error('Failed to send ticket creation notifications:', error);
      // Don't throw - notifications should not break the main flow
    }
  }

  async notifyTicketRouted(
    ticketId: number,
    newAssignee: string,
    previousAssignee: string | null = null,
    options: NotificationOptions = { sendEmail: true, sendTeams: true }
  ): Promise<void> {
    try {
      // Get ticket data
      const [ticket] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .limit(1);

      if (!ticket) {
        throw new Error('Ticket not found');
      }

      // Send email to new assignee
      if (options.sendEmail) {
        const assigneeEmail = this.getAssigneeEmail(newAssignee);
        
        if (assigneeEmail) {
          // Convert nulls to undefined for email template
          const ticketData = {
            ...ticket,
            priority: ticket.priority || undefined,
            customerName: ticket.customerName || undefined,
            customerEmail: ticket.customerEmail || undefined,
            customerPhone: ticket.customerPhone || undefined,
            summary: ticket.summary || undefined,
            assignee: ticket.assignee || undefined,
            aiClassification: ticket.aiClassification || undefined,
            aiSentiment: ticket.aiSentiment || undefined,
            aiSentimentScore: ticket.aiSentimentScore || undefined,
          };
          const htmlContent = ticketEmail(ticketData);
          const textContent = ticketEmailText(ticketData);

          await sendEmail({
            to: [assigneeEmail],
            subject: `Assigned: ${ticket.requestType.toUpperCase()} Ticket #${ticket.id}`,
            html: htmlContent,
            text: textContent,
          });
        }
      }

      // Send Teams notification
      if (options.sendTeams) {
        await notifyTicketRouted(
          ticket.id,
          ticket.requestType,
          previousAssignee,
          newAssignee
        );
      }
    } catch (error) {
      console.error('Failed to send routing notifications:', error);
    }
  }

  async notifySLABreach(
    ticketId: number,
    minutesOverdue: number,
    options: NotificationOptions = { sendEmail: false, sendTeams: true }
  ): Promise<void> {
    try {
      // Get ticket data
      const [ticket] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .limit(1);

      if (!ticket) {
        throw new Error('Ticket not found');
      }

      // Send Teams notification (email is handled by SLA job)
      if (options.sendTeams) {
        await notifySLABreach(
          ticket.id,
          ticket.requestType,
          ticket.assignee,
          minutesOverdue
        );
      }
    } catch (error) {
      console.error('Failed to send SLA breach notifications:', error);
    }
  }

  private getRecipientsForTicket(ticket: any): string[] {
    const recipients: string[] = [];

    // Use configured email addresses from test-data config
    const assigneeEmails = NOTIFICATION_EMAILS.assignees;

    if (ticket.assignee && assigneeEmails[ticket.assignee as keyof typeof assigneeEmails]) {
      recipients.push(assigneeEmails[ticket.assignee as keyof typeof assigneeEmails]);
    }

    // Add supervisor for urgent/high priority tickets
    if (ticket.priority === 'urgent' || ticket.priority === 'high') {
      recipients.push(NOTIFICATION_EMAILS.escalation.supervisor);
    }

    // Default to support if no recipients
    if (recipients.length === 0) {
      recipients.push(NOTIFICATION_EMAILS.defaultSupport);
    }

    return recipients;
  }

  private getAssigneeEmail(assignee: string): string | null {
    // Use configured email addresses from test-data config
    const assigneeEmails = NOTIFICATION_EMAILS.assignees;
    return assigneeEmails[assignee as keyof typeof assigneeEmails] || null;
  }
}

export const notificationService = NotificationService.getInstance();