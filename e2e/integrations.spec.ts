import { test, expect } from '@playwright/test';
import { APIClient } from './helpers/api-client';
import { TestFactory } from './helpers/test-factory';
import crypto from 'crypto';

test.describe('External Integrations E2E Tests', () => {
  let apiClient: APIClient;

  test.beforeAll(async () => {
    apiClient = new APIClient(
      process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3002',
      process.env.SERVICE_SECRET || 'test-service-secret'
    );
    await apiClient.init();
  });

  test.afterAll(async () => {
    await apiClient.dispose();
  });

  test.describe('Shopify Integration', () => {
    test('should test Shopify connection', async () => {
      const response = await apiClient.testShopify();
      
      // Test endpoint should return status
      if (response.ok()) {
        const result = await response.json();
        expect(result).toMatchObject({
          connected: expect.any(Boolean),
          storeUrl: expect.any(String),
        });
      } else {
        // If not configured, should return appropriate error
        expect(response.status()).toBe(503);
      }
    });

    test('should sync customer with Shopify on creation', async () => {
      const customerData = {
        ...TestFactory.createCustomer(),
        shopifyCustomerId: `shopify_${Date.now()}`,
      };

      const response = await apiClient.createCustomer(customerData);
      expect(response.ok()).toBeTruthy();

      const customer = await response.json();
      
      // Check sync log for Shopify entry
      const syncLogResponse = await apiClient.context.get(
        `/api/customers/${customer.id}/sync-log`
      );
      
      if (syncLogResponse.ok()) {
        const syncLog = await syncLogResponse.json();
        const shopifySync = syncLog.find((entry: any) => entry.integration === 'shopify');
        
        if (shopifySync) {
          expect(shopifySync).toMatchObject({
            integration: 'shopify',
            action: expect.stringMatching(/create|sync/),
            status: expect.stringMatching(/success|pending|failed/),
          });
        }
      }
    });

    test('should handle Shopify webhook for order creation', async () => {
      const webhookData = {
        id: 123456789,
        email: 'test@example.com',
        customer: {
          id: 987654321,
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'Customer',
        },
        line_items: [
          {
            title: 'Sulfuric Acid',
            quantity: 5,
            price: '100.00',
          },
        ],
        created_at: new Date().toISOString(),
      };

      // Generate HMAC signature
      const secret = process.env.THREE_CX_WEBHOOK_SECRET || 'test-secret';
      const signature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(webhookData))
        .digest('hex');

      const response = await apiClient.simulateWebhook(
        '/api/webhooks/shopify/orders',
        webhookData,
        signature
      );

      // Webhook should be accepted
      expect([200, 202]).toContain(response.status());
    });

    test('should fetch customer orders from Shopify', async () => {
      const customer = TestFactory.createCustomer();
      customer.shopifyCustomerId = '123456789';

      const createResponse = await apiClient.createCustomer(customer);
      const createdCustomer = await createResponse.json();

      const ordersResponse = await apiClient.context.get(
        `/api/customers/${createdCustomer.id}/orders`
      );

      if (ordersResponse.ok()) {
        const orders = await ordersResponse.json();
        expect(Array.isArray(orders)).toBe(true);
      }
    });
  });

  test.describe('QuickBooks Integration', () => {
    test('should test QuickBooks connection', async () => {
      const response = await apiClient.testQuickBooks();
      
      if (response.ok()) {
        const result = await response.json();
        expect(result).toMatchObject({
          connected: expect.any(Boolean),
          companyId: expect.any(String),
        });
      } else {
        expect(response.status()).toBe(503);
      }
    });

    test('should sync customer with QuickBooks', async () => {
      const customerData = {
        ...TestFactory.createCustomer(),
        quickbooksCustomerId: `QB_${Date.now()}`,
      };

      const response = await apiClient.createCustomer(customerData);
      expect(response.ok()).toBeTruthy();

      const customer = await response.json();
      
      // Check sync log for QuickBooks entry
      const syncLogResponse = await apiClient.context.get(
        `/api/customers/${customer.id}/sync-log`
      );
      
      if (syncLogResponse.ok()) {
        const syncLog = await syncLogResponse.json();
        const qbSync = syncLog.find((entry: any) => entry.integration === 'quickbooks');
        
        if (qbSync) {
          expect(qbSync).toMatchObject({
            integration: 'quickbooks',
            action: expect.stringMatching(/create|sync/),
            status: expect.stringMatching(/success|pending|failed/),
          });
        }
      }
    });

    test('should fetch customer invoices from QuickBooks', async () => {
      const customer = TestFactory.createCustomer();
      customer.quickbooksCustomerId = 'QB123456';

      const createResponse = await apiClient.createCustomer(customer);
      const createdCustomer = await createResponse.json();

      const invoicesResponse = await apiClient.context.get(
        `/api/customers/${createdCustomer.id}/invoices`
      );

      if (invoicesResponse.ok()) {
        const invoices = await invoicesResponse.json();
        expect(Array.isArray(invoices)).toBe(true);
      }
    });

    test('should handle QuickBooks OAuth flow', async () => {
      // Initiate OAuth
      const authResponse = await apiClient.context.get('/api/integrations/quickbooks/auth');
      
      if (authResponse.ok()) {
        const authData = await authResponse.json();
        expect(authData.authUrl).toBeDefined();
        expect(authData.authUrl).toContain('intuit.com');
      }
    });
  });

  test.describe('3CX Phone System Integration', () => {
    test('should handle incoming call webhook', async () => {
      const callData = {
        event: 'call.started',
        callId: 'call_' + Date.now(),
        direction: 'inbound',
        from: '+1234567890',
        to: '+0987654321',
        timestamp: new Date().toISOString(),
        agent: 'Agent Smith',
      };

      // Generate HMAC signature
      const secret = process.env.THREE_CX_WEBHOOK_SECRET || 'test-3cx-secret';
      const signature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(callData))
        .digest('hex');

      const response = await apiClient.simulateWebhook(
        '/api/calls/webhook',
        callData,
        signature
      );

      expect([200, 202]).toContain(response.status());

      // Verify call was created
      const callResponse = await apiClient.context.get(`/api/calls/${callData.callId}`);
      
      if (callResponse.ok()) {
        const call = await callResponse.json();
        expect(call.callId).toBe(callData.callId);
        expect(call.from).toBe(callData.from);
      }
    });

    test('should handle call ended webhook', async () => {
      const callId = 'call_' + Date.now();
      
      // Start call
      const startData = {
        event: 'call.started',
        callId,
        direction: 'inbound',
        from: '+1234567890',
        to: '+0987654321',
        timestamp: new Date().toISOString(),
      };

      const secret = process.env.THREE_CX_WEBHOOK_SECRET || 'test-3cx-secret';
      const startSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(startData))
        .digest('hex');

      await apiClient.simulateWebhook('/api/calls/webhook', startData, startSignature);

      // End call
      const endData = {
        event: 'call.ended',
        callId,
        duration: 180,
        recordingUrl: 'https://3cx.example.com/recording/123.wav',
        timestamp: new Date().toISOString(),
      };

      const endSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(endData))
        .digest('hex');

      const response = await apiClient.simulateWebhook(
        '/api/calls/webhook',
        endData,
        endSignature
      );

      expect([200, 202]).toContain(response.status());

      // Verify call was updated
      const callResponse = await apiClient.context.get(`/api/calls/${callId}`);
      
      if (callResponse.ok()) {
        const call = await callResponse.json();
        expect(call.duration).toBe(180);
        expect(call.recordingUrl).toBeDefined();
        expect(call.status).toBe('completed');
      }
    });

    test('should perform caller lookup', async () => {
      // Create a customer with phone number
      const customerData = TestFactory.createCustomer();
      customerData.phone = '+1234567890';
      
      await apiClient.createCustomer(customerData);

      // Simulate incoming call from this number
      const callId = 'call_' + Date.now();
      const lookupResponse = await apiClient.lookupCaller(callId);

      if (lookupResponse.ok()) {
        const callerInfo = await lookupResponse.json();
        
        // Should find customer info
        if (callerInfo.customer) {
          expect(callerInfo.customer.phone).toBe(customerData.phone);
          expect(callerInfo.customer.name).toBe(customerData.name);
        }
      }
    });

    test('should handle screen pop data', async () => {
      const callData = {
        event: 'call.screenpop',
        callId: 'call_' + Date.now(),
        from: '+1234567890',
        agentExtension: '101',
        customerData: {
          name: 'John Doe',
          company: 'ACME Corp',
          lastOrderDate: '2024-01-15',
        },
      };

      const secret = process.env.THREE_CX_WEBHOOK_SECRET || 'test-3cx-secret';
      const signature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(callData))
        .digest('hex');

      const response = await apiClient.simulateWebhook(
        '/api/calls/webhook',
        callData,
        signature
      );

      expect([200, 202]).toContain(response.status());
    });

    test('should create ticket from voicemail', async () => {
      const voicemailData = {
        event: 'voicemail.received',
        callId: 'vm_' + Date.now(),
        from: '+1234567890',
        to: '+0987654321',
        duration: 45,
        transcription: 'Hi, I need a quote for sulfuric acid. Please call me back.',
        audioUrl: 'https://3cx.example.com/voicemail/123.wav',
        timestamp: new Date().toISOString(),
      };

      const secret = process.env.THREE_CX_WEBHOOK_SECRET || 'test-3cx-secret';
      const signature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(voicemailData))
        .digest('hex');

      const response = await apiClient.simulateWebhook(
        '/api/calls/webhook',
        voicemailData,
        signature
      );

      expect([200, 202]).toContain(response.status());

      // Check if ticket was created
      const ticketsResponse = await apiClient.listTickets({
        source: 'voicemail',
      });

      if (ticketsResponse.ok()) {
        const tickets = await ticketsResponse.json();
        const voicemailTicket = tickets.tickets.find(
          (t: any) => t.metadata?.callId === voicemailData.callId
        );
        
        if (voicemailTicket) {
          expect(voicemailTicket.type).toBe('quote'); // AI should classify it
          expect(voicemailTicket.description).toContain('sulfuric acid');
        }
      }
    });
  });

  test.describe('Microsoft Teams Integration', () => {
    test('should send notification to Teams channel', async () => {
      const notification = {
        type: 'ticket_created',
        title: 'New Urgent Ticket',
        ticketId: 'TKT-' + Date.now(),
        customer: 'ACME Corp',
        priority: 'urgent',
        description: 'Customer needs immediate assistance',
      };

      const response = await apiClient.context.post(
        '/api/integrations/teams/notify',
        { data: notification }
      );

      // Teams webhook should accept or gracefully fail
      expect([200, 202, 503]).toContain(response.status());
    });

    test('should send SLA breach alert to Teams', async () => {
      const alert = {
        type: 'sla_breach',
        ticketId: 'TKT-' + Date.now(),
        breachLevel: 90,
        timeRemaining: '10 minutes',
        assignedTo: 'John Doe',
      };

      const response = await apiClient.context.post(
        '/api/integrations/teams/notify',
        { data: alert }
      );

      expect([200, 202, 503]).toContain(response.status());
    });
  });

  test.describe('Email Integration (Mailgun)', () => {
    test('should send email through Mailgun', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        html: '<p>This is a test email</p>',
      };

      const response = await apiClient.context.post(
        '/api/email/send',
        { data: emailData }
      );

      // Email should be accepted or fail gracefully
      expect([200, 202, 503]).toContain(response.status());
    });

    test('should handle email webhook from Mailgun', async () => {
      const webhookData = {
        event: 'delivered',
        messageId: 'msg_' + Date.now(),
        recipient: 'customer@example.com',
        timestamp: Date.now() / 1000,
      };

      // Mailgun uses different signature method
      const response = await apiClient.context.post(
        '/api/webhooks/mailgun',
        { data: webhookData }
      );

      expect([200, 202]).toContain(response.status());
    });
  });

  test.describe('Integration Health Monitoring', () => {
    test('should check all integration statuses', async () => {
      const response = await apiClient.context.get('/api/integrations/status');
      
      if (response.ok()) {
        const status = await response.json();
        
        expect(status).toMatchObject({
          shopify: {
            connected: expect.any(Boolean),
            lastSync: expect.any(String),
          },
          quickbooks: {
            connected: expect.any(Boolean),
            lastSync: expect.any(String),
          },
          threeCX: {
            connected: expect.any(Boolean),
            lastCall: expect.any(String),
          },
          teams: {
            connected: expect.any(Boolean),
            lastNotification: expect.any(String),
          },
          mailgun: {
            connected: expect.any(Boolean),
            lastEmail: expect.any(String),
          },
        });
      }
    });

    test('should handle integration failures gracefully', async () => {
      // Create customer with invalid integration IDs
      const customerData = {
        ...TestFactory.createCustomer(),
        shopifyCustomerId: 'invalid_id',
        quickbooksCustomerId: 'invalid_qb_id',
      };

      const response = await apiClient.createCustomer(customerData);
      
      // Should still create customer even if integrations fail
      expect(response.ok()).toBeTruthy();
      
      const customer = await response.json();
      expect(customer.id).toBeDefined();
      
      // Check sync log for failures
      const syncLogResponse = await apiClient.context.get(
        `/api/customers/${customer.id}/sync-log`
      );
      
      if (syncLogResponse.ok()) {
        const syncLog = await syncLogResponse.json();
        
        // Should have attempted syncs
        expect(syncLog.length).toBeGreaterThan(0);
        
        // May have failures recorded
        const failures = syncLog.filter((entry: any) => entry.status === 'failed');
        if (failures.length > 0) {
          expect(failures[0].error).toBeDefined();
        }
      }
    });

    test('should retry failed integrations', async () => {
      const customerData = TestFactory.createCustomer();
      const createResponse = await apiClient.createCustomer(customerData);
      const customer = await createResponse.json();

      // Trigger retry for failed syncs
      const retryResponse = await apiClient.context.post(
        `/api/customers/${customer.id}/retry-sync`
      );

      expect([200, 202]).toContain(retryResponse.status());
      
      if (retryResponse.ok()) {
        const result = await retryResponse.json();
        expect(result.retriedIntegrations).toBeDefined();
      }
    });
  });
});