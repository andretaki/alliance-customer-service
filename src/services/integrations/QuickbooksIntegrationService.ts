import axios, { AxiosResponse } from 'axios';
import { QuickbooksIntegrationResult, QuickbooksCustomerData, QuickbooksAddressData } from '@/types';

interface QuickbooksCustomerCreateData {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  source?: string;
  ticketId?: number;
}

export class QuickbooksIntegrationService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private environment: string;
  private baseUrl: string;
  private accessToken?: string;
  private refreshToken?: string;
  private companyId?: string;

  constructor() {
    // Support both environment variable naming conventions
    this.clientId = process.env.QBO_CLIENT_ID || process.env.QUICKBOOKS_CLIENT_ID || '';
    this.clientSecret = process.env.QBO_CLIENT_SECRET || process.env.QUICKBOOKS_CLIENT_SECRET || '';
    this.redirectUri = process.env.QBO_REDIRECT_URI || process.env.QUICKBOOKS_REDIRECT_URI || '';
    this.environment = process.env.QBO_ENVIRONMENT || process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox';
    
    // Set base URL based on environment
    this.baseUrl = this.environment === 'production' 
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';

    // Load tokens from environment (in production, these would come from a secure store)
    this.accessToken = process.env.QBO_ACCESS_TOKEN || process.env.QUICKBOOKS_ACCESS_TOKEN;
    this.refreshToken = process.env.QBO_REFRESH_TOKEN || process.env.QUICKBOOKS_REFRESH_TOKEN;
    this.companyId = process.env.QBO_REALM_ID || process.env.QUICKBOOKS_COMPANY_ID;

    if (!this.clientId || !this.clientSecret) {
      console.warn('[QuickbooksIntegrationService] Missing QuickBooks credentials');
    }
  }

  /**
   * Create or find customer in QuickBooks
   */
  async createCustomer(data: QuickbooksCustomerCreateData): Promise<QuickbooksIntegrationResult> {
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          error: 'QuickBooks integration not configured'
        };
      }

      if (!this.hasValidTokens()) {
        return {
          success: false,
          error: 'QuickBooks authentication required'
        };
      }

      console.log(`[QuickbooksIntegration] Creating customer: ${data.email}`);

      // First check if customer already exists by email
      const existingCustomer = await this.findCustomerByEmail(data.email);
      if (existingCustomer.success && existingCustomer.customerId) {
        console.log(`[QuickbooksIntegration] Customer already exists: ${data.email} (ID: ${existingCustomer.customerId})`);
        return {
          success: true,
          customerId: existingCustomer.customerId,
          alreadyExists: true,
          response: existingCustomer.response
        };
      }

      // Prepare customer data for QuickBooks
      const customerData = this.prepareQuickbooksCustomerData(data);

      // Create customer in QuickBooks
      const response = await this.quickbooksApiCall('POST', '/v3/company/{companyId}/customer', customerData);

      if (response.data?.QueryResponse?.Customer?.[0]) {
        const customer = response.data.QueryResponse.Customer[0];
        console.log(`[QuickbooksIntegration] Customer created successfully: ${customer.Id}`);
        
        return {
          success: true,
          customerId: customer.Id,
          response: customer
        };
      } else {
        return {
          success: false,
          error: 'Unexpected response format from QuickBooks'
        };
      }

    } catch (error: any) {
      console.error('[QuickbooksIntegration] Error creating customer:', error);
      
      // Handle specific QuickBooks errors
      if (error.response?.data?.Fault) {
        const fault = error.response.data.Fault;
        if (fault.Error?.[0]?.Detail?.includes('Duplicate')) {
          // Customer might already exist, try to find them
          const existingCustomer = await this.findCustomerByEmail(data.email);
          if (existingCustomer.success) {
            return {
              success: true,
              customerId: existingCustomer.customerId,
              alreadyExists: true,
              response: existingCustomer.response
            };
          }
        }
        
        return {
          success: false,
          error: `QuickBooks error: ${fault.Error?.[0]?.Detail || 'Unknown error'}`
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown QuickBooks error'
      };
    }
  }

  /**
   * Find customer by email in QuickBooks
   */
  async findCustomerByEmail(email: string): Promise<QuickbooksIntegrationResult> {
    try {
      if (!this.hasValidTokens()) {
        return {
          success: false,
          error: 'QuickBooks authentication required'
        };
      }

      // QuickBooks query to find customer by email
      const query = `SELECT * FROM Customer WHERE PrimaryEmailAddr = '${email.replace("'", "''")}'`;
      
      const response = await this.quickbooksApiCall('GET', '/v3/company/{companyId}/query', undefined, {
        query: query
      });

      if (response.data?.QueryResponse?.Customer && response.data.QueryResponse.Customer.length > 0) {
        const customer = response.data.QueryResponse.Customer[0];
        return {
          success: true,
          customerId: customer.Id,
          response: customer
        };
      }

      return {
        success: false,
        error: 'Customer not found'
      };

    } catch (error) {
      console.error('[QuickbooksIntegration] Error finding customer:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find customer'
      };
    }
  }

  /**
   * Fetch a batch of customers from QuickBooks
   */
  async fetchCustomersBatch(startPosition: number = 1, maxResults: number = 1000): Promise<any> {
    try {
      if (!this.hasValidTokens()) {
        return { customers: [], error: 'QuickBooks authentication required' };
      }

      const query = `SELECT * FROM Customer STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;
      const response = await this.quickbooksApiCall('GET', `/v3/company/{companyId}/query?query=${encodeURIComponent(query)}`);
      
      return {
        customers: response.data?.QueryResponse?.Customer || [],
        hasMore: response.data?.QueryResponse?.Customer?.length === maxResults
      };
    } catch (error) {
      console.error('[QuickbooksIntegration] Error fetching customers batch:', error);
      return { customers: [], error: error instanceof Error ? error.message : 'Failed to fetch customers' };
    }
  }

  /**
   * Update customer in QuickBooks
   */
  async updateCustomer(customerId: string, data: Partial<QuickbooksCustomerCreateData>): Promise<QuickbooksIntegrationResult> {
    try {
      if (!this.hasValidTokens()) {
        return {
          success: false,
          error: 'QuickBooks authentication required'
        };
      }

      // First get the current customer to get the SyncToken (required for updates)
      const currentCustomer = await this.quickbooksApiCall('GET', `/v3/company/{companyId}/customer/${customerId}`);
      
      if (!currentCustomer.data?.QueryResponse?.Customer?.[0]) {
        return {
          success: false,
          error: 'Customer not found for update'
        };
      }

      const existingCustomer = currentCustomer.data.QueryResponse.Customer[0];
      const customerData = {
        ...this.prepareQuickbooksCustomerData(data),
        Id: customerId,
        SyncToken: existingCustomer.SyncToken // Required for updates
      };

      const response = await this.quickbooksApiCall('POST', '/v3/company/{companyId}/customer', customerData);

      if (response.data?.QueryResponse?.Customer?.[0]) {
        return {
          success: true,
          customerId: response.data.QueryResponse.Customer[0].Id,
          response: response.data.QueryResponse.Customer[0]
        };
      }

      return {
        success: false,
        error: 'Unexpected response format from QuickBooks'
      };

    } catch (error) {
      console.error('[QuickbooksIntegration] Error updating customer:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update customer'
      };
    }
  }

  /**
   * Prepare customer data for QuickBooks format
   */
  private prepareQuickbooksCustomerData(data: Partial<QuickbooksCustomerCreateData>): QuickbooksCustomerData {
    // Determine customer name
    const firstName = data.firstName || '';
    const lastName = data.lastName || '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || data.email?.split('@')[0] || 'Customer';

    // Prepare notes
    let notes = 'Customer added via Customer Service.';
    if (data.ticketId) {
      notes += ` Created from Ticket #${data.ticketId}.`;
    }
    if (data.source) {
      notes += ` Source: ${data.source}.`;
    }

    const customerData: QuickbooksCustomerData = {
      Name: fullName,
      CompanyName: data.company,
      Notes: notes
    };

    // Add email if provided
    if (data.email) {
      customerData.PrimaryEmailAddr = {
        Address: data.email
      };
    }

    // Add phone if provided
    if (data.phone) {
      customerData.PrimaryPhone = {
        FreeFormNumber: data.phone
      };
    }

    return customerData;
  }

  /**
   * Make API call to QuickBooks
   */
  private async quickbooksApiCall(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
    params?: Record<string, any>
  ): Promise<AxiosResponse> {
    if (!this.accessToken || !this.companyId) {
      throw new Error('QuickBooks access token or company ID not available');
    }

    // Replace {companyId} placeholder in endpoint
    const finalEndpoint = endpoint.replace('{companyId}', this.companyId);
    const url = `${this.baseUrl}${finalEndpoint}`;
    
    const config = {
      method,
      url,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      data,
      params
    };

    try {
      return await axios(config);
    } catch (error: any) {
      // Check if token needs refresh
      if (error.response?.status === 401 && this.refreshToken) {
        console.log('[QuickbooksIntegration] Access token expired, attempting refresh...');
        const refreshResult = await this.refreshAccessToken();
        if (refreshResult.success) {
          // Retry the original request with new token
          config.headers.Authorization = `Bearer ${this.accessToken}`;
          return await axios(config);
        }
      }
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.refreshToken) {
        return { success: false, error: 'No refresh token available' };
      }

      const response = await axios.post('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', 
        `grant_type=refresh_token&refresh_token=${this.refreshToken}`,
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      if (response.data.access_token) {
        this.accessToken = response.data.access_token;
        if (response.data.refresh_token) {
          this.refreshToken = response.data.refresh_token;
        }
        
        console.log('[QuickbooksIntegration] Access token refreshed successfully');
        return { success: true };
      }

      return { success: false, error: 'Invalid refresh response' };
    } catch (error) {
      console.error('[QuickbooksIntegration] Error refreshing token:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to refresh token' };
    }
  }

  /**
   * Check if QuickBooks is properly configured
   */
  private isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  /**
   * Check if we have valid tokens for API calls
   */
  private hasValidTokens(): boolean {
    return Boolean(this.accessToken && this.companyId);
  }

  /**
   * Get authorization URL for OAuth flow
   */
  getAuthorizationUrl(state: string = 'default'): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      scope: 'com.intuit.quickbooks.accounting',
      redirect_uri: this.redirectUri,
      response_type: 'code',
      access_type: 'offline',
      state: state
    });

    const baseUrl = this.environment === 'production'
      ? 'https://appcenter.intuit.com'
      : 'https://appcenter.intuit.com';

    return `${baseUrl}/connect/oauth2?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, realmId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await axios.post(
        'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
        `grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(this.redirectUri)}`,
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      if (response.data.access_token) {
        this.accessToken = response.data.access_token;
        this.refreshToken = response.data.refresh_token;
        this.companyId = realmId;
        
        console.log('[QuickbooksIntegration] Tokens obtained successfully');
        return { success: true };
      }

      return { success: false, error: 'Invalid token response' };
    } catch (error) {
      console.error('[QuickbooksIntegration] Error exchanging code for tokens:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to exchange code' };
    }
  }

  /**
   * Test QuickBooks connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.hasValidTokens()) {
        return {
          success: false,
          error: 'QuickBooks authentication required'
        };
      }

      await this.quickbooksApiCall('GET', '/v3/company/{companyId}/companyinfo/{companyId}');
      return { success: true };
    } catch (error) {
      console.error('[QuickbooksIntegration] Connection test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect to QuickBooks'
      };
    }
  }
}