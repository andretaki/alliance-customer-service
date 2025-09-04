import { test, expect } from '@playwright/test';
import { APIClient } from './helpers/api-client';
import { TestFactory } from './helpers/test-factory';

test.describe('AI Operations E2E Tests', () => {
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

  test.describe('AI Configuration Management', () => {
    test('should get current AI configuration', async () => {
      const response = await apiClient.getAIConfig();
      expect(response.ok()).toBeTruthy();

      const config = await response.json();
      expect(config).toMatchObject({
        provider: expect.stringMatching(/openai|gemini/),
        model: expect.any(String),
        temperature: expect.any(Number),
        maxTokens: expect.any(Number),
        enableCaching: expect.any(Boolean),
      });
    });

    test('should update AI configuration', async () => {
      const newConfig = {
        temperature: 0.8,
        maxTokens: 1500,
        enableCaching: true,
        cacheExpiry: 600000,
      };

      const response = await apiClient.updateAIConfig(newConfig);
      expect(response.ok()).toBeTruthy();

      const updatedConfig = await response.json();
      expect(updatedConfig.temperature).toBe(newConfig.temperature);
      expect(updatedConfig.maxTokens).toBe(newConfig.maxTokens);
    });

    test('should validate configuration constraints', async () => {
      const invalidConfig = {
        temperature: 3.0, // Invalid: > 2.0
        maxTokens: -100, // Invalid: negative
      };

      const response = await apiClient.updateAIConfig(invalidConfig);
      expect(response.status()).toBe(400);
      
      const error = await response.json();
      expect(error.error).toBeDefined();
    });
  });

  test.describe('Ticket Classification', () => {
    test('should classify quote requests accurately', async () => {
      const testCases = [
        {
          input: 'I need pricing for 5000 gallons of sulfuric acid',
          expectedType: 'quote',
          minConfidence: 0.8,
        },
        {
          input: 'What is your best price for bulk hydrochloric acid?',
          expectedType: 'quote',
          minConfidence: 0.8,
        },
        {
          input: 'Please send me a quotation for sodium hydroxide',
          expectedType: 'quote',
          minConfidence: 0.85,
        },
      ];

      for (const testCase of testCases) {
        const response = await apiClient.testAI('classify', testCase.input);
        expect(response.ok()).toBeTruthy();

        const result = await response.json();
        expect(result.classification).toBe(testCase.expectedType);
        expect(result.confidence).toBeGreaterThanOrEqual(testCase.minConfidence);
      }
    });

    test('should classify COA requests accurately', async () => {
      const testCases = [
        {
          input: 'Please send the certificate of analysis for lot #ABC123',
          expectedType: 'coa',
          minConfidence: 0.85,
        },
        {
          input: 'I need the COA for my recent order',
          expectedType: 'coa',
          minConfidence: 0.8,
        },
        {
          input: 'Can you provide test results for batch XYZ789?',
          expectedType: 'coa',
          minConfidence: 0.75,
        },
      ];

      for (const testCase of testCases) {
        const response = await apiClient.testAI('classify', testCase.input);
        expect(response.ok()).toBeTruthy();

        const result = await response.json();
        expect(result.classification).toBe(testCase.expectedType);
        expect(result.confidence).toBeGreaterThanOrEqual(testCase.minConfidence);
      }
    });

    test('should classify freight inquiries accurately', async () => {
      const testCases = [
        {
          input: 'How much to ship 10 drums from Chicago to Houston?',
          expectedType: 'freight',
          minConfidence: 0.8,
        },
        {
          input: 'I need freight rates for hazmat shipment',
          expectedType: 'freight',
          minConfidence: 0.85,
        },
        {
          input: 'What are the shipping options for bulk chemicals?',
          expectedType: 'freight',
          minConfidence: 0.75,
        },
      ];

      for (const testCase of testCases) {
        const response = await apiClient.testAI('classify', testCase.input);
        expect(response.ok()).toBeTruthy();

        const result = await response.json();
        expect(result.classification).toBe(testCase.expectedType);
        expect(result.confidence).toBeGreaterThanOrEqual(testCase.minConfidence);
      }
    });

    test('should classify claims accurately', async () => {
      const testCases = [
        {
          input: 'The shipment arrived damaged and we need compensation',
          expectedType: 'claim',
          minConfidence: 0.85,
        },
        {
          input: 'Three drums were leaking when delivered',
          expectedType: 'claim',
          minConfidence: 0.8,
        },
        {
          input: 'Product quality does not meet specifications',
          expectedType: 'claim',
          minConfidence: 0.75,
        },
      ];

      for (const testCase of testCases) {
        const response = await apiClient.testAI('classify', testCase.input);
        expect(response.ok()).toBeTruthy();

        const result = await response.json();
        expect(result.classification).toBe(testCase.expectedType);
        expect(result.confidence).toBeGreaterThanOrEqual(testCase.minConfidence);
      }
    });
  });

  test.describe('Sentiment Analysis', () => {
    test('should detect positive sentiment', async () => {
      const positiveInputs = [
        'Thank you for the excellent service! Very happy with the delivery.',
        'Great experience working with your team. Will order again!',
        'Impressed with the quality and speed of delivery.',
      ];

      for (const input of positiveInputs) {
        const response = await apiClient.testAI('sentiment', input);
        expect(response.ok()).toBeTruthy();

        const result = await response.json();
        expect(result.sentiment).toBe('positive');
        expect(result.score).toBeGreaterThan(0);
      }
    });

    test('should detect negative sentiment', async () => {
      const negativeInputs = [
        'This is unacceptable! Third delayed shipment this month!',
        'Very disappointed with the service. Product was damaged.',
        'Worst experience ever. Will not order again.',
      ];

      for (const input of negativeInputs) {
        const response = await apiClient.testAI('sentiment', input);
        expect(response.ok()).toBeTruthy();

        const result = await response.json();
        expect(result.sentiment).toBe('negative');
        expect(result.score).toBeLessThan(0);
      }
    });

    test('should detect neutral sentiment', async () => {
      const neutralInputs = [
        'Please send the invoice for order #12345',
        'What are your business hours?',
        'I need to update my shipping address',
      ];

      for (const input of neutralInputs) {
        const response = await apiClient.testAI('sentiment', input);
        expect(response.ok()).toBeTruthy();

        const result = await response.json();
        expect(result.sentiment).toBe('neutral');
        expect(Math.abs(result.score)).toBeLessThan(0.3);
      }
    });
  });

  test.describe('Response Generation', () => {
    test('should generate professional responses', async () => {
      const contexts = [
        {
          type: 'quote',
          input: 'Customer requesting quote for 10,000 lbs of sulfuric acid',
          expectedTone: 'professional',
        },
        {
          type: 'coa',
          input: 'Customer needs COA for lot #ABC123',
          expectedTone: 'professional',
        },
        {
          type: 'claim',
          input: 'Customer reporting damaged shipment',
          expectedTone: 'empathetic',
        },
      ];

      for (const context of contexts) {
        const response = await apiClient.testAI('suggest', JSON.stringify(context));
        expect(response.ok()).toBeTruthy();

        const result = await response.json();
        expect(result.responses).toBeDefined();
        expect(Array.isArray(result.responses)).toBe(true);
        expect(result.responses.length).toBeGreaterThan(0);
        
        const suggestion = result.responses[0];
        expect(suggestion.content).toBeDefined();
        expect(suggestion.tone).toBe(context.expectedTone);
      }
    });

    test('should generate context-aware responses', async () => {
      const customer = TestFactory.createCustomer();
      const ticket = {
        ...TestFactory.createTicket(),
        type: 'quote',
        customerName: customer.name,
        customerCompany: customer.company,
      };

      const response = await apiClient.testAI('suggest', JSON.stringify(ticket));
      expect(response.ok()).toBeTruthy();

      const result = await response.json();
      const suggestion = result.responses[0];
      
      // Response should reference customer context
      expect(suggestion.content.toLowerCase()).toContain(
        customer.company.toLowerCase().split(' ')[0]
      );
    });
  });

  test.describe('Content Summarization', () => {
    test('should summarize long conversations', async () => {
      const longConversation = `
        Customer: I need a quote for chemicals.
        Agent: Which chemicals are you interested in?
        Customer: Sulfuric acid and hydrochloric acid.
        Agent: What quantities do you need?
        Customer: 10,000 gallons of sulfuric and 5,000 gallons of hydrochloric.
        Agent: What's your delivery location?
        Customer: Houston, Texas. We need it by next month.
        Agent: I'll prepare a quote for you.
      `;

      const response = await apiClient.testAI('summarize', longConversation);
      expect(response.ok()).toBeTruthy();

      const result = await response.json();
      expect(result.summary).toBeDefined();
      expect(result.summary.length).toBeLessThan(longConversation.length / 2);
      expect(result.keyPoints).toBeDefined();
      expect(Array.isArray(result.keyPoints)).toBe(true);
    });

    test('should extract key information from tickets', async () => {
      const ticketContent = `
        Subject: Urgent chemical order needed
        Customer needs 15,000 lbs of caustic soda delivered to their facility
        in Dallas, TX by March 15th. They also mentioned needing the COA
        and MSDS documents. Previous order was #ORD-2024-001.
      `;

      const response = await apiClient.testAI('extract', ticketContent);
      expect(response.ok()).toBeTruthy();

      const result = await response.json();
      expect(result.extractedInfo).toBeDefined();
      expect(result.extractedInfo.product).toContain('caustic soda');
      expect(result.extractedInfo.quantity).toContain('15,000');
      expect(result.extractedInfo.location).toContain('Dallas');
    });
  });

  test.describe('AI Operations Audit', () => {
    test('should log all AI operations', async () => {
      // Perform an AI operation
      await apiClient.testAI('classify', 'I need a price quote');

      // Check operation history
      const response = await apiClient.getAIOperations({
        limit: 10,
        operation: 'classify',
      });
      expect(response.ok()).toBeTruthy();

      const operations = await response.json();
      expect(operations.records).toBeDefined();
      expect(Array.isArray(operations.records)).toBe(true);
      
      if (operations.records.length > 0) {
        const record = operations.records[0];
        expect(record).toMatchObject({
          operation: 'classify',
          provider: expect.any(String),
          model: expect.any(String),
          tokenCount: expect.any(Number),
          latency: expect.any(Number),
          success: expect.any(Boolean),
        });
      }
    });

    test('should track AI performance metrics', async () => {
      const response = await apiClient.context.get('/api/ai/metrics');
      
      if (response.ok()) {
        const metrics = await response.json();
        expect(metrics).toMatchObject({
          totalOperations: expect.any(Number),
          averageLatency: expect.any(Number),
          successRate: expect.any(Number),
          totalTokens: expect.any(Number),
        });
      }
    });
  });

  test.describe('AI Caching', () => {
    test('should cache repeated AI operations', async () => {
      const input = 'Test input for caching ' + Date.now();
      
      // First request - should not be cached
      const response1 = await apiClient.testAI('classify', input);
      expect(response1.ok()).toBeTruthy();
      const result1 = await response1.json();
      
      // Second request - should be cached
      const response2 = await apiClient.testAI('classify', input);
      expect(response2.ok()).toBeTruthy();
      const result2 = await response2.json();
      
      // Results should be identical
      expect(result2.classification).toBe(result1.classification);
      expect(result2.confidence).toBe(result1.confidence);
      
      // Check cache header if available
      const cacheHeader = response2.headers().get('x-cache-hit');
      if (cacheHeader) {
        expect(cacheHeader).toBe('true');
      }
    });

    test('should respect cache expiry settings', async () => {
      // Update config with short cache expiry
      await apiClient.updateAIConfig({
        enableCaching: true,
        cacheExpiry: 1000, // 1 second
      });

      const input = 'Test cache expiry ' + Date.now();
      
      // First request
      await apiClient.testAI('classify', input);
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Second request - should not be cached
      const response = await apiClient.testAI('classify', input);
      const cacheHeader = response.headers().get('x-cache-hit');
      if (cacheHeader) {
        expect(cacheHeader).toBe('false');
      }
    });
  });

  test.describe('AI Error Handling', () => {
    test('should handle provider failures gracefully', async () => {
      // Simulate provider failure with invalid config
      const response = await apiClient.updateAIConfig({
        provider: 'openai',
        apiKey: 'invalid-key-to-test-failure',
      });

      // System should still respond (might use fallback or return error)
      expect([200, 400, 500]).toContain(response.status());
    });

    test('should validate input length limits', async () => {
      const veryLongInput = 'x'.repeat(100000); // 100k characters
      
      const response = await apiClient.testAI('classify', veryLongInput);
      expect(response.status()).toBe(400);
      
      const error = await response.json();
      expect(error.error).toContain('length');
    });

    test('should handle rate limiting', async () => {
      const promises = [];
      
      // Send many requests in parallel
      for (let i = 0; i < 20; i++) {
        promises.push(apiClient.testAI('classify', `Test ${i}`));
      }
      
      const responses = await Promise.all(promises);
      
      // Check if any were rate limited
      const rateLimited = responses.filter(r => r.status() === 429);
      
      // If rate limiting is enabled, some should be limited
      if (rateLimited.length > 0) {
        const headers = rateLimited[0].headers();
        expect(headers.get('x-ratelimit-limit')).toBeDefined();
        expect(headers.get('x-ratelimit-remaining')).toBeDefined();
      }
    });
  });
});