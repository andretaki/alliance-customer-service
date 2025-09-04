#!/usr/bin/env node

/**
 * Test script for Shopify and QuickBooks integrations
 * This script tests both connections and creates a sample customer in both systems
 */

const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

const API_BASE_URL = 'http://localhost:3002';

// Sample customer data
const sampleCustomer = {
  email: `test.customer.${Date.now()}@alliancechemical.com`,
  firstName: 'John',
  lastName: 'Doe',
  company: 'Alliance Test Company',
  phone: '555-123-4567',
  source: 'manual',
  syncToShopify: true,
  syncToQuickbooks: true,
  tags: ['test', 'integration-test']
};

async function testShopifyConnection() {
  console.log('\n🔧 Testing Shopify Connection...');
  console.log('================================');
  
  try {
    // Test direct Shopify API connection
    const shopifyStore = process.env.SHOPIFY_STORE || process.env.SHOPIFY_STORE_URL;
    const shopifyToken = process.env.SHOPIFY_ACCESS_TOKEN || process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    const shopifyUrl = shopifyStore?.startsWith('http') ? shopifyStore : `https://${shopifyStore}`;
    
    if (!shopifyUrl || !shopifyToken) {
      console.log('❌ Shopify credentials not configured');
      return false;
    }
    
    const response = await axios.get(
      `${shopifyUrl}/admin/api/2024-01/shop.json`,
      {
        headers: {
          'X-Shopify-Access-Token': shopifyToken,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Shopify Connection Successful!');
    console.log(`   Shop Name: ${response.data.shop.name}`);
    console.log(`   Shop Domain: ${response.data.shop.domain}`);
    console.log(`   Shop Email: ${response.data.shop.email}`);
    return true;
    
  } catch (error) {
    console.log('❌ Shopify Connection Failed!');
    console.log(`   Error: ${error.response?.data?.errors || error.message}`);
    return false;
  }
}

async function testQuickBooksConnection() {
  console.log('\n🔧 Testing QuickBooks Connection...');
  console.log('====================================');
  
  try {
    const qbClientId = process.env.QBO_CLIENT_ID;
    const qbClientSecret = process.env.QBO_CLIENT_SECRET;
    const qbAccessToken = process.env.QBO_ACCESS_TOKEN;
    const qbRealmId = process.env.QBO_REALM_ID;
    const qbEnvironment = process.env.QBO_ENVIRONMENT || 'sandbox';
    
    if (!qbClientId || !qbClientSecret || !qbAccessToken || !qbRealmId) {
      console.log('❌ QuickBooks credentials not configured');
      return false;
    }
    
    const baseUrl = qbEnvironment === 'production' 
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';
    
    const response = await axios.get(
      `${baseUrl}/v3/company/${qbRealmId}/companyinfo/${qbRealmId}`,
      {
        headers: {
          'Authorization': `Bearer ${qbAccessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ QuickBooks Connection Successful!');
    console.log(`   Company Name: ${response.data.CompanyInfo.CompanyName}`);
    console.log(`   Country: ${response.data.CompanyInfo.Country}`);
    console.log(`   Environment: ${qbEnvironment}`);
    return true;
    
  } catch (error) {
    console.log('❌ QuickBooks Connection Failed!');
    if (error.response?.status === 401) {
      console.log('   Error: Access token expired or invalid');
      console.log('   Solution: Need to refresh QuickBooks OAuth token');
    } else {
      console.log(`   Error: ${error.response?.data?.Fault?.Error?.[0]?.Message || error.message}`);
    }
    return false;
  }
}

async function createSampleCustomer() {
  console.log('\n📝 Creating Sample Customer...');
  console.log('==============================');
  console.log(`Email: ${sampleCustomer.email}`);
  console.log(`Name: ${sampleCustomer.firstName} ${sampleCustomer.lastName}`);
  console.log(`Company: ${sampleCustomer.company}`);
  
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/customers`,
      sampleCustomer,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data.success) {
      console.log('\n✅ Customer Created Successfully!');
      console.log(`   Database ID: ${response.data.data?.id || response.data.customerId}`);
      
      if (response.data.shopifyResult?.success) {
        console.log(`   ✅ Shopify ID: ${response.data.shopifyResult.customerId}`);
      } else if (response.data.shopifyResult) {
        console.log(`   ❌ Shopify Sync Failed: ${response.data.shopifyResult.error}`);
      }
      
      if (response.data.quickbooksResult?.success) {
        console.log(`   ✅ QuickBooks ID: ${response.data.quickbooksResult.customerId}`);
      } else if (response.data.quickbooksResult) {
        console.log(`   ❌ QuickBooks Sync Failed: ${response.data.quickbooksResult.error}`);
      }
      
      if (response.data.alreadyExists) {
        console.log('   ℹ️  Customer already existed and was synced to missing systems');
      }
      
      return response.data;
    } else {
      console.log('❌ Customer Creation Failed!');
      console.log(`   Error: ${response.data.error}`);
      return null;
    }
    
  } catch (error) {
    console.log('❌ Customer Creation Failed!');
    console.log(`   Error: ${error.response?.data?.error || error.message}`);
    if (error.response?.data?.details) {
      console.log('   Details:', JSON.stringify(error.response.data.details, null, 2));
    }
    return null;
  }
}

async function searchCustomerInShopify(email) {
  console.log('\n🔍 Searching Customer in Shopify...');
  
  try {
    const shopifyStore = process.env.SHOPIFY_STORE || process.env.SHOPIFY_STORE_URL;
    const shopifyToken = process.env.SHOPIFY_ACCESS_TOKEN || process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    const shopifyUrl = shopifyStore?.startsWith('http') ? shopifyStore : `https://${shopifyStore}`;
    
    const response = await axios.get(
      `${shopifyUrl}/admin/api/2024-01/customers/search.json?query=email:${email}`,
      {
        headers: {
          'X-Shopify-Access-Token': shopifyToken,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data.customers && response.data.customers.length > 0) {
      const customer = response.data.customers[0];
      console.log('✅ Customer Found in Shopify!');
      console.log(`   ID: ${customer.id}`);
      console.log(`   Email: ${customer.email}`);
      console.log(`   Name: ${customer.first_name} ${customer.last_name}`);
      console.log(`   Created: ${customer.created_at}`);
      return customer;
    } else {
      console.log('❌ Customer not found in Shopify');
      return null;
    }
    
  } catch (error) {
    console.log('❌ Shopify Search Failed!');
    console.log(`   Error: ${error.message}`);
    return null;
  }
}

async function searchCustomerInQuickBooks(email) {
  console.log('\n🔍 Searching Customer in QuickBooks...');
  
  try {
    const qbAccessToken = process.env.QBO_ACCESS_TOKEN;
    const qbRealmId = process.env.QBO_REALM_ID;
    const qbEnvironment = process.env.QBO_ENVIRONMENT || 'sandbox';
    
    const baseUrl = qbEnvironment === 'production' 
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';
    
    const query = `SELECT * FROM Customer WHERE PrimaryEmailAddr = '${email}'`;
    const response = await axios.get(
      `${baseUrl}/v3/company/${qbRealmId}/query?query=${encodeURIComponent(query)}`,
      {
        headers: {
          'Authorization': `Bearer ${qbAccessToken}`,
          'Accept': 'application/json'
        }
      }
    );
    
    if (response.data.QueryResponse?.Customer && response.data.QueryResponse.Customer.length > 0) {
      const customer = response.data.QueryResponse.Customer[0];
      console.log('✅ Customer Found in QuickBooks!');
      console.log(`   ID: ${customer.Id}`);
      console.log(`   Display Name: ${customer.DisplayName}`);
      console.log(`   Email: ${customer.PrimaryEmailAddr?.Address}`);
      console.log(`   Company: ${customer.CompanyName || 'N/A'}`);
      return customer;
    } else {
      console.log('❌ Customer not found in QuickBooks');
      return null;
    }
    
  } catch (error) {
    console.log('❌ QuickBooks Search Failed!');
    console.log(`   Error: ${error.response?.data?.Fault?.Error?.[0]?.Message || error.message}`);
    return null;
  }
}

async function main() {
  console.log('🚀 Alliance Customer Service - Integration Test Suite');
  console.log('=====================================================');
  
  // Test connections
  const shopifyConnected = await testShopifyConnection();
  const quickbooksConnected = await testQuickBooksConnection();
  
  if (!shopifyConnected && !quickbooksConnected) {
    console.log('\n⚠️  Both integrations are not working. Please check your credentials.');
    process.exit(1);
  }
  
  // Create sample customer
  const customer = await createSampleCustomer();
  
  if (customer && customer.success) {
    // Search for the customer in both systems
    if (shopifyConnected) {
      await searchCustomerInShopify(sampleCustomer.email);
    }
    
    if (quickbooksConnected) {
      await searchCustomerInQuickBooks(sampleCustomer.email);
    }
    
    console.log('\n✅ Integration Test Complete!');
    console.log('=============================');
    console.log('Customer successfully created and synced across systems.');
  } else {
    console.log('\n⚠️  Integration Test Partially Complete');
    console.log('=========================================');
    console.log('Some operations failed. Check the errors above.');
  }
}

// Run the test
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});