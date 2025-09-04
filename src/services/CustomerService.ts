import { db, customers, customerAddresses, customerSyncLog, Customer, NewCustomer, CustomerAddress, NewCustomerAddress } from '@/db';
import { eq, or, ilike, and } from 'drizzle-orm';
import { 
  CreateCustomerInput, 
  CreateAddressInput, 
  CustomerSearchInput, 
  CustomerCreateResult, 
  ServiceResponse 
} from '@/types';
import { ShopifyIntegrationService } from './integrations/ShopifyIntegrationService';
import { QuickbooksIntegrationService } from './integrations/QuickbooksIntegrationService';

export class CustomerService {
  private shopifyService: ShopifyIntegrationService;
  private quickbooksService: QuickbooksIntegrationService;

  constructor() {
    this.shopifyService = new ShopifyIntegrationService();
    this.quickbooksService = new QuickbooksIntegrationService();
  }

  /**
   * Create a new customer with dual integration to Shopify and QuickBooks
   * Unifies customer data across all systems
   */
  async createCustomer(data: CreateCustomerInput): Promise<CustomerCreateResult> {
    try {
      console.log(`[CustomerService] Creating/syncing customer: ${data.email}`);

      // Check if customer already exists in database
      const existingCustomer = await this.findCustomerByEmail(data.email);
      if (existingCustomer.success && existingCustomer.data) {
        console.log(`[CustomerService] Customer already exists in database: ${data.email} (ID: ${existingCustomer.data.id})`);
        
        // Sync to missing systems if needed
        const customer = existingCustomer.data;
        let needsUpdate = false;
        const updates: any = {};
        
        // Check and sync Shopify if missing
        if (!customer.shopifyId && data.syncToShopify !== false) {
          console.log(`[CustomerService] Customer missing in Shopify, syncing...`);
          const shopifyResult = await this.shopifyService.createCustomer({
            email: customer.email,
            firstName: customer.firstName || undefined,
            lastName: customer.lastName || undefined,
            phone: customer.phone || undefined,
            company: customer.company || undefined
          });
          
          if (shopifyResult.success && shopifyResult.customerId) {
            updates.shopifyId = BigInt(shopifyResult.customerId);
            updates.shopifyStatus = 'synced';
            needsUpdate = true;
          }
        }
        
        // Check and sync QuickBooks if missing
        if (!customer.quickbooksId && data.syncToQuickbooks !== false) {
          console.log(`[CustomerService] Customer missing in QuickBooks, syncing...`);
          const qbResult = await this.quickbooksService.createCustomer({
            email: customer.email,
            firstName: customer.firstName || undefined,
            lastName: customer.lastName || undefined,
            phone: customer.phone || undefined,
            company: customer.company || undefined
          });
          
          if (qbResult.success && qbResult.customerId) {
            updates.quickbooksId = qbResult.customerId;
            updates.quickbooksStatus = 'synced';
            needsUpdate = true;
          }
        }
        
        // Update database if sync happened
        if (needsUpdate) {
          updates.lastSyncedAt = new Date();
          await db.update(customers)
            .set(updates)
            .where(eq(customers.id, customer.id));
        }
        
        return {
          success: true,
          customer: { ...customer, ...updates },
          customerId: customer.id.toString(),
          alreadyExists: true,
          message: needsUpdate ? 'Customer synced to missing systems' : 'Customer already exists in all systems'
        };
      }
      
      // Check if customer exists in Shopify first
      let shopifyCustomer = null;
      let shopifyId = null;
      if (data.syncToShopify !== false) {
        try {
          const shopifySearch = await this.shopifyService.findCustomerByEmail(data.email);
          if (shopifySearch.success && shopifySearch.response) {
            shopifyCustomer = shopifySearch.response;
            shopifyId = shopifySearch.response.id;
            console.log(`[CustomerService] Customer found in Shopify: ${shopifyId}`);
          }
        } catch (error) {
          console.warn(`[CustomerService] Error checking Shopify:`, error);
        }
      }
      
      // Check if customer exists in QuickBooks
      let qbCustomer = null;
      let qbId = null;
      if (data.syncToQuickbooks !== false) {
        try {
          const qbSearch = await this.quickbooksService.findCustomerByEmail(data.email);
          if (qbSearch.success && qbSearch.response) {
            qbCustomer = qbSearch.response;
            qbId = qbSearch.response.Id;
            console.log(`[CustomerService] Customer found in QuickBooks: ${qbId}`);
          }
        } catch (error) {
          console.warn(`[CustomerService] Error checking QuickBooks:`, error);
        }
      }

      // Merge data from existing systems or use provided data
      const mergedData = {
        email: data.email.toLowerCase().trim(),
        firstName: data.firstName?.trim() || shopifyCustomer?.first_name || qbCustomer?.GivenName || '',
        lastName: data.lastName?.trim() || shopifyCustomer?.last_name || qbCustomer?.FamilyName || '',
        company: data.company?.trim() || shopifyCustomer?.default_address?.company || qbCustomer?.CompanyName || '',
        phone: data.phone?.trim() || shopifyCustomer?.phone || qbCustomer?.PrimaryPhone?.FreeFormNumber || '',
        source: data.source || 'manual',
        notes: data.notes,
        tags: data.tags ? JSON.stringify(data.tags) : null,
        shopifyId: shopifyId ? BigInt(shopifyId) : null,
        quickbooksId: qbId || null,
        shopifyStatus: (shopifyId ? 'synced' : (data.syncToShopify !== false ? 'pending' : 'disabled')) as 'pending' | 'synced' | 'failed' | 'disabled',
        quickbooksStatus: (qbId ? 'synced' : (data.syncToQuickbooks !== false ? 'pending' : 'disabled')) as 'pending' | 'synced' | 'failed' | 'disabled',
      };
      
      // Create customer in database with merged data
      const [newCustomer] = await db.insert(customers).values(mergedData).returning();

      console.log(`[CustomerService] Customer created in database: ${newCustomer.id}`);

      const result: CustomerCreateResult = {
        success: true,
        customer: newCustomer,
        customerId: newCustomer.id.toString()
      };

      // Sync to Shopify if enabled and not already synced
      if (data.syncToShopify !== false && !shopifyId) {
        try {
          console.log(`[CustomerService] Syncing customer ${newCustomer.id} to Shopify...`);
          result.shopifyResult = await this.shopifyService.createCustomer({
            email: newCustomer.email,
            firstName: newCustomer.firstName || undefined,
            lastName: newCustomer.lastName || undefined,
            phone: newCustomer.phone || undefined,
            company: newCustomer.company || undefined,
            source: newCustomer.source || undefined,
            ticketId: data.ticketId
          });

          if (result.shopifyResult.success && result.shopifyResult.customerId) {
            // Update customer with Shopify ID
            await db.update(customers)
              .set({ 
                shopifyId: BigInt(result.shopifyResult.customerId),
                shopifyStatus: 'synced',
                lastSyncedAt: new Date()
              })
              .where(eq(customers.id, newCustomer.id));

            console.log(`[CustomerService] Customer synced to Shopify: ${result.shopifyResult.customerId}`);
          } else {
            await db.update(customers)
              .set({ shopifyStatus: 'failed' })
              .where(eq(customers.id, newCustomer.id));
            
            console.error(`[CustomerService] Failed to sync to Shopify: ${result.shopifyResult.error}`);
          }

          // Log sync attempt
          await this.logSyncAttempt(newCustomer.id, 'shopify', 'create', result.shopifyResult);

        } catch (shopifyError: any) {
          console.error(`[CustomerService] Shopify sync error:`, shopifyError);
          result.shopifyResult = {
            success: false,
            error: shopifyError.message || 'Unknown Shopify error'
          };

          await db.update(customers)
            .set({ shopifyStatus: 'failed' })
            .where(eq(customers.id, newCustomer.id));
        }
      }

      // Sync to QuickBooks if enabled and not already synced
      if (data.syncToQuickbooks !== false && !qbId) {
        try {
          console.log(`[CustomerService] Syncing customer ${newCustomer.id} to QuickBooks...`);
          result.quickbooksResult = await this.quickbooksService.createCustomer({
            email: newCustomer.email,
            firstName: newCustomer.firstName || undefined,
            lastName: newCustomer.lastName || undefined,
            phone: newCustomer.phone || undefined,
            company: newCustomer.company || undefined,
            source: newCustomer.source || undefined,
            ticketId: data.ticketId
          });

          if (result.quickbooksResult.success && result.quickbooksResult.customerId) {
            // Update customer with QuickBooks ID
            await db.update(customers)
              .set({ 
                quickbooksId: result.quickbooksResult.customerId,
                quickbooksStatus: 'synced',
                lastSyncedAt: new Date()
              })
              .where(eq(customers.id, newCustomer.id));

            console.log(`[CustomerService] Customer synced to QuickBooks: ${result.quickbooksResult.customerId}`);
          } else {
            await db.update(customers)
              .set({ quickbooksStatus: 'failed' })
              .where(eq(customers.id, newCustomer.id));
              
            console.error(`[CustomerService] Failed to sync to QuickBooks: ${result.quickbooksResult.error}`);
          }

          // Log sync attempt
          await this.logSyncAttempt(newCustomer.id, 'quickbooks', 'create', result.quickbooksResult);

        } catch (qbError: any) {
          console.error(`[CustomerService] QuickBooks sync error:`, qbError);
          result.quickbooksResult = {
            success: false,
            error: qbError.message || 'Unknown QuickBooks error'
          };

          await db.update(customers)
            .set({ quickbooksStatus: 'failed' })
            .where(eq(customers.id, newCustomer.id));
        }
      }

      return result;

    } catch (error) {
      console.error('[CustomerService] Error creating customer:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create customer'
      };
    }
  }

  /**
   * Find customer by email
   */
  async findCustomerByEmail(email: string): Promise<ServiceResponse<Customer>> {
    try {
      const customer = await db.query.customers.findFirst({
        where: eq(customers.email, email.toLowerCase().trim()),
        with: {
          addresses: true
        }
      });

      if (!customer) {
        return {
          success: false,
          error: 'Customer not found'
        };
      }

      return {
        success: true,
        data: customer
      };
    } catch (error) {
      console.error('[CustomerService] Error finding customer:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find customer'
      };
    }
  }

  /**
   * Search customers with multiple criteria
   */
  async searchCustomers(params: CustomerSearchInput): Promise<ServiceResponse<Customer[]>> {
    try {
      const whereConditions = [];

      if (params.email) {
        whereConditions.push(eq(customers.email, params.email.toLowerCase()));
      }

      if (params.phone) {
        whereConditions.push(eq(customers.phone, params.phone));
      }

      if (params.company) {
        whereConditions.push(ilike(customers.company, `%${params.company}%`));
      }

      if (params.name) {
        whereConditions.push(
          or(
            ilike(customers.firstName, `%${params.name}%`),
            ilike(customers.lastName, `%${params.name}%`)
          )
        );
      }

      if (params.shopifyId) {
        whereConditions.push(eq(customers.shopifyId, BigInt(params.shopifyId)));
      }

      if (params.quickbooksId) {
        whereConditions.push(eq(customers.quickbooksId, params.quickbooksId));
      }

      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

      const results = await db.query.customers.findMany({
        where: whereClause,
        limit: params.limit,
        offset: params.offset,
        with: {
          addresses: true
        }
      });

      return {
        success: true,
        data: results
      };
    } catch (error) {
      console.error('[CustomerService] Error searching customers:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search customers'
      };
    }
  }

  /**
   * Add address to customer
   */
  async addCustomerAddress(customerId: number, addressData: CreateAddressInput): Promise<ServiceResponse<CustomerAddress>> {
    try {
      const [newAddress] = await db.insert(customerAddresses).values({
        customerId,
        name: addressData.name,
        company: addressData.company,
        country: addressData.country,
        addressLine1: addressData.addressLine1,
        addressLine2: addressData.addressLine2,
        addressLine3: addressData.addressLine3,
        city: addressData.city,
        state: addressData.state,
        postalCode: addressData.postalCode,
        phone: addressData.phone,
        email: addressData.email,
        addressType: addressData.addressType,
        isDefault: addressData.isDefault,
      }).returning();

      return {
        success: true,
        data: newAddress,
        message: 'Address added successfully'
      };
    } catch (error) {
      console.error('[CustomerService] Error adding address:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add address'
      };
    }
  }

  /**
   * Log sync attempt to external service
   */
  private async logSyncAttempt(
    customerId: number, 
    service: string, 
    operation: string, 
    result: any
  ): Promise<void> {
    try {
      await db.insert(customerSyncLog).values({
        customerId,
        service,
        operation,
        status: result.success ? 'success' : 'failed',
        externalId: result.customerId,
        responseData: JSON.stringify(result.response || result),
        errorMessage: result.error,
        completedAt: new Date()
      });
    } catch (error) {
      console.error('[CustomerService] Error logging sync attempt:', error);
    }
  }

  /**
   * Check if auto-create is enabled
   */
  isAutoCreateEnabled(): boolean {
    return process.env.CUSTOMER_AUTO_CREATE !== 'false';
  }
}