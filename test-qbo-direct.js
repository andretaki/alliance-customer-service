#!/usr/bin/env node

/**
 * Direct QuickBooks API Test
 * Tests the current access token directly
 */

const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

async function testQuickBooksConnection() {
  console.log('🧪 Testing QuickBooks Connection\n');
  
  const accessToken = process.env.QBO_ACCESS_TOKEN;
  const realmId = process.env.QBO_REALM_ID || '9130354762600416';
  const environment = process.env.QBO_ENVIRONMENT || 'production';
  
  if (!accessToken) {
    console.error('❌ No QBO_ACCESS_TOKEN found in .env.local');
    return false;
  }
  
  console.log('Configuration:');
  console.log(`  Environment: ${environment}`);
  console.log(`  Realm ID: ${realmId}`);
  console.log(`  Token: ${accessToken.substring(0, 50)}...`);
  
  const baseUrl = environment === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com';
  
  try {
    console.log(`\nTesting API: ${baseUrl}/v3/company/${realmId}/companyinfo/${realmId}`);
    
    const response = await axios.get(
      `${baseUrl}/v3/company/${realmId}/companyinfo/${realmId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('\n✅ Connection Successful!');
    console.log('Company Info:');
    console.log(`  Name: ${response.data.CompanyInfo.CompanyName}`);
    console.log(`  Country: ${response.data.CompanyInfo.Country}`);
    console.log(`  Address: ${response.data.CompanyInfo.CompanyAddr?.Line1}`);
    console.log(`  City: ${response.data.CompanyInfo.CompanyAddr?.City}`);
    
    // Try to fetch customers
    console.log('\n📋 Fetching customers...');
    const customerQuery = 'SELECT * FROM Customer MAXRESULTS 5';
    const customersResponse = await axios.get(
      `${baseUrl}/v3/company/${realmId}/query?query=${encodeURIComponent(customerQuery)}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );
    
    const customers = customersResponse.data.QueryResponse?.Customer || [];
    console.log(`Found ${customers.length} customers (showing max 5)`);
    
    customers.forEach((customer, index) => {
      console.log(`  ${index + 1}. ${customer.DisplayName} - ${customer.PrimaryEmailAddr?.Address || 'No email'}`);
    });
    
    return true;
    
  } catch (error) {
    console.error('\n❌ Connection Failed!');
    
    if (error.response?.status === 401) {
      console.error('   Status: 401 Unauthorized');
      console.error('   The access token is expired or invalid.');
      console.error('\n   To fix this:');
      console.error('   1. Run: node quickbooks-oauth-setup.js');
      console.error('   2. Complete the OAuth flow in your browser');
      console.error('   3. Update .env.local with the new tokens');
    } else if (error.response?.status === 403) {
      console.error('   Status: 403 Forbidden');
      console.error('   The app may not have permission to access this company.');
    } else {
      console.error(`   Status: ${error.response?.status}`);
      console.error(`   Error: ${error.response?.data?.Fault?.Error?.[0]?.Message || error.message}`);
    }
    
    if (error.response?.data) {
      console.error('\n   Full error response:');
      console.error(JSON.stringify(error.response.data, null, 2));
    }
    
    return false;
  }
}

// Run the test
testQuickBooksConnection().then(success => {
  if (success) {
    console.log('\n✅ QuickBooks is properly configured and working!');
  } else {
    console.log('\n⚠️  QuickBooks needs to be reconfigured.');
  }
  process.exit(success ? 0 : 1);
});