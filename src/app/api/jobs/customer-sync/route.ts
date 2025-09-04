import { NextRequest, NextResponse } from 'next/server';
import { CustomerService } from '@/services/CustomerService';
import { ShopifyIntegrationService } from '@/services/integrations/ShopifyIntegrationService';
import { QuickbooksIntegrationService } from '@/services/integrations/QuickbooksIntegrationService';
import { db, customers } from '@/db';
import { eq, isNull, or } from 'drizzle-orm';

/**
 * Customer Sync Cron Job
 * Syncs customers between Shopify and QuickBooks
 * Should run daily at midnight
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[Customer Sync] Unauthorized cron job attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Customer Sync] Starting daily customer sync...');
    
    const startTime = Date.now();
    const syncResults = {
      shopifyTotal: 0,
      quickbooksTotal: 0,
      syncedToShopify: 0,
      syncedToQuickbooks: 0,
      errors: [] as any[],
      timestamp: new Date().toISOString()
    };

    const shopifyService = new ShopifyIntegrationService();
    const quickbooksService = new QuickbooksIntegrationService();
    const customerService = new CustomerService();

    // Step 1: Fetch all customers from Shopify
    console.log('[Customer Sync] Fetching Shopify customers...');
    const shopifyCustomers = await fetchAllShopifyCustomers(shopifyService);
    syncResults.shopifyTotal = shopifyCustomers.length;
    console.log(`[Customer Sync] Found ${shopifyCustomers.length} Shopify customers`);

    // Step 2: Fetch all customers from QuickBooks
    console.log('[Customer Sync] Fetching QuickBooks customers...');
    const quickbooksCustomers = await fetchAllQuickBooksCustomers(quickbooksService);
    syncResults.quickbooksTotal = quickbooksCustomers.length;
    console.log(`[Customer Sync] Found ${quickbooksCustomers.length} QuickBooks customers`);

    // Step 3: Map customers by email
    const shopifyMap = new Map(shopifyCustomers.map(c => [c.email?.toLowerCase(), c]));
    const quickbooksMap = new Map(quickbooksCustomers.map(c => [c.email?.toLowerCase(), c]));

    // Step 4: Find customers missing in each system
    const missingInQuickbooks = [];
    const missingInShopify = [];

    // Find Shopify customers not in QuickBooks
    for (const [email, customer] of shopifyMap) {
      if (email && !quickbooksMap.has(email)) {
        missingInQuickbooks.push(customer);
      }
    }

    // Find QuickBooks customers not in Shopify
    for (const [email, customer] of quickbooksMap) {
      if (email && !shopifyMap.has(email)) {
        missingInShopify.push(customer);
      }
    }

    console.log(`[Customer Sync] Missing in QuickBooks: ${missingInQuickbooks.length}`);
    console.log(`[Customer Sync] Missing in Shopify: ${missingInShopify.length}`);

    // Step 5: Sync missing customers to QuickBooks
    for (const customer of missingInQuickbooks) {
      try {
        const result = await quickbooksService.createCustomer({
          email: customer.email,
          firstName: customer.first_name,
          lastName: customer.last_name,
          company: customer.default_address?.company,
          phone: customer.phone
        });

        if (result.success) {
          syncResults.syncedToQuickbooks++;
          console.log(`[Customer Sync] ✅ Synced ${customer.email} to QuickBooks`);
          
          // Update database record if exists
          await updateCustomerRecord(customer.email, { 
            quickbooksId: result.customerId,
            quickbooksStatus: 'synced' 
          });
        } else {
          syncResults.errors.push({
            email: customer.email,
            system: 'quickbooks',
            error: result.error
          });
        }
      } catch (error) {
        syncResults.errors.push({
          email: customer.email,
          system: 'quickbooks',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Step 6: Sync missing customers to Shopify
    for (const customer of missingInShopify) {
      try {
        const result = await shopifyService.createCustomer({
          email: customer.email,
          firstName: customer.firstName || customer.displayName?.split(' ')[0],
          lastName: customer.lastName || customer.displayName?.split(' ').slice(1).join(' '),
          company: customer.company,
          phone: customer.phone
        });

        if (result.success) {
          syncResults.syncedToShopify++;
          console.log(`[Customer Sync] ✅ Synced ${customer.email} to Shopify`);
          
          // Update database record if exists
          await updateCustomerRecord(customer.email, { 
            shopifyId: result.customerId ? BigInt(result.customerId) : null,
            shopifyStatus: 'synced' 
          });
        } else {
          syncResults.errors.push({
            email: customer.email,
            system: 'shopify',
            error: result.error
          });
        }
      } catch (error) {
        syncResults.errors.push({
          email: customer.email,
          system: 'shopify',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const duration = Date.now() - startTime;
    console.log(`[Customer Sync] Completed in ${duration}ms`);

    // Send summary to Teams if configured
    if (process.env.TEAMS_WEBHOOK_URL) {
      await sendSyncNotification(syncResults);
    }

    return NextResponse.json({
      success: true,
      results: syncResults,
      duration
    });

  } catch (error) {
    console.error('[Customer Sync] Fatal error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

/**
 * Fetch all customers from Shopify
 */
async function fetchAllShopifyCustomers(service: ShopifyIntegrationService): Promise<any[]> {
  const customers = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const result = await service.fetchCustomersPage(page, 250);
    if (result.customers && result.customers.length > 0) {
      customers.push(...result.customers);
      page++;
      hasMore = result.customers.length === 250;
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } else {
      hasMore = false;
    }
  }

  return customers;
}

/**
 * Fetch all customers from QuickBooks
 */
async function fetchAllQuickBooksCustomers(service: QuickbooksIntegrationService): Promise<any[]> {
  const customers = [];
  let startPosition = 1;
  const maxResults = 1000;
  let hasMore = true;

  while (hasMore) {
    const result = await service.fetchCustomersBatch(startPosition, maxResults);
    if (result.customers && result.customers.length > 0) {
      customers.push(...result.customers.map((c: any) => ({
        email: c.PrimaryEmailAddr?.Address,
        firstName: c.GivenName,
        lastName: c.FamilyName,
        displayName: c.DisplayName,
        company: c.CompanyName,
        phone: c.PrimaryPhone?.FreeFormNumber,
        id: c.Id
      })));
      
      if (result.customers.length === maxResults) {
        startPosition += maxResults;
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }

  return customers;
}

/**
 * Update customer record in database
 */
async function updateCustomerRecord(email: string, updates: any) {
  try {
    await db.update(customers)
      .set({
        ...updates,
        lastSyncedAt: new Date()
      })
      .where(eq(customers.email, email.toLowerCase()));
  } catch (error) {
    console.error(`[Customer Sync] Failed to update database for ${email}:`, error);
  }
}

/**
 * Send sync notification to Teams
 */
async function sendSyncNotification(results: any) {
  try {
    const message = {
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      "summary": "Daily Customer Sync Report",
      "themeColor": results.errors.length > 0 ? "FFA500" : "00FF00",
      "sections": [{
        "activityTitle": "Customer Sync Completed",
        "activitySubtitle": new Date().toLocaleString(),
        "facts": [
          {
            "name": "Shopify Customers",
            "value": results.shopifyTotal.toString()
          },
          {
            "name": "QuickBooks Customers",
            "value": results.quickbooksTotal.toString()
          },
          {
            "name": "Synced to Shopify",
            "value": results.syncedToShopify.toString()
          },
          {
            "name": "Synced to QuickBooks",
            "value": results.syncedToQuickbooks.toString()
          },
          {
            "name": "Errors",
            "value": results.errors.length.toString()
          }
        ]
      }]
    };

    await fetch(process.env.TEAMS_WEBHOOK_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
  } catch (error) {
    console.error('[Customer Sync] Failed to send Teams notification:', error);
  }
}