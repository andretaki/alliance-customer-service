import { APIRequestContext, request } from '@playwright/test';

export class APIClient {
  private context!: APIRequestContext;
  private baseURL: string;
  private token: string;

  constructor(baseURL: string, token: string) {
    this.baseURL = baseURL;
    this.token = token;
  }

  async init() {
    const timestamp = Date.now();
    this.context = await request.newContext({
      baseURL: this.baseURL,
      extraHTTPHeaders: {
        'Authorization': `Bearer ${this.token}`,
        'X-Service-Name': 'e2e-tests',
        'X-Timestamp': timestamp.toString(),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
  }

  async dispose() {
    if (this.context) {
      await this.context.dispose();
    }
  }

  // Customer endpoints
  async createCustomer(data: any) {
    return this.context.post('/api/customers', { data });
  }

  async getCustomer(id: string) {
    return this.context.get(`/api/customers/${id}`);
  }

  async getCustomerByEmail(email: string) {
    return this.context.get(`/api/customers/email/${email}`);
  }

  async updateCustomer(id: string, data: any) {
    return this.context.patch(`/api/customers/${id}`, { data });
  }

  // Ticket endpoints
  async createTicket(data: any) {
    return this.context.post('/api/tickets', { data });
  }

  async getTicket(id: string) {
    return this.context.get(`/api/tickets/${id}`);
  }

  async listTickets(params?: Record<string, any>) {
    return this.context.get('/api/tickets', { params });
  }

  async updateTicket(id: string, data: any) {
    return this.context.patch(`/api/tickets/${id}`, { data });
  }

  async suggestResponses(ticketId: string) {
    return this.context.post(`/api/tickets/${ticketId}/suggest-responses`);
  }

  // Call endpoints
  async createCall(data: any) {
    return this.context.post('/api/calls', { data });
  }

  async getCall(id: string) {
    return this.context.get(`/api/calls/${id}`);
  }

  async lookupCaller(callId: string) {
    return this.context.get(`/api/calls/lookup/${callId}`);
  }

  // COA endpoints
  async searchCOA(params: any) {
    return this.context.get('/api/coa', { params });
  }

  async createCOA(data: any) {
    return this.context.post('/api/coa', { data });
  }

  // Freight endpoints
  async getFreightList() {
    return this.context.get('/api/freight/list');
  }

  async addToFreightList(data: any) {
    return this.context.post('/api/freight/list', { data });
  }

  async sendRFQ(data: any) {
    return this.context.post('/api/freight/rfq', { data });
  }

  // AI endpoints
  async testAI(operation?: string, input?: string) {
    if (operation) {
      return this.context.post('/api/ai/test', { data: { operation, input } });
    }
    return this.context.get('/api/ai/test');
  }

  async getAIConfig() {
    return this.context.get('/api/ai/config');
  }

  async updateAIConfig(data: any) {
    return this.context.post('/api/ai/config', { data });
  }

  async getAIOperations(params?: any) {
    return this.context.get('/api/ai/operations', { params });
  }

  // Integration test endpoints
  async testShopify() {
    return this.context.post('/api/integrations/shopify/test');
  }

  async testQuickBooks() {
    return this.context.post('/api/integrations/quickbooks/test');
  }

  // Job endpoints
  async runSLACheck() {
    return this.context.post('/api/jobs/sla-check');
  }

  async sendWeeklyReport() {
    return this.context.post('/api/jobs/weekly-report');
  }

  // Health check
  async healthCheck() {
    return this.context.get('/api/health');
  }

  // Webhook simulation
  async simulateWebhook(endpoint: string, data: any, signature?: string) {
    const headers: any = {
      'Content-Type': 'application/json',
    };
    
    if (signature) {
      headers['X-Webhook-Signature'] = signature;
    }

    return this.context.post(endpoint, { data, headers });
  }
}