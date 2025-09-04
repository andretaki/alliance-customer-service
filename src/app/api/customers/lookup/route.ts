import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { customers } from '@/db';
import { eq, or, and, ne } from 'drizzle-orm';
import { ShopifyIntegrationService } from '@/services/integrations/ShopifyIntegrationService';
import { QuickbooksIntegrationService } from '@/services/integrations/QuickbooksIntegrationService';

// GET /api/customers/lookup?email=xxx&phone=xxx - Comprehensive customer lookup
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');
    const phone = searchParams.get('phone');

    if (!email && !phone) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Email or phone required for lookup' 
        }, 
        { status: 400 }
      );
    }

    const results = {
      localCustomer: null as any,
      shopifyCustomer: null as any,
      quickbooksCustomer: null as any,
      enrichedData: {
        name: null as string | null,
        company: null as string | null,
        addresses: [] as any[],
        orderHistory: [] as any[],
        totalSpent: 0,
        lastOrderDate: null as string | null,
      }
    };

    // 1. Check local database first
    const conditions = [];
    if (email) conditions.push(eq(customers.email, email));
    if (phone) conditions.push(eq(customers.phone, phone));
    
    const localCustomers = await db
      .select()
      .from(customers)
      .where(
        and(
          or(...conditions),
          ne(customers.status, 'archived')
        )
      )
      .limit(1);

    if (localCustomers.length > 0) {
      results.localCustomer = localCustomers[0];
      const firstName = localCustomers[0].firstName || '';
      const lastName = localCustomers[0].lastName || '';
      results.enrichedData.name = `${firstName} ${lastName}`.trim();
      results.enrichedData.company = localCustomers[0].company;
    }

    // 2. Search Shopify for customer data
    const shopifyService = new ShopifyIntegrationService();
    if (email) {
      try {
        const shopifyResult = await shopifyService.findCustomerByEmail(email);
        if (shopifyResult.success && shopifyResult.response) {
          results.shopifyCustomer = shopifyResult.response;
          
          // Extract enriched data from Shopify
          const shopifyData = shopifyResult.response;
          if (!results.enrichedData.name && (shopifyData.first_name || shopifyData.last_name)) {
            results.enrichedData.name = `${shopifyData.first_name || ''} ${shopifyData.last_name || ''}`.trim();
          }
          if (!results.enrichedData.company && shopifyData.company) {
            results.enrichedData.company = shopifyData.company;
          }
          
          // Add Shopify addresses
          if (shopifyData.addresses && Array.isArray(shopifyData.addresses)) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
            results.enrichedData.addresses.push(...shopifyData.addresses.map((addr: any) => ({
              source: 'Shopify',
              address1: addr.address1,
              address2: addr.address2,
              city: addr.city,
              state: addr.province,
              zip: addr.zip,
              country: addr.country,
              isDefault: addr.default
            })));
          }
          
          // Add order statistics
          if (shopifyData.orders_count) {
            results.enrichedData.orderHistory.push({
              source: 'Shopify',
              orderCount: shopifyData.orders_count,
              totalSpent: shopifyData.total_spent
            });
            results.enrichedData.totalSpent += parseFloat(shopifyData.total_spent || '0');
          }
          
          if (shopifyData.last_order_date) {
            results.enrichedData.lastOrderDate = shopifyData.last_order_date;
          }
        }
      } catch (error) {
        console.error('Shopify lookup error:', error);
      }
    }

    // 3. Search QuickBooks for customer data
    const quickbooksService = new QuickbooksIntegrationService();
    if (email) {
      try {
        const quickbooksResult = await quickbooksService.findCustomerByEmail(email);
        if (quickbooksResult.success && quickbooksResult.response) {
          results.quickbooksCustomer = quickbooksResult.response;
          
          // Extract enriched data from QuickBooks
          const qbData = quickbooksResult.response;
          if (!results.enrichedData.name && qbData.Name) {
            results.enrichedData.name = qbData.Name;
          }
          if (!results.enrichedData.company && qbData.CompanyName) {
            results.enrichedData.company = qbData.CompanyName;
          }
          
          // Add QuickBooks addresses
          if (qbData.BillAddr) {
            results.enrichedData.addresses.push({
              source: 'QuickBooks',
              type: 'billing',
              address1: qbData.BillAddr.Line1,
              address2: qbData.BillAddr.Line2,
              city: qbData.BillAddr.City,
              state: qbData.BillAddr.CountrySubDivisionCode,
              zip: qbData.BillAddr.PostalCode,
              country: qbData.BillAddr.Country
            });
          }
          if (qbData.ShipAddr) {
            results.enrichedData.addresses.push({
              source: 'QuickBooks',
              type: 'shipping',
              address1: qbData.ShipAddr.Line1,
              address2: qbData.ShipAddr.Line2,
              city: qbData.ShipAddr.City,
              state: qbData.ShipAddr.CountrySubDivisionCode,
              zip: qbData.ShipAddr.PostalCode,
              country: qbData.ShipAddr.Country
            });
          }
          
          // Add QuickBooks balance info
          if (qbData.Balance) {
            results.enrichedData.orderHistory.push({
              source: 'QuickBooks',
              outstandingBalance: qbData.Balance
            });
          }
        }
      } catch (error) {
        console.error('QuickBooks lookup error:', error);
      }
    }

    // 4. If we found customer data but don't have them locally, create/update local record
    if (!results.localCustomer && (results.shopifyCustomer || results.quickbooksCustomer)) {
      // Create local customer record with external IDs
      const newCustomer = await db
        .insert(customers)
        .values({
          email: email!,
          phone: phone || null,
          firstName: results.enrichedData.name?.split(' ')[0] || null,
          lastName: results.enrichedData.name?.split(' ').slice(1).join(' ') || null,
          company: results.enrichedData.company,
          shopifyId: results.shopifyCustomer?.id ? BigInt(results.shopifyCustomer.id) : null,
          quickbooksId: results.quickbooksCustomer?.Id || null,
          source: 'intake-lookup',
        })
        .returning();
      
      results.localCustomer = newCustomer[0];
    } else if (results.localCustomer && (results.shopifyCustomer || results.quickbooksCustomer)) {
      // Update local customer with any missing external IDs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updates: any = {};
      if (results.shopifyCustomer && !results.localCustomer.shopifyId) {
        updates.shopifyId = results.shopifyCustomer.id ? BigInt(results.shopifyCustomer.id) : null;
      }
      if (results.quickbooksCustomer && !results.localCustomer.quickbooksId) {
        updates.quickbooksId = results.quickbooksCustomer.Id;
      }
      
      if (Object.keys(updates).length > 0) {
        await db
          .update(customers)
          .set({
            ...updates,
            updatedAt: new Date()
          })
          .where(eq(customers.id, results.localCustomer.id));
      }
    }

    // Return comprehensive customer data
    return NextResponse.json({
      success: true,
      found: !!(results.localCustomer || results.shopifyCustomer || results.quickbooksCustomer),
      customer: results.localCustomer,
      externalData: {
        shopify: results.shopifyCustomer ? {
          id: results.shopifyCustomer.id,
          email: results.shopifyCustomer.email,
          name: `${results.shopifyCustomer.first_name || ''} ${results.shopifyCustomer.last_name || ''}`.trim(),
          company: results.shopifyCustomer.company,
          ordersCount: results.shopifyCustomer.orders_count,
          totalSpent: results.shopifyCustomer.total_spent,
          tags: results.shopifyCustomer.tags
        } : null,
        quickbooks: results.quickbooksCustomer ? {
          id: results.quickbooksCustomer.Id,
          name: results.quickbooksCustomer.Name,
          company: results.quickbooksCustomer.CompanyName,
          email: results.quickbooksCustomer.PrimaryEmailAddr?.Address,
          phone: results.quickbooksCustomer.PrimaryPhone?.FreeFormNumber,
          balance: results.quickbooksCustomer.Balance
        } : null
      },
      enrichedData: results.enrichedData,
      message: results.localCustomer 
        ? 'Existing customer found' 
        : (results.shopifyCustomer || results.quickbooksCustomer)
          ? 'Customer found in external systems and synced locally'
          : 'No customer found'
    });

  } catch (error) {
    console.error('[GET /api/customers/lookup] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Lookup failed' 
      }, 
      { status: 500 }
    );
  }
}