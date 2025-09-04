import { db } from '@/db';
import { tickets, ticketActions, attachments, aiOperations } from '@/db/ticketing';
import { eq, and, isNull } from 'drizzle-orm';
import { aiService } from '@/services/ai/AIService';
import { ExtractedEntities, TicketClassification, SentimentAnalysis } from '@/services/ai/types';
// import { coaService } from '@/services/coa/COAService'; // TODO: Implement COA service
import { notificationService } from '@/services/notifications/NotificationService';

export type RequestType = 'quote' | 'coa' | 'freight' | 'claim' | 'other';
export type TicketStatus = 'open' | 'routed' | 'in_progress' | 'resolved' | 'closed';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';

export interface CreateTicketData {
  callId?: string;
  requestType?: RequestType;  // Made optional for AI classification
  priority?: Priority;
  summary?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
  data?: Record<string, any>;
  assignee?: string;
  enableAI?: boolean;  // Enable AI enhancements
  transcriptText?: string;  // For AI classification from call transcripts
}

export interface AddActionData {
  ticketId: number;
  actionType: string;
  externalId?: string;
  payload?: Record<string, any>;
}

export interface AddAttachmentData {
  ticketId: number;
  type: 'coa' | 'photo' | 'pdf';
  url: string;
  meta?: Record<string, any>;
}

export class TicketService {
  async createTicket(data: CreateTicketData) {
    try {
      let requestType = data.requestType || 'other';
      let priority = data.priority || 'normal';
      let aiClassification: TicketClassification | null = null;
      let aiSentiment: SentimentAnalysis | null = null;
      let aiEntities: ExtractedEntities | null = null;

      // Use AI if enabled and service is configured
      if (data.enableAI && aiService.isConfigured()) {
        const startTime = Date.now();
        
        // AI Classification
        if (!data.requestType) {
          try {
            aiClassification = await aiService.classifyTicket({
              summary: data.summary,
              customerMessage: data.summary,
              transcriptText: data.transcriptText,
            });
            
            requestType = aiClassification.requestType;
            priority = data.priority || aiClassification.priority;

            // Log AI operation
            await this.logAIOperation({
              operation: 'classify',
              input: { summary: data.summary, transcriptText: data.transcriptText },
              output: aiClassification,
              success: true,
              responseTimeMs: Date.now() - startTime,
            });
          } catch (error) {
            console.error('AI classification failed:', error);
            await this.logAIOperation({
              operation: 'classify',
              input: { summary: data.summary },
              success: false,
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
              responseTimeMs: Date.now() - startTime,
            });
          }
        }

        // Sentiment Analysis
        if (data.summary || data.transcriptText) {
          try {
            const sentimentStart = Date.now();
            aiSentiment = await aiService.analyzeSentiment(
              data.summary || data.transcriptText || ''
            );
            
            await this.logAIOperation({
              operation: 'sentiment',
              input: { text: data.summary || data.transcriptText },
              output: aiSentiment,
              success: true,
              responseTimeMs: Date.now() - sentimentStart,
            });
          } catch (error) {
            console.error('AI sentiment analysis failed:', error);
          }
        }

        // Entity Extraction
        if (data.summary || data.transcriptText) {
          try {
            const entityStart = Date.now();
            aiEntities = await aiService.extractEntities(
              data.summary || data.transcriptText || ''
            );

            // Update customer data with extracted entities
            if (aiEntities.customerName && !data.customerName) {
              data.customerName = aiEntities.customerName;
            }
            if (aiEntities.emails?.[0] && !data.customerEmail) {
              data.customerEmail = aiEntities.emails[0];
            }
            if (aiEntities.phoneNumbers?.[0] && !data.customerPhone) {
              data.customerPhone = aiEntities.phoneNumbers[0];
            }

            await this.logAIOperation({
              operation: 'extract',
              input: { text: data.summary || data.transcriptText },
              output: aiEntities,
              success: true,
              responseTimeMs: Date.now() - entityStart,
            });
          } catch (error) {
            console.error('AI entity extraction failed:', error);
          }
        }
      }

      const [ticket] = await db
        .insert(tickets)
        .values({
          callId: data.callId,
          requestType: requestType,
          priority: priority,
          summary: data.summary,
          customerEmail: data.customerEmail,
          customerPhone: data.customerPhone,
          customerName: data.customerName,
          data: data.data,
          assignee: data.assignee,
          status: 'open',
          // AI fields
          aiClassification: aiClassification,
          aiRoutingSuggestion: null, // Will be populated by Router
          aiSentiment: aiSentiment?.sentiment,
          aiSentimentScore: aiSentiment ? Math.round(aiSentiment.score * 100) : null,
          aiExtractedEntities: aiEntities,
          aiConfidence: aiClassification ? Math.round(aiClassification.confidence * 100) : null,
        })
        .returning();

      // Process COA requests automatically
      // TODO: Implement COA service
      /*
      if (ticket.requestType === 'coa' && coaService.isAvailable()) {
        const coaResult = await coaService.processCOARequest(
          ticket.id,
          ticket.summary || data.transcriptText || ''
        );

        if (coaResult.found) {
          // COA was found and auto-attached
          await this.addAction({
            ticketId: ticket.id,
            actionType: 'coa_auto_attached',
            payload: {
              url: coaResult.url,
              searchParams: coaResult.searchParams,
              message: 'COA automatically found and attached'
            }
          });

          // Send notification with COA attached
          await notificationService.notifyTicketCreated(ticket.id, {
            sendEmail: true,
            sendTeams: true,
          });

          // Auto-resolve the ticket if COA was found
          await this.updateTicket(ticket.id, {
            status: 'resolved',
            data: {
              ...ticket.data,
              coaAutoAttached: true,
              coaUrl: coaResult.url,
            }
          });
        } else {
          // COA not found, route to COA team
          await this.addAction({
            ticketId: ticket.id,
            actionType: 'coa_not_found',
            payload: {
              searchParams: coaResult.searchParams,
              message: 'COA not found automatically, routing to COA team'
            }
          });
        }
      }
      */

      return ticket;
    } catch (error) {
      console.error('Failed to create ticket:', error);
      throw new Error(`Failed to create ticket: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async logAIOperation(data: {
    operation: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    input: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    output?: any;
    success: boolean;
    responseTimeMs?: number;
    errorMessage?: string;
    ticketId?: number;
  }) {
    try {
      await db.insert(aiOperations).values({
        ticketId: data.ticketId || null,
        operation: data.operation,
        provider: aiService.getProviderName() || 'unknown',
        model: aiService.getConfig()?.model || null,
        input: data.input,
        output: data.output || null,
        success: data.success,
        responseTimeMs: data.responseTimeMs || null,
        errorMessage: data.errorMessage || null,
        tokensUsed: null, // Could be enhanced to track token usage
        costEstimate: null, // Could be enhanced to estimate costs
      });
    } catch (error) {
      console.error('Failed to log AI operation:', error);
    }
  }

  async updateTicket(id: number, updates: Partial<CreateTicketData> & { status?: TicketStatus }) {
    try {
      const [updated] = await db
        .update(tickets)
        .set({
          ...updates,
          // Set first response time if transitioning from open
          firstResponseAt: updates.status === 'in_progress' ? new Date() : undefined,
          // Set resolved time if resolving
          resolvedAt: updates.status === 'resolved' ? new Date() : undefined,
        })
        .where(eq(tickets.id, id))
        .returning();

      return updated;
    } catch (error) {
      console.error('Failed to update ticket:', error);
      throw new Error(`Failed to update ticket: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getTicket(id: number) {
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, id))
      .limit(1);

    if (!ticket) {
      return null;
    }

    // Get actions
    const actions = await db
      .select()
      .from(ticketActions)
      .where(eq(ticketActions.ticketId, id))
      .orderBy(ticketActions.createdAt);

    // Get attachments
    const ticketAttachments = await db
      .select()
      .from(attachments)
      .where(eq(attachments.ticketId, id))
      .orderBy(attachments.createdAt);

    return {
      ...ticket,
      actions,
      attachments: ticketAttachments,
    };
  }

  async getTicketsByStatus(status: TicketStatus) {
    return await db
      .select()
      .from(tickets)
      .where(eq(tickets.status, status))
      .orderBy(tickets.createdAt);
  }

  async getUnassignedTickets() {
    return await db
      .select()
      .from(tickets)
      .where(and(
        eq(tickets.status, 'open'),
        isNull(tickets.assignee)
      ))
      .orderBy(tickets.createdAt);
  }

  async addAction(data: AddActionData) {
    try {
      const [action] = await db
        .insert(ticketActions)
        .values({
          ticketId: data.ticketId,
          actionType: data.actionType,
          externalId: data.externalId,
          payload: data.payload,
        })
        .returning();

      return action;
    } catch (error) {
      console.error('Failed to add action:', error);
      throw new Error(`Failed to add action: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async addAttachment(data: AddAttachmentData) {
    try {
      const [attachment] = await db
        .insert(attachments)
        .values({
          ticketId: data.ticketId,
          type: data.type,
          url: data.url,
          meta: data.meta,
        })
        .returning();

      return attachment;
    } catch (error) {
      console.error('Failed to add attachment:', error);
      throw new Error(`Failed to add attachment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async checkSLABreach(ticketId: number) {
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticket) return false;

    // Simple SLA rules (customize as needed)
    const slaMinutes = {
      urgent: 30,
      high: 60,
      normal: 240,
      low: 480,
    };

    const priority = ticket.priority || 'normal';
    const maxResponseTime = slaMinutes[priority as Priority];
    const createdAt = new Date(ticket.createdAt!);
    const now = new Date();
    const minutesElapsed = (now.getTime() - createdAt.getTime()) / (1000 * 60);

    if (minutesElapsed > maxResponseTime && !ticket.firstResponseAt) {
      // Mark as breached
      await db
        .update(tickets)
        .set({ breached: true })
        .where(eq(tickets.id, ticketId));
      
      return true;
    }

    return false;
  }
}