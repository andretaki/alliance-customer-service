import { test, expect } from '@playwright/test';
import { APIClient } from './helpers/api-client';
import { TestFactory } from './helpers/test-factory';

test.describe('Customer Management E2E Tests', () => {
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

  test.describe('Customer CRUD Operations', () => {
    test('should create a new customer with all fields', async () => {
      const customerData = TestFactory.createCustomer();
      
      const response = await apiClient.createCustomer(customerData);
      if (!response.ok()) {
        const error = await response.text();
        console.error('API Error:', response.status(), error);
      }
      expect(response.ok()).toBeTruthy();
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        email: customerData.email,
        firstName: customerData.firstName,
        lastName: customerData.lastName,
        company: customerData.company,
        phone: customerData.phone,
      });
      expect(result.data.id).toBeDefined();
      expect(result.data.createdAt).toBeDefined();
    });

    test('should prevent duplicate customer creation', async () => {
      const customerData = TestFactory.createCustomer();
      
      // Create first customer
      const response1 = await apiClient.createCustomer(customerData);
      expect(response1.ok()).toBeTruthy();
      
      // Attempt to create duplicate
      const response2 = await apiClient.createCustomer(customerData);
      expect(response2.status()).toBe(409);
    });

    test('should find customer by email', async () => {
      const customerData = TestFactory.createCustomer();
      
      // Create customer
      const createResponse = await apiClient.createCustomer(customerData);
      expect(createResponse.ok()).toBeTruthy();
      
      // Find by email
      const findResponse = await apiClient.getCustomerByEmail(customerData.email);
      expect(findResponse.ok()).toBeTruthy();
      
      const customer = await findResponse.json();
      expect(customer.email).toBe(customerData.email);
    });

    test('should update customer information', async () => {
      const customerData = TestFactory.createCustomer();
      
      // Create customer
      const createResponse = await apiClient.createCustomer(customerData);
      const customer = await createResponse.json();
      
      // Update customer
      const updateData = {
        name: 'Updated Name',
        company: 'Updated Company',
        tags: ['updated', 'test'],
      };
      
      const updateResponse = await apiClient.updateCustomer(customer.id, updateData);
      expect(updateResponse.ok()).toBeTruthy();
      
      const updatedCustomer = await updateResponse.json();
      expect(updatedCustomer.name).toBe(updateData.name);
      expect(updatedCustomer.company).toBe(updateData.company);
      expect(updatedCustomer.tags).toEqual(updateData.tags);
    });
  });

  test.describe('Customer Address Management', () => {
    test('should add multiple addresses to customer', async () => {
      const customerData = TestFactory.createCustomer();
      const addressData1 = { ...TestFactory.createAddress(), type: 'billing' };
      const addressData2 = { ...TestFactory.createAddress(), type: 'shipping' };
      
      // Create customer
      const createResponse = await apiClient.createCustomer(customerData);
      const customer = await createResponse.json();
      
      // Add billing address
      const address1Response = await apiClient.context.post(
        `/api/customers/${customer.id}/addresses`,
        { data: addressData1 }
      );
      expect(address1Response.ok()).toBeTruthy();
      
      // Add shipping address
      const address2Response = await apiClient.context.post(
        `/api/customers/${customer.id}/addresses`,
        { data: addressData2 }
      );
      expect(address2Response.ok()).toBeTruthy();
      
      // Verify addresses
      const getResponse = await apiClient.getCustomer(customer.id);
      const updatedCustomer = await getResponse.json();
      expect(updatedCustomer.addresses).toHaveLength(2);
    });

    test('should set default address correctly', async () => {
      const customerData = TestFactory.createCustomer();
      const addressData = { ...TestFactory.createAddress(), isDefault: true };
      
      // Create customer
      const createResponse = await apiClient.createCustomer(customerData);
      const customer = await createResponse.json();
      
      // Add default address
      const addressResponse = await apiClient.context.post(
        `/api/customers/${customer.id}/addresses`,
        { data: addressData }
      );
      expect(addressResponse.ok()).toBeTruthy();
      
      const address = await addressResponse.json();
      expect(address.isDefault).toBe(true);
    });
  });

  test.describe('Customer Integration Sync', () => {
    test('should sync customer with Shopify', async () => {
      const customerData = {
        ...TestFactory.createCustomer(),
        shopifyCustomerId: '123456789',
      };
      
      const response = await apiClient.createCustomer(customerData);
      expect(response.ok()).toBeTruthy();
      
      const customer = await response.json();
      expect(customer.shopifyCustomerId).toBe(customerData.shopifyCustomerId);
      
      // Check sync log
      if (customer.syncLog && customer.syncLog.length > 0) {
        const shopifySync = customer.syncLog.find((log: any) => log.integration === 'shopify');
        expect(shopifySync).toBeDefined();
      }
    });

    test('should sync customer with QuickBooks', async () => {
      const customerData = {
        ...TestFactory.createCustomer(),
        quickbooksCustomerId: 'QB123456',
      };
      
      const response = await apiClient.createCustomer(customerData);
      expect(response.ok()).toBeTruthy();
      
      const customer = await response.json();
      expect(customer.quickbooksCustomerId).toBe(customerData.quickbooksCustomerId);
      
      // Check sync log
      if (customer.syncLog && customer.syncLog.length > 0) {
        const qbSync = customer.syncLog.find((log: any) => log.integration === 'quickbooks');
        expect(qbSync).toBeDefined();
      }
    });
  });

  test.describe('Customer Search and Filtering', () => {
    test('should search customers by company name', async () => {
      const companyName = `Test Company ${Date.now()}`;
      const customerData = {
        ...TestFactory.createCustomer(),
        company: companyName,
      };
      
      // Create customer
      await apiClient.createCustomer(customerData);
      
      // Search by company
      const searchResponse = await apiClient.context.get('/api/customers', {
        params: { search: companyName },
      });
      expect(searchResponse.ok()).toBeTruthy();
      
      const results = await searchResponse.json();
      expect(results.customers).toBeDefined();
      expect(results.customers.length).toBeGreaterThan(0);
      expect(results.customers[0].company).toContain(companyName);
    });

    test('should filter customers by tags', async () => {
      const uniqueTag = `tag-${Date.now()}`;
      const customerData = {
        ...TestFactory.createCustomer(),
        tags: [uniqueTag, 'test'],
      };
      
      // Create customer
      await apiClient.createCustomer(customerData);
      
      // Filter by tag
      const filterResponse = await apiClient.context.get('/api/customers', {
        params: { tags: uniqueTag },
      });
      expect(filterResponse.ok()).toBeTruthy();
      
      const results = await filterResponse.json();
      expect(results.customers).toBeDefined();
      expect(results.customers.length).toBeGreaterThan(0);
      expect(results.customers[0].tags).toContain(uniqueTag);
    });
  });

  test.describe('Customer Validation', () => {
    test('should validate required fields', async () => {
      const invalidData = {
        name: 'Test User',
        // Missing required email
      };
      
      const response = await apiClient.createCustomer(invalidData);
      expect(response.status()).toBe(400);
      
      const error = await response.json();
      expect(error.error).toBeDefined();
    });

    test('should validate email format', async () => {
      const invalidData = {
        ...TestFactory.createCustomer(),
        email: 'invalid-email',
      };
      
      const response = await apiClient.createCustomer(invalidData);
      expect(response.status()).toBe(400);
      
      const error = await response.json();
      expect(error.error).toContain('email');
    });

    test('should validate phone format', async () => {
      const invalidData = {
        ...TestFactory.createCustomer(),
        phone: '123', // Too short
      };
      
      const response = await apiClient.createCustomer(invalidData);
      expect(response.status()).toBe(400);
      
      const error = await response.json();
      expect(error.error).toContain('phone');
    });
  });
});