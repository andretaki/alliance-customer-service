import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { customers, customerAddresses } from '@/db';
import { customerSyncLog } from '@/db';
import { eq, and, ne } from 'drizzle-orm';
import { ShopifyIntegrationService } from '@/services/integrations/ShopifyIntegrationService';

interface CustomerSyncRequest {
  email: string;
  name?: string;
  phone?: string;
  company?: string;
  address?: {
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  source?: string;
  createIfNotFound?: boolean; // Default true
}

// POST /api/customers/sync - Full customer sync across all systems
export async function POST(request: NextRequest) {
  try {
    const body: CustomerSyncRequest = await request.json();
    
    if (!body.email && !body.phone) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Email or phone is required for customer sync' 
        }, 
        { status: 400 }
      );
    }

    const createIfNotFound = body.createIfNotFound !== false; // Default to true
    
    const syncResult = {
      localCustomer: null as any,
      shopifyCustomer: null as any,
      newlyCreated: {
        local: false,
        shopify: false,
        
      },
      enrichedData: {
        name: body.name || null,
        company: body.company || null,
        phone: body.phone || null,
        email: body.email,
        addresses: [] as any[],
        orderHistory: [] as any[],
        totalSpent: 0,
        lastOrderDate: null as string | null,
        tags: [] as string[],
        notes: [] as string[]
      },
      syncLogs: [] as any[]
    };

    // 1. Check local database first
    const localCustomers = await db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.email, body.email),
          ne(customers.status, 'archived')
        )
      )
      .limit(1);

    if (localCustomers.length > 0) {
      syncResult.localCustomer = localCustomers[0];
      // Use existing data as base
      const firstName = localCustomers[0].firstName || '';
      const lastName = localCustomers[0].lastName || '';
      const fullName = `${firstName} ${lastName}`.trim();
      syncResult.enrichedData.name = fullName || syncResult.enrichedData.name;
      syncResult.enrichedData.company = localCustomers[0].company || syncResult.enrichedData.company;
      syncResult.enrichedData.phone = localCustomers[0].phone || syncResult.enrichedData.phone;
    }

    // 2. Search/Create in Shopify (email OR phone)
    const shopifyService = new ShopifyIntegrationService();
    try {
      let shopifyResult = await shopifyService.findCustomerByEmailOrPhone(body.email, body.phone);
      
      if (!shopifyResult.success && createIfNotFound) {
        // Create in Shopify
        shopifyResult = await shopifyService.createCustomer({
          email: body.email,
          firstName: body.name?.split(' ')[0],
          lastName: body.name?.split(' ').slice(1).join(' '),
          phone: body.phone,
          company: body.company,
          source: body.source || 'intake',
        });
        
        if (shopifyResult.success) {
          syncResult.newlyCreated.shopify = true;
          await db.insert(customerSyncLog).values({
            customerId: syncResult.localCustomer?.id || 0,
            service: 'shopify',
            operation: 'create',
            status: 'success',
            responseData: JSON.stringify(shopifyResult.response)
          });
        } else {
          // record failure for visibility
          syncResult.syncLogs.push({
            service: 'shopify',
            action: 'create',
            success: false,
            error: shopifyResult.error || 'Unknown Shopify create error'
          });
        }
      }
      
      if (shopifyResult.success && shopifyResult.response) {
        syncResult.shopifyCustomer = shopifyResult.response;
        const shopifyData = shopifyResult.response;
        
        // Extract and merge Shopify data
        if (shopifyData.first_name || shopifyData.last_name) {
          const shopifyName = `${shopifyData.first_name || ''} ${shopifyData.last_name || ''}`.trim();
          if (shopifyName && !syncResult.enrichedData.name) {
            syncResult.enrichedData.name = shopifyName;
          }
        }
        
        if (shopifyData.company && !syncResult.enrichedData.company) {
          syncResult.enrichedData.company = shopifyData.company;
        }
        
        if (shopifyData.phone && !syncResult.enrichedData.phone) {
          syncResult.enrichedData.phone = shopifyData.phone;
        }
        
        // Add Shopify addresses
        if (shopifyData.addresses && Array.isArray(shopifyData.addresses)) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
          shopifyData.addresses.forEach((addr: any) => {
            syncResult.enrichedData.addresses.push({
              source: 'Shopify',
              type: addr.default ? 'primary' : 'additional',
              address1: addr.address1,
              address2: addr.address2,
              city: addr.city,
              state: addr.province,
              zip: addr.zip,
              country: addr.country,
              phone: addr.phone
            });
          });
        }
        
        // Add order statistics
        if (shopifyData.orders_count) {
          syncResult.enrichedData.orderHistory.push({
            source: 'Shopify',
            orderCount: shopifyData.orders_count,
            totalSpent: shopifyData.total_spent,
            currency: shopifyData.currency
          });
          syncResult.enrichedData.totalSpent += parseFloat(shopifyData.total_spent || '0');
        }
        
        if (shopifyData.last_order_date) {
          syncResult.enrichedData.lastOrderDate = shopifyData.last_order_date;
        }
        
        if (shopifyData.tags) {
          syncResult.enrichedData.tags.push(...shopifyData.tags.split(',').map((t: string) => t.trim()));
        }
        
        if (shopifyData.note) {
          syncResult.enrichedData.notes.push(`Shopify: ${shopifyData.note}`);
        }
      }
    } catch (error) {
      console.error('Shopify sync error:', error);
      syncResult.syncLogs.push({
        service: 'shopify',
        action: 'sync',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // If we are expected to create the customer but couldn't in Shopify, fail the request
    if (!syncResult.shopifyCustomer && createIfNotFound) {
      return NextResponse.json({
        success: false,
        error: 'Shopify customer not found and creation failed',
        logs: syncResult.syncLogs
      }, { status: 502 });
    }

    // 3. QuickBooks intentionally not used

    // 4. Create or update local customer record
    if (!syncResult.localCustomer) {
      // Create new local customer with all synced data
      const newCustomer = await db
        .insert(customers)
        .values({
          email: body.email,
          firstName: syncResult.enrichedData.name?.split(' ')[0] || body.name?.split(' ')[0] || null,
          lastName: syncResult.enrichedData.name?.split(' ').slice(1).join(' ') || body.name?.split(' ').slice(1).join(' ') || null,
          phone: syncResult.enrichedData.phone || body.phone || null,
          company: syncResult.enrichedData.company || body.company || null,
          shopifyId: syncResult.shopifyCustomer?.id ? BigInt(syncResult.shopifyCustomer.id) : null,
          
          source: body.source || 'intake-sync',
          notes: syncResult.enrichedData.notes.join('\n') || null,
          tags: JSON.stringify(syncResult.enrichedData.tags),
        })
        .returning();
      
      syncResult.localCustomer = newCustomer[0];
      syncResult.newlyCreated.local = true;
      
      // Add addresses from external systems
      for (const addr of syncResult.enrichedData.addresses) {
        if (addr.address1) {
          await db.insert(customerAddresses).values({
            customerId: newCustomer[0].id,
            addressType: addr.type === 'primary' ? 'shipping' : 'billing',
            addressLine1: addr.address1,
            addressLine2: addr.address2 || null,
            city: addr.city,
            state: addr.state || null,
            postalCode: addr.zip || '',
            country: addr.country || 'US'
          });
        }
      }
      
      // Add the provided address if it's new
      if (body.address?.address1) {
        const addressExists = syncResult.enrichedData.addresses.some(
          a => a.address1?.toLowerCase() === body.address?.address1?.toLowerCase()
        );
        
        if (!addressExists && body.address.address1) {
          await db.insert(customerAddresses).values({
            customerId: newCustomer[0].id,
            addressType: 'shipping',
            addressLine1: body.address.address1,
            addressLine2: body.address.address2 || null,
            city: body.address.city || 'Unknown',
            state: body.address.state || null,
            postalCode: body.address.zip || '00000',
            country: body.address.country || 'US'
          });
        }
      }
    } else {
      // Update existing customer with new data from external systems
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updates: any = {
        updatedAt: new Date()
      };
      
      // Update external IDs if missing
      if (syncResult.shopifyCustomer && !syncResult.localCustomer.shopifyId) {
        updates.shopifyId = syncResult.shopifyCustomer.id ? BigInt(syncResult.shopifyCustomer.id) : null;
      }
      
      
      // Update enriched fields if they were empty
      if (syncResult.enrichedData.name && (!syncResult.localCustomer.firstName || !syncResult.localCustomer.lastName)) {
        const nameParts = syncResult.enrichedData.name.split(' ');
        updates.firstName = nameParts[0] || null;
        updates.lastName = nameParts.slice(1).join(' ') || null;
      }
      if (!syncResult.localCustomer.company && syncResult.enrichedData.company) {
        updates.company = syncResult.enrichedData.company;
      }
      if (!syncResult.localCustomer.phone && syncResult.enrichedData.phone) {
        updates.phone = syncResult.enrichedData.phone;
      }
      
      // Update data field with latest info
      updates.data = {
        ...(syncResult.localCustomer.data as any || {}),
        tags: syncResult.enrichedData.tags,
        orderHistory: syncResult.enrichedData.orderHistory,
        totalSpent: syncResult.enrichedData.totalSpent,
        lastOrderDate: syncResult.enrichedData.lastOrderDate,
        lastSyncedAt: new Date().toISOString()
      };
      
      if (Object.keys(updates).length > 1) { // More than just updatedAt
        await db
          .update(customers)
          .set(updates)
          .where(eq(customers.id, syncResult.localCustomer.id));
      }
      
      // Add any new addresses
      for (const addr of syncResult.enrichedData.addresses) {
        if (addr.address1) {
          // Check if address already exists
          const existingAddresses = await db
            .select()
            .from(customerAddresses)
            .where(
              and(
                eq(customerAddresses.customerId, syncResult.localCustomer.id),
                eq(customerAddresses.addressLine1, addr.address1)
              )
            );
          
          if (existingAddresses.length === 0) {
            await db.insert(customerAddresses).values({
              customerId: syncResult.localCustomer.id,
              addressType: 'shipping',
              addressLine1: addr.address1,
              addressLine2: addr.address2 || null,
              city: addr.city || '',
              state: addr.state || null,
              postalCode: addr.zip || '00000',
              country: addr.country || 'US'
            });
          }
        }
      }
    }

    // Determine failures (for logging only)
    const hasExternalFailure = syncResult.syncLogs.some((l: any) => l?.success === false);

    // Return comprehensive sync result
    return NextResponse.json({
      success: true,
      partial: undefined,
      customer: {
        id: syncResult.localCustomer.id,
        email: syncResult.localCustomer.email,
        name: syncResult.enrichedData.name || `${syncResult.localCustomer.firstName || ''} ${syncResult.localCustomer.lastName || ''}`.trim() || null,
        company: syncResult.enrichedData.company || syncResult.localCustomer.company,
        phone: syncResult.enrichedData.phone || syncResult.localCustomer.phone,
        shopifyId: syncResult.localCustomer.shopifyId?.toString() || undefined,
        
      },
      enrichedData: syncResult.enrichedData,
      syncStatus: {
        local: syncResult.newlyCreated.local ? 'created' : 'existing',
        shopify: syncResult.shopifyCustomer 
          ? (syncResult.newlyCreated.shopify ? 'created' : 'existing')
          : 'not_found'
      },
      externalData: {
        shopify: syncResult.shopifyCustomer ? {
          id: syncResult.shopifyCustomer.id,
          email: syncResult.shopifyCustomer.email,
          ordersCount: syncResult.shopifyCustomer.orders_count,
          totalSpent: syncResult.shopifyCustomer.total_spent,
          tags: syncResult.shopifyCustomer.tags,
          createdAt: syncResult.shopifyCustomer.created_at
        } : null,
        
      },
      errors: hasExternalFailure ? syncResult.syncLogs.filter((l: any) => l?.success === false) : undefined,
      logs: syncResult.syncLogs
    });

  } catch (error) {
    console.error('[POST /api/customers/sync] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Customer sync failed' 
      }, 
      { status: 500 }
    );
  }
}
