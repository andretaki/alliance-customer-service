import axios, { AxiosResponse } from 'axios';
import { ShopifyIntegrationResult, ShopifyCustomerData, ShopifyAddressData } from '@/types';

interface ShopifyCustomerCreateData {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  source?: string;
  ticketId?: number;
}

export class ShopifyIntegrationService {
  private storeUrl: string;
  private accessToken: string;
  private apiVersion: string = '2024-01';

  constructor() {
    // Support both environment variable names
    const shopifyStore = process.env.SHOPIFY_STORE || process.env.SHOPIFY_STORE_URL || '';
    this.accessToken = process.env.SHOPIFY_ACCESS_TOKEN || process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || '';
    
    // Ensure store URL is properly formatted
    if (shopifyStore) {
      this.storeUrl = shopifyStore.startsWith('http') 
        ? shopifyStore 
        : `https://${shopifyStore}`;
    } else {
      this.storeUrl = '';
    }

    if (!this.storeUrl || !this.accessToken) {
      console.warn('[ShopifyIntegrationService] Missing Shopify credentials');
      console.warn(`  Store URL: ${this.storeUrl ? 'configured' : 'missing'}`);
      console.warn(`  Access Token: ${this.accessToken ? 'configured' : 'missing'}`);
    }
  }

  /**
   * Create or find customer in Shopify
   */
  async createCustomer(data: ShopifyCustomerCreateData): Promise<ShopifyIntegrationResult> {
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          error: 'Shopify integration not configured'
        };
      }

      console.log(`[ShopifyIntegration] Creating customer: ${data.email}`);

      // First check if customer already exists
      const existingCustomer = await this.findCustomerByEmail(data.email);
      if (existingCustomer.success && existingCustomer.customerId) {
        console.log(`[ShopifyIntegration] Customer already exists: ${data.email} (ID: ${existingCustomer.customerId})`);
        return {
          success: true,
          customerId: existingCustomer.customerId,
          alreadyExists: true,
          response: existingCustomer.response
        };
      }

      // Prepare customer data for Shopify
      const customerData = this.prepareShopifyCustomerData(data);

      // Create customer in Shopify
      const response = await this.shopifyApiCall('POST', '/customers.json', {
        customer: customerData
      });

      if (response.data?.customer) {
        const customer = response.data.customer;
        console.log(`[ShopifyIntegration] Customer created successfully: ${customer.id}`);
        
        return {
          success: true,
          customerId: customer.id.toString(),
          response: customer
        };
      } else {
        return {
          success: false,
          error: 'Unexpected response format from Shopify'
        };
      }

    } catch (error: any) {
      console.error('[ShopifyIntegration] Error creating customer:', error);
      
      // Handle specific Shopify errors
      if (error.response?.data?.errors) {
        const shopifyErrors = error.response.data.errors;
        if (shopifyErrors.email && shopifyErrors.email.includes('has already been taken')) {
          // Customer already exists, try to find them
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
          error: `Shopify error: ${Object.entries(shopifyErrors).map(([k, v]) => `${k}: ${v}`).join(', ')}`
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown Shopify error'
      };
    }
  }

  /**
   * Find customer by email in Shopify with enhanced data
   */
  async findCustomerByEmail(email: string): Promise<ShopifyIntegrationResult> {
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          error: 'Shopify integration not configured'
        };
      }

      const response = await this.shopifyApiCall('GET', '/customers/search.json', undefined, {
        query: `email:${email}`
      });

      if (response.data?.customers && response.data.customers.length > 0) {
        const customer = response.data.customers[0];
        
        // Get recent orders for this customer
        const ordersResponse = await this.shopifyApiCall('GET', `/customers/${customer.id}/orders.json`, undefined, {
          limit: 10,
          status: 'any'
        });
        
        // Enhance customer data with order details
        const enhancedCustomer = {
          ...customer,
          recent_orders: ordersResponse.data?.orders || [],
          orders_summary: {
            total_orders: customer.orders_count || 0,
            total_spent: parseFloat(customer.total_spent || '0'),
            last_order_date: customer.last_order_date || null,
            recent_orders_count: ordersResponse.data?.orders?.length || 0
          }
        };
        
        return {
          success: true,
          customerId: customer.id.toString(),
          response: enhancedCustomer
        };
      }

      return {
        success: false,
        error: 'Customer not found'
      };

    } catch (error) {
      console.error('[ShopifyIntegration] Error finding customer:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find customer'
      };
    }
  }

  /**
   * Find customer by phone number in Shopify with enhanced data
   */
  async findCustomerByPhone(phone: string): Promise<ShopifyIntegrationResult> {
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          error: 'Shopify integration not configured'
        };
      }

      // Clean phone number - remove all non-digits
      const cleanPhone = phone.replace(/\D/g, '');
      
      // Try multiple phone formats
      const phoneVariations = [
        cleanPhone,
        `+1${cleanPhone}`,
        cleanPhone.substring(1), // Remove leading 1 if present
      ];

      for (const phoneVar of phoneVariations) {
        const response = await this.shopifyApiCall('GET', '/customers/search.json', undefined, {
          query: `phone:*${phoneVar}*`
        });

        if (response.data?.customers && response.data.customers.length > 0) {
          const customer = response.data.customers[0];
          
          // Get recent orders for this customer
          const ordersResponse = await this.shopifyApiCall('GET', `/customers/${customer.id}/orders.json`, undefined, {
            limit: 10,
            status: 'any'
          });
          
          // Enhance customer data with order details
          const enhancedCustomer = {
            ...customer,
            recent_orders: ordersResponse.data?.orders || [],
            orders_summary: {
              total_orders: customer.orders_count || 0,
              total_spent: parseFloat(customer.total_spent || '0'),
              last_order_date: customer.last_order_date || null,
              recent_orders_count: ordersResponse.data?.orders?.length || 0
            }
          };
          
          return {
            success: true,
            customerId: customer.id.toString(),
            response: enhancedCustomer
          };
        }
      }

      return {
        success: false,
        error: 'Customer not found by phone'
      };

    } catch (error) {
      console.error('[ShopifyIntegration] Error finding customer by phone:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find customer by phone'
      };
    }
  }

  /**
   * Find customer by email OR phone with parallel search (FAST!)
   */
  async findCustomerByEmailOrPhone(email?: string, phone?: string): Promise<ShopifyIntegrationResult> {
    try {
      if (!email && !phone) {
        return {
          success: false,
          error: 'Either email or phone required'
        };
      }

      const searchPromises: Promise<ShopifyIntegrationResult>[] = [];
      
      if (email) {
        searchPromises.push(this.findCustomerByEmail(email));
      }
      
      if (phone) {
        searchPromises.push(this.findCustomerByPhone(phone));
      }

      // Run searches in parallel for maximum speed
      const results = await Promise.allSettled(searchPromises);
      
      // Return first successful result
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.success) {
          return result.value;
        }
      }

      return {
        success: false,
        error: 'Customer not found by email or phone'
      };

    } catch (error) {
      console.error('[ShopifyIntegration] Error in parallel search:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search customer'
      };
    }
  }

  /**
   * Update customer in Shopify
   */
  async updateCustomer(customerId: string, data: Partial<ShopifyCustomerCreateData>): Promise<ShopifyIntegrationResult> {
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          error: 'Shopify integration not configured'
        };
      }

      const customerData = this.prepareShopifyCustomerData(data);

      const response = await this.shopifyApiCall('PUT', `/customers/${customerId}.json`, {
        customer: customerData
      });

      if (response.data?.customer) {
        return {
          success: true,
          customerId: response.data.customer.id.toString(),
          response: response.data.customer
        };
      }

      return {
        success: false,
        error: 'Unexpected response format from Shopify'
      };

    } catch (error) {
      console.error('[ShopifyIntegration] Error updating customer:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update customer'
      };
    }
  }

  /**
   * Fetch a page of customers from Shopify
   */
  async fetchCustomersPage(page: number = 1, limit: number = 250): Promise<any> {
    try {
      if (!this.isConfigured()) {
        return { customers: [], error: 'Shopify not configured' };
      }

      const response = await this.shopifyApiCall('GET', `/customers.json?limit=${limit}&page=${page}`);
      return {
        customers: response.data?.customers || [],
        hasMore: response.data?.customers?.length === limit
      };
    } catch (error) {
      console.error('[ShopifyIntegration] Error fetching customers page:', error);
      return { customers: [], error: error instanceof Error ? error.message : 'Failed to fetch customers' };
    }
  }

  /**
   * Add address to customer in Shopify
   */
  async addCustomerAddress(customerId: string, addressData: ShopifyAddressData): Promise<ShopifyIntegrationResult> {
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          error: 'Shopify integration not configured'
        };
      }

      const response = await this.shopifyApiCall('POST', `/customers/${customerId}/addresses.json`, {
        address: addressData
      });

      if (response.data?.customer_address) {
        return {
          success: true,
          customerId: customerId,
          response: response.data.customer_address
        };
      }

      return {
        success: false,
        error: 'Unexpected response format from Shopify'
      };

    } catch (error) {
      console.error('[ShopifyIntegration] Error adding customer address:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add address'
      };
    }
  }

  /**
   * Prepare customer data for Shopify format
   */
  private prepareShopifyCustomerData(data: Partial<ShopifyCustomerCreateData>): ShopifyCustomerData {
    // Prepare tags
    const tags = ['CustomerService'];
    if (data.source) {
      tags.push(`Source:${data.source}`);
    }
    if (data.ticketId) {
      tags.push(`Ticket:${data.ticketId}`);
    }

    // Prepare note
    let note = 'Customer added via Customer Service.';
    if (data.ticketId) {
      note += ` Created from Ticket #${data.ticketId}.`;
    }
    if (data.source) {
      note += ` Source: ${data.source}.`;
    }
    if (data.company) {
      note += ` Company: ${data.company}.`;
    }

    return {
      email: data.email!,
      first_name: data.firstName,
      last_name: data.lastName,
      phone: data.phone,
      tags: tags.join(', '),
      note: note.trim(),
      verified_email: false,
      accepts_marketing: false
    };
  }

  /**
   * Make API call to Shopify
   */
  private async shopifyApiCall(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
    params?: Record<string, any>
  ): Promise<AxiosResponse> {
    const url = `https://${this.storeUrl}/admin/api/${this.apiVersion}${endpoint}`;
    
    const config = {
      method,
      url,
      headers: {
        'X-Shopify-Access-Token': this.accessToken,
        'Content-Type': 'application/json'
      },
      data,
      params
    };

    return await axios(config);
  }

  /**
   * Check if Shopify is properly configured
   */
  private isConfigured(): boolean {
    return Boolean(this.storeUrl && this.accessToken);
  }

  /**
   * Test Shopify connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          error: 'Shopify credentials not configured'
        };
      }

      await this.shopifyApiCall('GET', '/shop.json');
      return { success: true };
    } catch (error) {
      console.error('[ShopifyIntegration] Connection test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect to Shopify'
      };
    }
  }
}