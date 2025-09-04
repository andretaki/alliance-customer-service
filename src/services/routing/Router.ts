import { db } from '@/db';
import { routingRules, tickets, aiOperations } from '@/db/ticketing';
import { eq, and } from 'drizzle-orm';
import { aiService } from '@/services/ai/AIService';
import { RoutingSuggestion } from '@/services/ai/types';

export interface RoutingRule {
  predicate: Record<string, any>;
  assignees: string[];
  active: boolean;
  order: number;
}

export class Router {
  async evaluateRules(ticketData: {
    requestType: string;
    priority?: string;
    customerEmail?: string;
    data?: Record<string, any>;
    summary?: string;
    enableAI?: boolean;
  }): Promise<{ assignees: string[]; aiSuggestion?: RoutingSuggestion }> {
    try {
      let ruleBasedAssignees: string[] = [];
      let aiSuggestion: RoutingSuggestion | null = null;

      // Get active routing rules ordered by priority
      const rules = await db
        .select()
        .from(routingRules)
        .where(eq(routingRules.active, true))
        .orderBy(routingRules.order);

      for (const rule of rules) {
        const predicate = rule.predicate as Record<string, any>;
        
        if (this.matchesPredicate(ticketData, predicate)) {
          ruleBasedAssignees = rule.assignees as string[];
          break;
        }
      }

      // If no rules match, use defaults
      if (ruleBasedAssignees.length === 0) {
        ruleBasedAssignees = this.getDefaultAssignees(ticketData.requestType);
      }

      // Use AI for enhanced routing if enabled
      if (ticketData.enableAI && aiService.isConfigured()) {
        try {
          const startTime = Date.now();
          
          // Get historical assignments for similar tickets
          const historicalAssignments = await this.getHistoricalAssignments(ticketData.requestType);
          
          aiSuggestion = await aiService.analyzeRouting({
            requestType: ticketData.requestType,
            priority: ticketData.priority || 'normal',
            summary: ticketData.summary,
            customerEmail: ticketData.customerEmail,
            data: ticketData.data,
            historicalAssignments,
          });

          // Log AI operation
          await this.logAIOperation({
            operation: 'route',
            input: ticketData,
            output: aiSuggestion,
            success: true,
            responseTimeMs: Date.now() - startTime,
          });

          // If AI has high confidence, consider its suggestion
          if (aiSuggestion.confidence > 0.8 && aiSuggestion.suggestedAssignees.length > 0) {
            // Merge AI suggestions with rule-based assignees
            const mergedAssignees = this.mergeAssignees(
              ruleBasedAssignees,
              aiSuggestion.suggestedAssignees
            );
            return { assignees: mergedAssignees, aiSuggestion };
          }
        } catch (error) {
          console.error('AI routing failed:', error);
          await this.logAIOperation({
            operation: 'route',
            input: ticketData,
            success: false,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return { assignees: ruleBasedAssignees, aiSuggestion: aiSuggestion || undefined };
    } catch (error) {
      console.error('Failed to evaluate routing rules:', error);
      return { assignees: this.getDefaultAssignees(ticketData.requestType) };
    }
  }

  private mergeAssignees(ruleBasedAssignees: string[], aiAssignees: string[]): string[] {
    // AI primary suggestion takes precedence if it's a valid assignee
    const validAssignees = new Set([
      'sales-team', 'coa-team', 'logistics-team', 'customer-service',
      'Adnan', 'Lori'
    ]);

    const merged: string[] = [];
    
    // Add AI's primary suggestion if valid
    if (aiAssignees[0] && validAssignees.has(aiAssignees[0])) {
      merged.push(aiAssignees[0]);
    }
    
    // Add rule-based assignees that aren't already included
    for (const assignee of ruleBasedAssignees) {
      if (!merged.includes(assignee)) {
        merged.push(assignee);
      }
    }
    
    // Add remaining AI suggestions
    for (const assignee of aiAssignees.slice(1)) {
      if (validAssignees.has(assignee) && !merged.includes(assignee)) {
        merged.push(assignee);
      }
    }

    return merged.length > 0 ? merged : ['customer-service'];
  }

  private async getHistoricalAssignments(requestType: string): Promise<Array<{ requestType: string; assignee: string }>> {
    try {
      // Get recent similar tickets for pattern learning
      const recentTickets = await db
        .select({
          requestType: tickets.requestType,
          assignee: tickets.assignee,
        })
        .from(tickets)
        .where(and(
          eq(tickets.requestType, requestType),
          eq(tickets.status, 'resolved')
        ))
        .limit(10);

      return recentTickets
        .filter(t => t.assignee)
        .map(t => ({
          requestType: t.requestType,
          assignee: t.assignee!,
        }));
    } catch (error) {
      console.error('Failed to get historical assignments:', error);
      return [];
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
  }) {
    try {
      await db.insert(aiOperations).values({
        ticketId: null,
        operation: data.operation,
        provider: aiService.getProviderName() || 'unknown',
        model: aiService.getConfig()?.model || null,
        input: data.input,
        output: data.output || null,
        success: data.success,
        responseTimeMs: data.responseTimeMs || null,
        errorMessage: data.errorMessage || null,
        tokensUsed: null,
        costEstimate: null,
      });
    } catch (error) {
      console.error('Failed to log AI operation:', error);
    }
  }

  private matchesPredicate(
    ticketData: Record<string, any>,
    predicate: Record<string, any>
  ): boolean {
    for (const [key, value] of Object.entries(predicate)) {
      if (key.includes('.')) {
        // Handle nested properties like 'data.productFamily'
        const keys = key.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let currentValue: any = ticketData;
        
        for (const k of keys) {
          currentValue = currentValue?.[k];
          if (currentValue === undefined) return false;
        }
        
        if (Array.isArray(value)) {
          if (!value.includes(currentValue)) return false;
        } else if (currentValue !== value) {
          return false;
        }
      } else {
        // Handle top-level properties
        if (Array.isArray(value)) {
          if (!value.includes(ticketData[key])) return false;
        } else if (ticketData[key] !== value) {
          return false;
        }
      }
    }
    
    return true;
  }

  private getDefaultAssignees(requestType: string): string[] {
    const defaults: Record<string, string[]> = {
      quote: ['sales-team'],
      coa: ['coa-team'],
      freight: ['logistics-team'],
      claim: ['customer-service'],
      other: ['customer-service'],
    };
    
    return defaults[requestType] || ['customer-service'];
  }

  async assignTicket(ticketId: number, enableAI: boolean = false): Promise<string[]> {
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

      // Evaluate routing rules with AI enhancement
      const { assignees, aiSuggestion } = await this.evaluateRules({
        requestType: ticket.requestType,
        priority: ticket.priority || undefined,
        customerEmail: ticket.customerEmail || undefined,
        data: ticket.data as Record<string, any> || undefined,
        summary: ticket.summary || undefined,
        enableAI,
      });

      // Update ticket with assignees and AI suggestion
      if (assignees.length > 0) {
        await db
          .update(tickets)
          .set({
            assignee: assignees[0], // Primary assignee
            status: 'routed',
            aiRoutingSuggestion: aiSuggestion || null,
          })
          .where(eq(tickets.id, ticketId));

        // Log the routing suggestion if AI was used
        if (aiSuggestion) {
          await this.logAIOperation({
            operation: 'route_assign',
            input: { ticketId, assignees, aiSuggestion },
            output: { primaryAssignee: assignees[0] },
            success: true,
          });
        }
      }

      return assignees;
    } catch (error) {
      console.error('Failed to assign ticket:', error);
      throw new Error(`Failed to assign ticket: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createRule(rule: RoutingRule): Promise<void> {
    await db
      .insert(routingRules)
      .values({
        predicate: rule.predicate,
        assignees: rule.assignees,
        active: rule.active,
        order: rule.order,
      });
  }

  async updateRule(id: number, updates: Partial<RoutingRule>): Promise<void> {
    await db
      .update(routingRules)
      .set(updates)
      .where(eq(routingRules.id, id));
  }

  async getRules(): Promise<any[]> {
    return await db
      .select()
      .from(routingRules)
      .orderBy(routingRules.order);
  }
}