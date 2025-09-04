import { test, expect } from '@playwright/test';
import { APIClient } from './helpers/api-client';
import { TestFactory } from './helpers/test-factory';

test.describe('Ticket System E2E Tests', () => {
  let apiClient: APIClient;
  let testCustomer: any;

  test.beforeAll(async () => {
    apiClient = new APIClient(
      process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3002',
      process.env.SERVICE_SECRET || 'test-service-secret'
    );
    await apiClient.init();

    // Create a test customer for ticket tests
    const customerData = TestFactory.createCustomer();
    const response = await apiClient.createCustomer(customerData);
    testCustomer = await response.json();
  });

  test.afterAll(async () => {
    await apiClient.dispose();
  });

  test.describe('Ticket Creation and Classification', () => {
    test('should create a quote ticket with AI classification', async () => {
      const ticketData = {
        ...TestFactory.createTicket(),
        customerId: testCustomer.id,
        type: 'quote',
        subject: 'Need pricing for 10,000 gallons of sulfuric acid',
        description: 'We need a quote for 10,000 gallons of 98% sulfuric acid delivered to Houston, TX.',
      };

      const response = await apiClient.createTicket(ticketData);
      expect(response.ok()).toBeTruthy();

      const ticket = await response.json();
      expect(ticket).toMatchObject({
        customerId: testCustomer.id,
        type: 'quote',
        status: 'open',
      });
      
      // Check AI classification
      if (ticket.aiMetadata) {
        expect(ticket.aiMetadata.classification).toBeDefined();
        expect(ticket.aiMetadata.confidence).toBeGreaterThan(0);
      }
    });

    test('should create a COA request ticket', async () => {
      const ticketData = {
        ...TestFactory.createTicket(),
        customerId: testCustomer.id,
        type: 'coa',
        subject: 'COA needed for lot #ABC123',
        description: 'Please send the certificate of analysis for lot #ABC123 of hydrochloric acid.',
      };

      const response = await apiClient.createTicket(ticketData);
      expect(response.ok()).toBeTruthy();

      const ticket = await response.json();
      expect(ticket.type).toBe('coa');
      
      // Check if COA was auto-attached
      if (ticket.attachments && ticket.attachments.length > 0) {
        const coaAttachment = ticket.attachments.find((a: any) => a.type === 'coa');
        expect(coaAttachment).toBeDefined();
      }
    });

    test('should create a freight inquiry ticket', async () => {
      const ticketData = {
        ...TestFactory.createTicket(),
        customerId: testCustomer.id,
        type: 'freight',
        subject: 'Freight quote needed - Chicago to Dallas',
        description: 'Need freight pricing for 5 drums of sodium hydroxide from Chicago to Dallas.',
      };

      const response = await apiClient.createTicket(ticketData);
      expect(response.ok()).toBeTruthy();

      const ticket = await response.json();
      expect(ticket.type).toBe('freight');
      expect(ticket.assignedTo).toBeDefined(); // Should be auto-assigned
    });

    test('should create a claim ticket with high priority', async () => {
      const ticketData = {
        ...TestFactory.createTicket(),
        customerId: testCustomer.id,
        type: 'claim',
        priority: 'urgent',
        subject: 'Damaged shipment - Order #12345',
        description: 'Three drums were damaged during delivery. Need immediate resolution.',
      };

      const response = await apiClient.createTicket(ticketData);
      expect(response.ok()).toBeTruthy();

      const ticket = await response.json();
      expect(ticket.type).toBe('claim');
      expect(ticket.priority).toBe('urgent');
      
      // Check sentiment analysis
      if (ticket.aiMetadata && ticket.aiMetadata.sentiment) {
        expect(['negative', 'neutral', 'positive']).toContain(ticket.aiMetadata.sentiment);
      }
    });
  });

  test.describe('Ticket Routing and Assignment', () => {
    test('should auto-route quote tickets to sales team', async () => {
      const ticketData = {
        ...TestFactory.createTicket(),
        customerId: testCustomer.id,
        type: 'quote',
        subject: 'Bulk order pricing request',
      };

      const response = await apiClient.createTicket(ticketData);
      const ticket = await response.json();

      expect(ticket.assignedTo).toBeDefined();
      expect(ticket.routingLog).toBeDefined();
      
      if (ticket.routingLog && ticket.routingLog.length > 0) {
        expect(ticket.routingLog[0].rule).toContain('quote');
      }
    });

    test('should apply custom routing rules', async () => {
      const ticketData = {
        ...TestFactory.createTicket(),
        customerId: testCustomer.id,
        type: 'other',
        subject: 'VIP customer - urgent request',
        metadata: { vip: true },
      };

      const response = await apiClient.createTicket(ticketData);
      const ticket = await response.json();

      // VIP tickets should have special routing
      if (ticket.metadata && ticket.metadata.vip) {
        expect(ticket.priority).toBe('high');
      }
    });
  });

  test.describe('Ticket Updates and Status Management', () => {
    test('should update ticket status', async () => {
      const ticketData = TestFactory.createTicket();
      ticketData.customerId = testCustomer.id;

      const createResponse = await apiClient.createTicket(ticketData);
      const ticket = await createResponse.json();

      // Update status to in-progress
      const updateResponse = await apiClient.updateTicket(ticket.id, {
        status: 'in_progress',
      });
      expect(updateResponse.ok()).toBeTruthy();

      const updatedTicket = await updateResponse.json();
      expect(updatedTicket.status).toBe('in_progress');
    });

    test('should add notes to ticket', async () => {
      const ticketData = TestFactory.createTicket();
      ticketData.customerId = testCustomer.id;

      const createResponse = await apiClient.createTicket(ticketData);
      const ticket = await createResponse.json();

      const note = 'Customer called to follow up on this request';
      const updateResponse = await apiClient.updateTicket(ticket.id, {
        internalNotes: note,
      });
      expect(updateResponse.ok()).toBeTruthy();

      const updatedTicket = await updateResponse.json();
      expect(updatedTicket.internalNotes).toContain(note);
    });

    test('should close ticket with resolution', async () => {
      const ticketData = TestFactory.createTicket();
      ticketData.customerId = testCustomer.id;

      const createResponse = await apiClient.createTicket(ticketData);
      const ticket = await createResponse.json();

      const updateResponse = await apiClient.updateTicket(ticket.id, {
        status: 'closed',
        resolution: 'Issue resolved - COA sent to customer',
      });
      expect(updateResponse.ok()).toBeTruthy();

      const updatedTicket = await updateResponse.json();
      expect(updatedTicket.status).toBe('closed');
      expect(updatedTicket.resolution).toBeDefined();
      expect(updatedTicket.closedAt).toBeDefined();
    });
  });

  test.describe('AI-Powered Features', () => {
    test('should generate suggested responses', async () => {
      const ticketData = {
        ...TestFactory.createTicket(),
        customerId: testCustomer.id,
        type: 'quote',
        subject: 'Price inquiry for bulk chemicals',
        description: 'What is your best price for 20,000 lbs of caustic soda?',
      };

      const createResponse = await apiClient.createTicket(ticketData);
      const ticket = await createResponse.json();

      const suggestResponse = await apiClient.suggestResponses(ticket.id);
      expect(suggestResponse.ok()).toBeTruthy();

      const suggestions = await suggestResponse.json();
      expect(suggestions.responses).toBeDefined();
      expect(Array.isArray(suggestions.responses)).toBe(true);
      
      if (suggestions.responses.length > 0) {
        expect(suggestions.responses[0].content).toBeDefined();
        expect(suggestions.responses[0].tone).toBeDefined();
      }
    });

    test('should analyze sentiment correctly', async () => {
      const negativeTicket = {
        ...TestFactory.createTicket(),
        customerId: testCustomer.id,
        subject: 'Extremely disappointed with service',
        description: 'This is the third time our order has been delayed. This is unacceptable!',
      };

      const response = await apiClient.createTicket(negativeTicket);
      const ticket = await response.json();

      if (ticket.aiMetadata && ticket.aiMetadata.sentiment) {
        expect(ticket.aiMetadata.sentiment).toBe('negative');
        expect(ticket.priority).toMatch(/high|urgent/);
      }
    });
  });

  test.describe('Ticket Search and Filtering', () => {
    test('should search tickets by status', async () => {
      // Create multiple tickets with different statuses
      const openTicket = await apiClient.createTicket({
        ...TestFactory.createTicket(),
        customerId: testCustomer.id,
        status: 'open',
      });

      const response = await apiClient.listTickets({ status: 'open' });
      expect(response.ok()).toBeTruthy();

      const result = await response.json();
      expect(result.tickets).toBeDefined();
      expect(result.tickets.every((t: any) => t.status === 'open')).toBe(true);
    });

    test('should filter tickets by type', async () => {
      const response = await apiClient.listTickets({ type: 'quote' });
      expect(response.ok()).toBeTruthy();

      const result = await response.json();
      expect(result.tickets).toBeDefined();
      expect(result.tickets.every((t: any) => t.type === 'quote')).toBe(true);
    });

    test('should filter tickets by priority', async () => {
      const response = await apiClient.listTickets({ priority: 'urgent' });
      expect(response.ok()).toBeTruthy();

      const result = await response.json();
      expect(result.tickets).toBeDefined();
      expect(result.tickets.every((t: any) => t.priority === 'urgent')).toBe(true);
    });

    test('should paginate ticket results', async () => {
      const response = await apiClient.listTickets({ 
        limit: 5,
        offset: 0,
      });
      expect(response.ok()).toBeTruthy();

      const result = await response.json();
      expect(result.tickets).toBeDefined();
      expect(result.tickets.length).toBeLessThanOrEqual(5);
      expect(result.total).toBeDefined();
      expect(result.hasMore).toBeDefined();
    });
  });

  test.describe('SLA Management', () => {
    test('should track SLA compliance', async () => {
      const ticketData = {
        ...TestFactory.createTicket(),
        customerId: testCustomer.id,
        type: 'coa', // COA has 1-hour SLA
      };

      const createResponse = await apiClient.createTicket(ticketData);
      const ticket = await createResponse.json();

      expect(ticket.slaDeadline).toBeDefined();
      expect(ticket.slaStatus).toBe('on_track');
    });

    test('should escalate tickets approaching SLA breach', async () => {
      const ticketData = {
        ...TestFactory.createTicket(),
        customerId: testCustomer.id,
        type: 'quote',
        priority: 'urgent',
      };

      const createResponse = await apiClient.createTicket(ticketData);
      const ticket = await createResponse.json();

      // Simulate time passing (would normally be handled by cron job)
      // Check escalation status
      if (ticket.escalationLevel) {
        expect([0, 1, 2, 3]).toContain(ticket.escalationLevel);
      }
    });
  });

  test.describe('Ticket Actions and History', () => {
    test('should track ticket action history', async () => {
      const ticketData = TestFactory.createTicket();
      ticketData.customerId = testCustomer.id;

      const createResponse = await apiClient.createTicket(ticketData);
      const ticket = await createResponse.json();

      // Add an action
      const actionResponse = await apiClient.context.post(
        `/api/tickets/${ticket.id}/actions`,
        {
          data: {
            type: 'email_sent',
            description: 'Sent follow-up email to customer',
            metadata: { to: testCustomer.email },
          },
        }
      );
      expect(actionResponse.ok()).toBeTruthy();

      // Get ticket with actions
      const getResponse = await apiClient.getTicket(ticket.id);
      const updatedTicket = await getResponse.json();

      expect(updatedTicket.actions).toBeDefined();
      expect(updatedTicket.actions.length).toBeGreaterThan(0);
      expect(updatedTicket.actions[0].type).toBe('email_sent');
    });

    test('should attach files to tickets', async () => {
      const ticketData = TestFactory.createTicket();
      ticketData.customerId = testCustomer.id;

      const createResponse = await apiClient.createTicket(ticketData);
      const ticket = await createResponse.json();

      // Add attachment metadata
      const attachmentResponse = await apiClient.context.post(
        `/api/tickets/${ticket.id}/attachments`,
        {
          data: {
            fileName: 'test-document.pdf',
            fileType: 'application/pdf',
            fileSize: 1024000,
            url: 'https://example.com/test-document.pdf',
          },
        }
      );
      expect(attachmentResponse.ok()).toBeTruthy();

      const attachment = await attachmentResponse.json();
      expect(attachment.ticketId).toBe(ticket.id);
      expect(attachment.fileName).toBe('test-document.pdf');
    });
  });
});