#!/usr/bin/env node

/**
 * Elegant Customer Sync Utility
 * Synchronizes customers between Shopify and QuickBooks based on email addresses
 * Maps and creates missing customers in both systems
 */

const axios = require('axios');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

// Configuration
const SHOPIFY_STORE = process.env.SHOPIFY_STORE || process.env.SHOPIFY_STORE_URL;
const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
const SHOPIFY_URL = SHOPIFY_STORE?.startsWith('http') ? SHOPIFY_STORE : `https://${SHOPIFY_STORE}`;

const QB_CLIENT_ID = process.env.QBO_CLIENT_ID;
const QB_CLIENT_SECRET = process.env.QBO_CLIENT_SECRET;
const QB_ACCESS_TOKEN = process.env.QBO_ACCESS_TOKEN;
const QB_REALM_ID = process.env.QBO_REALM_ID;
const QB_ENVIRONMENT = process.env.QBO_ENVIRONMENT || 'sandbox';
const QB_BASE_URL = QB_ENVIRONMENT === 'production' 
  ? 'https://quickbooks.api.intuit.com'
  : 'https://sandbox-quickbooks.api.intuit.com';

// Sync statistics
const stats = {
  shopifyTotal: 0,
  quickbooksTotal: 0,
  commonCustomers: 0,
  shopifyOnly: 0,
  quickbooksOnly: 0,
  syncedToShopify: 0,
  syncedToQuickbooks: 0,
  errors: []
};

// Customer maps
const customerMap = {
  shopify: new Map(),      // email -> customer object
  quickbooks: new Map(),    // email -> customer object
  combined: new Map()       // email -> { shopify, quickbooks }
};

/**
 * Fetch all customers from Shopify
 */
async function fetchShopifyCustomers() {
  console.log('\n📥 Fetching Shopify Customers...');
  const customers = [];
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    try {
      const response = await axios.get(
        `${SHOPIFY_URL}/admin/api/2024-01/customers.json?limit=250&page=${page}`,
        {
          headers: {
            'X-Shopify-Access-Token': SHOPIFY_TOKEN,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data.customers && response.data.customers.length > 0) {
        customers.push(...response.data.customers);
        console.log(`   Page ${page}: ${response.data.customers.length} customers`);
        page++;
        
        // Shopify rate limiting - wait between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        hasMore = false;
      }
    } catch (error) {
      console.error(`   Error fetching page ${page}:`, error.message);
      hasMore = false;
    }
  }
  
  console.log(`   ✅ Total: ${customers.length} customers`);
  stats.shopifyTotal = customers.length;
  
  // Map customers by email
  customers.forEach(customer => {
    if (customer.email) {
      const email = customer.email.toLowerCase();
      customerMap.shopify.set(email, {
        id: customer.id,
        email: customer.email,
        firstName: customer.first_name || '',
        lastName: customer.last_name || '',
        company: customer.default_address?.company || '',
        phone: customer.phone || customer.default_address?.phone || '',
        tags: customer.tags || '',
        createdAt: customer.created_at,
        source: 'shopify'
      });
    }
  });
  
  return customers;
}

/**
 * Fetch all customers from QuickBooks
 */
async function fetchQuickBooksCustomers() {
  console.log('\n📥 Fetching QuickBooks Customers...');
  const customers = [];
  let startPosition = 1;
  const maxResults = 1000;
  let hasMore = true;
  
  while (hasMore) {
    try {
      const query = `SELECT * FROM Customer STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;
      const response = await axios.get(
        `${QB_BASE_URL}/v3/company/${QB_REALM_ID}/query?query=${encodeURIComponent(query)}`,
        {
          headers: {
            'Authorization': `Bearer ${QB_ACCESS_TOKEN}`,
            'Accept': 'application/json'
          }
        }
      );
      
      if (response.data.QueryResponse?.Customer) {
        const batch = response.data.QueryResponse.Customer;
        customers.push(...batch);
        console.log(`   Batch ${Math.ceil(startPosition / maxResults)}: ${batch.length} customers`);
        
        if (batch.length === maxResults) {
          startPosition += maxResults;
          // QuickBooks rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } else {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    } catch (error) {
      if (error.response?.status === 401) {
        console.error('   ❌ QuickBooks token expired. Please refresh the token first.');
        console.log('   Run: node refresh-qbo-token.js');
      } else {
        console.error(`   Error fetching customers:`, error.message);
      }
      hasMore = false;
    }
  }
  
  console.log(`   ✅ Total: ${customers.length} customers`);
  stats.quickbooksTotal = customers.length;
  
  // Map customers by email
  customers.forEach(customer => {
    const email = customer.PrimaryEmailAddr?.Address;
    if (email) {
      const emailLower = email.toLowerCase();
      customerMap.quickbooks.set(emailLower, {
        id: customer.Id,
        email: email,
        firstName: customer.GivenName || '',
        lastName: customer.FamilyName || '',
        displayName: customer.DisplayName,
        company: customer.CompanyName || '',
        phone: customer.PrimaryPhone?.FreeFormNumber || '',
        createdAt: customer.MetaData?.CreateTime,
        source: 'quickbooks'
      });
    }
  });
  
  return customers;
}

/**
 * Map and identify differences
 */
function mapCustomerDifferences() {
  console.log('\n🗺️  Mapping Customer Differences...');
  
  // Find customers in both systems
  for (const [email, shopifyCustomer] of customerMap.shopify) {
    const qbCustomer = customerMap.quickbooks.get(email);
    
    if (qbCustomer) {
      // Customer exists in both
      customerMap.combined.set(email, {
        email,
        shopify: shopifyCustomer,
        quickbooks: qbCustomer,
        status: 'synced'
      });
      stats.commonCustomers++;
    } else {
      // Customer only in Shopify
      customerMap.combined.set(email, {
        email,
        shopify: shopifyCustomer,
        quickbooks: null,
        status: 'shopify_only'
      });
      stats.shopifyOnly++;
    }
  }
  
  // Find customers only in QuickBooks
  for (const [email, qbCustomer] of customerMap.quickbooks) {
    if (!customerMap.shopify.has(email)) {
      customerMap.combined.set(email, {
        email,
        shopify: null,
        quickbooks: qbCustomer,
        status: 'quickbooks_only'
      });
      stats.quickbooksOnly++;
    }
  }
  
  console.log(`   ✅ Mapped ${customerMap.combined.size} unique customers`);
  console.log(`   📊 In Both Systems: ${stats.commonCustomers}`);
  console.log(`   🛍️  Shopify Only: ${stats.shopifyOnly}`);
  console.log(`   💼 QuickBooks Only: ${stats.quickbooksOnly}`);
}

/**
 * Create customer in Shopify
 */
async function createShopifyCustomer(customer) {
  try {
    const shopifyData = {
      customer: {
        email: customer.email,
        first_name: customer.firstName || customer.displayName?.split(' ')[0] || '',
        last_name: customer.lastName || customer.displayName?.split(' ').slice(1).join(' ') || '',
        phone: customer.phone || '',
        tags: 'synced-from-quickbooks',
        note: `Synced from QuickBooks on ${new Date().toISOString()}`
      }
    };
    
    if (customer.company) {
      shopifyData.customer.addresses = [{
        company: customer.company
      }];
    }
    
    const response = await axios.post(
      `${SHOPIFY_URL}/admin/api/2024-01/customers.json`,
      shopifyData,
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return {
      success: true,
      id: response.data.customer.id,
      email: response.data.customer.email
    };
    
  } catch (error) {
    if (error.response?.data?.errors?.email?.[0] === 'has already been taken') {
      // Customer already exists, try to find them
      return { success: true, alreadyExists: true };
    }
    return {
      success: false,
      error: error.response?.data?.errors || error.message
    };
  }
}

/**
 * Create customer in QuickBooks
 */
async function createQuickBooksCustomer(customer) {
  try {
    const displayName = customer.company || 
                       `${customer.firstName} ${customer.lastName}`.trim() || 
                       customer.email.split('@')[0];
    
    const qbData = {
      DisplayName: displayName,
      PrimaryEmailAddr: {
        Address: customer.email
      }
    };
    
    if (customer.firstName) {
      qbData.GivenName = customer.firstName;
    }
    
    if (customer.lastName) {
      qbData.FamilyName = customer.lastName;
    }
    
    if (customer.company) {
      qbData.CompanyName = customer.company;
    }
    
    if (customer.phone) {
      qbData.PrimaryPhone = {
        FreeFormNumber: customer.phone
      };
    }
    
    const response = await axios.post(
      `${QB_BASE_URL}/v3/company/${QB_REALM_ID}/customer`,
      qbData,
      {
        headers: {
          'Authorization': `Bearer ${QB_ACCESS_TOKEN}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );
    
    return {
      success: true,
      id: response.data.Customer.Id,
      displayName: response.data.Customer.DisplayName
    };
    
  } catch (error) {
    if (error.response?.status === 401) {
      return {
        success: false,
        error: 'QuickBooks token expired'
      };
    }
    return {
      success: false,
      error: error.response?.data?.Fault?.Error?.[0]?.Message || error.message
    };
  }
}

/**
 * Sync missing customers
 */
async function syncMissingCustomers(dryRun = false) {
  console.log('\n🔄 Syncing Missing Customers...');
  
  if (dryRun) {
    console.log('   ⚠️  DRY RUN MODE - No changes will be made\n');
  }
  
  const shopifyOnlyCustomers = Array.from(customerMap.combined.values())
    .filter(c => c.status === 'shopify_only');
  
  const quickbooksOnlyCustomers = Array.from(customerMap.combined.values())
    .filter(c => c.status === 'quickbooks_only');
  
  // Sync Shopify-only customers to QuickBooks
  if (shopifyOnlyCustomers.length > 0) {
    console.log(`\n   🛍️➡️💼 Syncing ${shopifyOnlyCustomers.length} customers from Shopify to QuickBooks...`);
    
    for (const { shopify } of shopifyOnlyCustomers) {
      process.stdout.write(`      ${shopify.email}... `);
      
      if (dryRun) {
        console.log('(skipped - dry run)');
      } else {
        const result = await createQuickBooksCustomer(shopify);
        if (result.success) {
          console.log(`✅ (QB ID: ${result.id || 'exists'})`);
          stats.syncedToQuickbooks++;
        } else {
          console.log(`❌ (${result.error})`);
          stats.errors.push({ email: shopify.email, system: 'quickbooks', error: result.error });
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
  }
  
  // Sync QuickBooks-only customers to Shopify
  if (quickbooksOnlyCustomers.length > 0) {
    console.log(`\n   💼➡️🛍️ Syncing ${quickbooksOnlyCustomers.length} customers from QuickBooks to Shopify...`);
    
    for (const { quickbooks } of quickbooksOnlyCustomers) {
      process.stdout.write(`      ${quickbooks.email}... `);
      
      if (dryRun) {
        console.log('(skipped - dry run)');
      } else {
        const result = await createShopifyCustomer(quickbooks);
        if (result.success) {
          console.log(`✅ (Shopify ID: ${result.id || 'exists'})`);
          stats.syncedToShopify++;
        } else {
          console.log(`❌ (${result.error})`);
          stats.errors.push({ email: quickbooks.email, system: 'shopify', error: result.error });
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }
}

/**
 * Generate sync report
 */
function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 CUSTOMER SYNC REPORT');
  console.log('='.repeat(60));
  
  console.log('\n📈 Statistics:');
  console.log(`   Total Shopify Customers: ${stats.shopifyTotal}`);
  console.log(`   Total QuickBooks Customers: ${stats.quickbooksTotal}`);
  console.log(`   Customers in Both Systems: ${stats.commonCustomers}`);
  console.log(`   Shopify Only: ${stats.shopifyOnly}`);
  console.log(`   QuickBooks Only: ${stats.quickbooksOnly}`);
  
  console.log('\n✅ Sync Results:');
  console.log(`   Synced to Shopify: ${stats.syncedToShopify}`);
  console.log(`   Synced to QuickBooks: ${stats.syncedToQuickbooks}`);
  
  if (stats.errors.length > 0) {
    console.log('\n❌ Errors:');
    stats.errors.forEach(err => {
      console.log(`   ${err.email} (${err.system}): ${err.error}`);
    });
  }
  
  // Save detailed report
  const report = {
    timestamp: new Date().toISOString(),
    statistics: stats,
    customers: {
      synced: Array.from(customerMap.combined.values())
        .filter(c => c.status === 'synced')
        .map(c => ({
          email: c.email,
          shopifyId: c.shopify?.id,
          quickbooksId: c.quickbooks?.id
        })),
      shopifyOnly: Array.from(customerMap.combined.values())
        .filter(c => c.status === 'shopify_only')
        .map(c => ({
          email: c.email,
          name: `${c.shopify.firstName} ${c.shopify.lastName}`.trim(),
          company: c.shopify.company
        })),
      quickbooksOnly: Array.from(customerMap.combined.values())
        .filter(c => c.status === 'quickbooks_only')
        .map(c => ({
          email: c.email,
          name: c.quickbooks.displayName,
          company: c.quickbooks.company
        }))
    }
  };
  
  fs.writeFileSync('customer-sync-report.json', JSON.stringify(report, null, 2));
  console.log('\n📁 Detailed report saved to customer-sync-report.json');
}

/**
 * Main sync process
 */
async function main() {
  console.log('🚀 CUSTOMER SYNC UTILITY');
  console.log('='.repeat(60));
  console.log('Syncing customers between Shopify and QuickBooks\n');
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const skipShopify = args.includes('--skip-shopify');
  const skipQuickbooks = args.includes('--skip-quickbooks');
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }
  
  try {
    // Validate configuration
    if (!SHOPIFY_TOKEN || !SHOPIFY_STORE) {
      console.error('❌ Shopify credentials not configured');
      if (!skipShopify) {
        process.exit(1);
      }
    }
    
    if (!QB_ACCESS_TOKEN || !QB_REALM_ID) {
      console.error('❌ QuickBooks credentials not configured');
      if (!skipQuickbooks) {
        process.exit(1);
      }
    }
    
    // Fetch customers from both systems
    if (!skipShopify) {
      await fetchShopifyCustomers();
    }
    
    if (!skipQuickbooks) {
      await fetchQuickBooksCustomers();
    }
    
    // Map differences
    mapCustomerDifferences();
    
    // Ask for confirmation
    if (!dryRun && (stats.shopifyOnly > 0 || stats.quickbooksOnly > 0)) {
      console.log('\n⚠️  This will create:');
      if (stats.quickbooksOnly > 0) {
        console.log(`   ${stats.quickbooksOnly} customers in Shopify`);
      }
      if (stats.shopifyOnly > 0) {
        console.log(`   ${stats.shopifyOnly} customers in QuickBooks`);
      }
      
      console.log('\nPress Enter to continue or Ctrl+C to cancel...');
      await new Promise(resolve => {
        process.stdin.once('data', resolve);
      });
    }
    
    // Sync missing customers
    await syncMissingCustomers(dryRun);
    
    // Generate report
    generateReport();
    
    console.log('\n✅ Sync complete!');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Help text
if (process.argv.includes('--help')) {
  console.log(`
Customer Sync Utility
=====================

Usage: node sync-customers.js [options]

Options:
  --dry-run         Preview changes without making them
  --skip-shopify    Skip fetching from Shopify
  --skip-quickbooks Skip fetching from QuickBooks
  --help           Show this help message

Examples:
  node sync-customers.js              # Full sync
  node sync-customers.js --dry-run    # Preview only
  `);
  process.exit(0);
}

// Run the sync
main();