#!/usr/bin/env node

/**
 * Test Shopify Integration Only
 */

const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

const API_BASE_URL = 'http://localhost:3002';

async function createShopifyCustomer() {
  console.log('🛍️ Testing Shopify Customer Creation');
  console.log('=====================================\n');
  
  const testEmail = `test.shopify.${Date.now()}@alliancechemical.com`;
  
  const customerData = {
    email: testEmail,
    firstName: 'Shopify',
    lastName: 'Test',
    company: 'Alliance Test Company',
    phone: '555-123-4567',
    source: 'manual',
    syncToShopify: true,
    syncToQuickbooks: false,  // Disable QB sync for this test
    tags: ['test', 'shopify-integration']
  };
  
  console.log('📝 Creating customer with:');
  console.log(`   Email: ${customerData.email}`);
  console.log(`   Name: ${customerData.firstName} ${customerData.lastName}`);
  console.log(`   Company: ${customerData.company}`);
  console.log(`   Sync to Shopify: ✅`);
  console.log(`   Sync to QuickBooks: ❌\n`);
  
  try {
    // Create customer via API
    const response = await axios.post(
      `${API_BASE_URL}/api/customers`,
      customerData,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        validateStatus: () => true // Don't throw on any status
      }
    );
    
    console.log(`Response Status: ${response.status}`);
    
    if (response.status === 200 || response.status === 201) {
      console.log('\n✅ Customer Created Successfully!');
      
      const data = response.data;
      if (data.data) {
        console.log(`   Database ID: ${data.data.id}`);
        console.log(`   Email: ${data.data.email}`);
      }
      
      if (data.shopifyResult?.success) {
        console.log(`   ✅ Shopify ID: ${data.shopifyResult.customerId}`);
      } else if (data.shopifyResult) {
        console.log(`   ❌ Shopify Sync Failed: ${data.shopifyResult.error}`);
      }
      
      // Now verify in Shopify directly
      console.log('\n🔍 Verifying in Shopify...');
      const shopifyStore = process.env.SHOPIFY_STORE || process.env.SHOPIFY_STORE_URL;
      const shopifyToken = process.env.SHOPIFY_ACCESS_TOKEN || process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
      const shopifyUrl = shopifyStore?.startsWith('http') ? shopifyStore : `https://${shopifyStore}`;
      
      const searchResponse = await axios.get(
        `${shopifyUrl}/admin/api/2024-01/customers/search.json?query=email:${testEmail}`,
        {
          headers: {
            'X-Shopify-Access-Token': shopifyToken,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (searchResponse.data.customers && searchResponse.data.customers.length > 0) {
        const customer = searchResponse.data.customers[0];
        console.log('✅ Customer Found in Shopify!');
        console.log(`   Shopify ID: ${customer.id}`);
        console.log(`   Email: ${customer.email}`);
        console.log(`   Name: ${customer.first_name} ${customer.last_name}`);
        console.log(`   Tags: ${customer.tags}`);
        console.log(`   Created: ${customer.created_at}`);
        
        return customer;
      } else {
        console.log('⚠️  Customer not found in Shopify (may take a moment to sync)');
      }
      
    } else {
      console.log(`\n❌ Customer Creation Failed (Status ${response.status})`);
      console.log('Response:', JSON.stringify(response.data, null, 2));
    }
    
  } catch (error) {
    console.error('\n❌ Error creating customer:', error.message);
    if (error.response?.data) {
      console.log('Error details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Test existing customer sync
async function testExistingCustomerSync() {
  console.log('\n\n🔄 Testing Existing Customer Sync');
  console.log('===================================\n');
  
  const existingEmail = 'existing.customer@alliancechemical.com';
  
  console.log('Creating customer that already exists in system...');
  console.log(`Email: ${existingEmail}\n`);
  
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/customers`,
      {
        email: existingEmail,
        firstName: 'Existing',
        lastName: 'Customer',
        company: 'Existing Company',
        syncToShopify: true,
        syncToQuickbooks: false
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        validateStatus: () => true
      }
    );
    
    if (response.data.alreadyExists) {
      console.log('✅ Customer already exists (as expected)');
      console.log(`   Message: ${response.data.message}`);
      
      if (response.data.shopifyResult?.success) {
        console.log(`   ✅ Synced to Shopify: ${response.data.shopifyResult.customerId}`);
      }
    } else if (response.data.success) {
      console.log('✅ New customer created');
      console.log(`   Database ID: ${response.data.data?.id}`);
    } else {
      console.log('❌ Operation failed:', response.data.error);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function main() {
  console.log('🚀 Shopify Integration Test\n');
  
  // Test creating a new customer
  await createShopifyCustomer();
  
  // Test syncing an existing customer
  await testExistingCustomerSync();
  
  console.log('\n\n✅ Test Complete!');
}

main().catch(console.error);