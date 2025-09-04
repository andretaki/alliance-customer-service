import { db } from "@/db";
import { tickets } from "@/db/ticketing";
import { SLA_MINUTES, ESCALATION_THRESHOLDS, ESCALATION_RECIPIENTS } from "@/config/sla";
import { eq, and, isNull, ne } from "drizzle-orm";
import { sendEmail } from "@/lib/mailer";

interface SLACheckResult {
  ticketsChecked: number;
  breachesDetected: number;
  warningsSent: number;
  errors: string[];
}

export async function runSlaCheck(now = new Date()): Promise<SLACheckResult> {
  const result: SLACheckResult = {
    ticketsChecked: 0,
    breachesDetected: 0,
    warningsSent: 0,
    errors: []
  };

  try {
    // Get all open/routed/in_progress tickets that don't have a first response
    const openTickets = await db
      .select()
      .from(tickets)
      .where(
        and(
          isNull(tickets.firstResponseAt),
          ne(tickets.status, 'resolved'),
          ne(tickets.status, 'closed')
        )
      );

    for (const ticket of openTickets) {
      result.ticketsChecked++;
      
      const requestType = ticket.requestType || 'other';
      const slaMinutes = SLA_MINUTES[requestType] ?? SLA_MINUTES.other;
      const ticketAge = (now.getTime() - new Date(ticket.createdAt).getTime()) / 60000; // age in minutes
      const slaPercentage = ticketAge / slaMinutes;

      // Check for breach (100% of SLA)
      if (slaPercentage >= ESCALATION_THRESHOLDS.breach && !ticket.breached) {
        result.breachesDetected++;
        
        // Mark ticket as breached
        await db
          .update(tickets)
          .set({ breached: true })
          .where(eq(tickets.id, ticket.id));

        // Send breach notification
        try {
          await sendEmail({
            to: ESCALATION_RECIPIENTS.breach,
            subject: `🚨 SLA BREACH: ${requestType.toUpperCase()} Ticket #${ticket.id}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #dc3545; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                  <h2 style="margin: 0;">SLA Breach Alert</h2>
                </div>
                <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0;"><strong>Ticket ID:</strong></td>
                      <td style="padding: 8px 0;">#${ticket.id}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0;"><strong>Request Type:</strong></td>
                      <td style="padding: 8px 0;">${requestType.toUpperCase()}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0;"><strong>Customer:</strong></td>
                      <td style="padding: 8px 0;">${ticket.customerName || 'Unknown'} (${ticket.customerEmail || 'No email'})</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0;"><strong>Assignee:</strong></td>
                      <td style="padding: 8px 0;">${ticket.assignee || 'Unassigned'}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0;"><strong>SLA Target:</strong></td>
                      <td style="padding: 8px 0;">${slaMinutes} minutes</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0;"><strong>Time Elapsed:</strong></td>
                      <td style="padding: 8px 0;">${Math.round(ticketAge)} minutes (${Math.round(slaPercentage * 100)}% of SLA)</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0;"><strong>Summary:</strong></td>
                      <td style="padding: 8px 0;">${ticket.summary || 'No summary available'}</td>
                    </tr>
                  </table>
                  <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6;">
                    <a href="${process.env.APP_URL}/tickets/${ticket.id}" style="display: inline-block; padding: 10px 20px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 4px;">View Ticket</a>
                  </div>
                </div>
              </div>
            `,
            text: `SLA BREACH Alert: Ticket #${ticket.id} (${requestType}) has breached its SLA of ${slaMinutes} minutes. Time elapsed: ${Math.round(ticketAge)} minutes. Assignee: ${ticket.assignee || 'Unassigned'}.`
          });
        } catch (emailError) {
          result.errors.push(`Failed to send breach email for ticket #${ticket.id}: ${emailError}`);
        }
      }
      // Check for urgent warning (90% of SLA)
      else if (slaPercentage >= ESCALATION_THRESHOLDS.urgent && slaPercentage < ESCALATION_THRESHOLDS.breach) {
        // Only send urgent warning once per ticket (track in data field)
        const ticketData = ticket.data as any || {};
        if (!ticketData.urgentWarningSent) {
          result.warningsSent++;
          
          // Update ticket data to mark warning as sent
          await db
            .update(tickets)
            .set({ 
              data: { 
                ...ticketData, 
                urgentWarningSent: true,
                urgentWarningSentAt: now.toISOString()
              } 
            })
            .where(eq(tickets.id, ticket.id));

          // Send urgent warning
          try {
            await sendEmail({
              to: ESCALATION_RECIPIENTS.urgent,
              subject: `⚠️ SLA URGENT: ${requestType.toUpperCase()} Ticket #${ticket.id} at ${Math.round(slaPercentage * 100)}%`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background-color: #fd7e14; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h2 style="margin: 0;">Urgent SLA Warning</h2>
                  </div>
                  <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
                    <p><strong>Ticket #${ticket.id}</strong> is at risk of breaching SLA!</p>
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0;"><strong>Request Type:</strong></td>
                        <td style="padding: 8px 0;">${requestType.toUpperCase()}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;"><strong>Time Remaining:</strong></td>
                        <td style="padding: 8px 0;">${Math.round(slaMinutes - ticketAge)} minutes</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;"><strong>Assignee:</strong></td>
                        <td style="padding: 8px 0;">${ticket.assignee || 'Unassigned'}</td>
                      </tr>
                    </table>
                    <div style="margin-top: 20px;">
                      <a href="${process.env.APP_URL}/tickets/${ticket.id}" style="display: inline-block; padding: 10px 20px; background-color: #fd7e14; color: white; text-decoration: none; border-radius: 4px;">Take Action Now</a>
                    </div>
                  </div>
                </div>
              `,
              text: `URGENT: Ticket #${ticket.id} (${requestType}) is at ${Math.round(slaPercentage * 100)}% of SLA. Time remaining: ${Math.round(slaMinutes - ticketAge)} minutes.`
            });
          } catch (emailError) {
            result.errors.push(`Failed to send urgent warning for ticket #${ticket.id}: ${emailError}`);
          }
        }
      }
      // Check for initial warning (75% of SLA)
      else if (slaPercentage >= ESCALATION_THRESHOLDS.warning && slaPercentage < ESCALATION_THRESHOLDS.urgent) {
        const ticketData = ticket.data as any || {};
        if (!ticketData.warningSent) {
          result.warningsSent++;
          
          // Update ticket data to mark warning as sent
          await db
            .update(tickets)
            .set({ 
              data: { 
                ...ticketData, 
                warningSent: true,
                warningSentAt: now.toISOString()
              } 
            })
            .where(eq(tickets.id, ticket.id));

          // Send warning
          try {
            await sendEmail({
              to: ESCALATION_RECIPIENTS.warning,
              subject: `SLA Warning: ${requestType.toUpperCase()} Ticket #${ticket.id} at ${Math.round(slaPercentage * 100)}%`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background-color: #ffc107; color: #212529; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h2 style="margin: 0;">SLA Warning</h2>
                  </div>
                  <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
                    <p>Ticket #${ticket.id} is approaching its SLA limit.</p>
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0;"><strong>Progress:</strong></td>
                        <td style="padding: 8px 0;">${Math.round(slaPercentage * 100)}% of SLA</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;"><strong>Time Remaining:</strong></td>
                        <td style="padding: 8px 0;">${Math.round(slaMinutes - ticketAge)} minutes</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;"><strong>Assignee:</strong></td>
                        <td style="padding: 8px 0;">${ticket.assignee || 'Unassigned'}</td>
                      </tr>
                    </table>
                    <div style="margin-top: 20px;">
                      <a href="${process.env.APP_URL}/tickets/${ticket.id}" style="display: inline-block; padding: 10px 20px; background-color: #ffc107; color: #212529; text-decoration: none; border-radius: 4px;">Review Ticket</a>
                    </div>
                  </div>
                </div>
              `,
              text: `SLA Warning: Ticket #${ticket.id} (${requestType}) is at ${Math.round(slaPercentage * 100)}% of SLA. Time remaining: ${Math.round(slaMinutes - ticketAge)} minutes.`
            });
          } catch (emailError) {
            result.errors.push(`Failed to send warning for ticket #${ticket.id}: ${emailError}`);
          }
        }
      }
    }

    console.log(`SLA Check completed: ${result.ticketsChecked} tickets checked, ${result.breachesDetected} breaches detected, ${result.warningsSent} warnings sent`);
    
  } catch (error) {
    console.error('SLA check failed:', error);
    result.errors.push(`General error: ${error}`);
  }

  return result;
}