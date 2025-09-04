#!/usr/bin/env node

/**
 * Comprehensive Test Suite for Alliance Customer Service
 * Tests all major functionality including integrations, AI, and customer sync
 */

const axios = require('axios');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const API_BASE_URL = 'http://localhost:3002';
const TEST_RESULTS = [];

// Helper function to make API calls
async function apiCall(method, endpoint, data = null, headers = {}) {
  try {
    const response = await axios({
      method,
      url: `${API_BASE_URL}${endpoint}`,
      data,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      validateStatus: () => true // Don't throw on any status
    });
    return response;
  } catch (error) {
    return {
      status: 500,
      data: { error: error.message }
    };
  }
}

// Test result logger
function logTest(name, success, details = '') {
  const status = success ? '✅' : '❌';
  console.log(`${status} ${name}`);
  if (details) {
    console.log(`   ${details}`);
  }
  TEST_RESULTS.push({ name, success, details });
}

// 1. Test Health Check
async function testHealthCheck() {
  console.log('\n🏥 Testing Health Check\n' + '='.repeat(40));
  
  const response = await apiCall('GET', '/api/health');
  const success = response.status === 200;
  
  if (success) {
    const data = response.data;
    logTest('Health Check', true, `Service: ${data.service}, Status: ${data.status}`);
    
    if (data.checks?.database) {
      logTest('Database Connection', 
        data.checks.database.status === 'healthy',
        data.checks.database.error || 'Connected'
      );
    }
    
    if (data.checks?.shopify) {
      logTest('Shopify Configuration', 
        data.checks.shopify.configured,
        data.checks.shopify.status
      );
    }
    
    if (data.checks?.quickbooks) {
      logTest('QuickBooks Configuration', 
        data.checks.quickbooks.configured,
        data.checks.quickbooks.status
      );
    }
  } else {
    logTest('Health Check', false, `Status: ${response.status}`);
  }
  
  return success;
}

// 2. Test Shopify Integration
async function testShopifyIntegration() {
  console.log('\n🛍️ Testing Shopify Integration\n' + '='.repeat(40));
  
  const shopifyStore = process.env.SHOPIFY_STORE || process.env.SHOPIFY_STORE_URL;
  const shopifyToken = process.env.SHOPIFY_ACCESS_TOKEN || process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  
  if (!shopifyStore || !shopifyToken) {
    logTest('Shopify Credentials', false, 'Missing configuration');
    return false;
  }
  
  logTest('Shopify Credentials', true, 'Configured');
  
  // Test direct API connection
  try {
    const shopifyUrl = shopifyStore.startsWith('http') ? shopifyStore : `https://${shopifyStore}`;
    const response = await axios.get(
      `${shopifyUrl}/admin/api/2024-01/shop.json`,
      {
        headers: {
          'X-Shopify-Access-Token': shopifyToken,
          'Content-Type': 'application/json'
        }
      }
    );
    
    logTest('Shopify API Connection', true, 
      `Shop: ${response.data.shop.name} (${response.data.shop.domain})`
    );
    return true;
  } catch (error) {
    logTest('Shopify API Connection', false, error.message);
    return false;
  }
}

// 3. Test QuickBooks Integration
async function testQuickBooksIntegration() {
  console.log('\n💼 Testing QuickBooks Integration\n' + '='.repeat(40));
  
  const qbClientId = process.env.QBO_CLIENT_ID;
  const qbAccessToken = process.env.QBO_ACCESS_TOKEN;
  const qbRealmId = process.env.QBO_REALM_ID;
  
  if (!qbClientId || !qbAccessToken || !qbRealmId) {
    logTest('QuickBooks Credentials', false, 'Missing configuration');
    return false;
  }
  
  logTest('QuickBooks Credentials', true, 'Configured');
  
  // Test API connection
  const qbEnvironment = process.env.QBO_ENVIRONMENT || 'sandbox';
  const baseUrl = qbEnvironment === 'production' 
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com';
  
  try {
    const response = await axios.get(
      `${baseUrl}/v3/company/${qbRealmId}/companyinfo/${qbRealmId}`,
      {
        headers: {
          'Authorization': `Bearer ${qbAccessToken}`,
          'Accept': 'application/json'
        }
      }
    );
    
    logTest('QuickBooks API Connection', true, 
      `Company: ${response.data.CompanyInfo.CompanyName}`
    );
    return true;
  } catch (error) {
    if (error.response?.status === 401) {
      logTest('QuickBooks API Connection', false, 'Token expired - needs refresh');
    } else {
      logTest('QuickBooks API Connection', false, error.message);
    }
    return false;
  }
}

// 4. Test Customer Creation and Sync
async function testCustomerOperations() {
  console.log('\n👥 Testing Customer Operations\n' + '='.repeat(40));
  
  const testEmail = `test.${Date.now()}@alliancechemical.com`;
  const customerData = {
    email: testEmail,
    firstName: 'Test',
    lastName: 'Customer',
    company: 'Test Company LLC',
    phone: '555-0123',
    syncToShopify: true,
    syncToQuickbooks: false // Skip QB if token expired
  };
  
  // Create customer
  const createResponse = await apiCall('POST', '/api/customers', customerData);
  
  if (createResponse.status === 200 || createResponse.status === 201) {
    logTest('Customer Creation', true, 
      `ID: ${createResponse.data.data?.id || createResponse.data.customerId}`
    );
    
    if (createResponse.data.shopifyResult?.success) {
      logTest('Shopify Sync', true, 
        `Shopify ID: ${createResponse.data.shopifyResult.customerId}`
      );
    } else if (createResponse.data.shopifyResult) {
      logTest('Shopify Sync', false, createResponse.data.shopifyResult.error);
    }
    
    // Test finding customer by email
    const findResponse = await apiCall('GET', `/api/customers/email/${testEmail}`);
    logTest('Find Customer by Email', 
      findResponse.status === 200,
      findResponse.status === 200 ? 'Found' : `Status: ${findResponse.status}`
    );
    
    // Test duplicate prevention
    const duplicateResponse = await apiCall('POST', '/api/customers', customerData);
    logTest('Duplicate Prevention', 
      duplicateResponse.data.alreadyExists === true,
      duplicateResponse.data.message || 'Failed'
    );
    
    return true;
  } else {
    logTest('Customer Creation', false, 
      `Status: ${createResponse.status}, Error: ${createResponse.data.error}`
    );
    return false;
  }
}

// 5. Test Ticket Operations
async function testTicketOperations() {
  console.log('\n🎫 Testing Ticket Operations\n' + '='.repeat(40));
  
  const ticketData = {
    subject: 'Test Ticket - Quote Request',
    description: 'I need a quote for 1000 gallons of sulfuric acid for delivery to Houston, TX.',
    customerEmail: 'test@alliancechemical.com',
    customerName: 'Test Customer',
    priority: 'medium',
    source: 'api'
  };
  
  const response = await apiCall('POST', '/api/tickets', ticketData);
  
  if (response.status === 200 || response.status === 201) {
    const ticket = response.data.data;
    logTest('Ticket Creation', true, `ID: ${ticket.id}`);
    
    // Check AI classification
    if (ticket.requestType) {
      logTest('AI Classification', true, 
        `Type: ${ticket.requestType}, Confidence: ${ticket.aiConfidence || 'N/A'}`
      );
    } else {
      logTest('AI Classification', false, 'No classification');
    }
    
    // Check sentiment analysis
    if (ticket.sentiment) {
      logTest('Sentiment Analysis', true, 
        `Sentiment: ${ticket.sentiment}`
      );
    }
    
    // Test getting ticket details
    const getResponse = await apiCall('GET', `/api/tickets/${ticket.id}`);
    logTest('Get Ticket Details', 
      getResponse.status === 200,
      getResponse.status === 200 ? 'Retrieved' : `Status: ${getResponse.status}`
    );
    
    // Test suggesting responses
    const suggestResponse = await apiCall('POST', `/api/tickets/${ticket.id}/suggest-responses`);
    if (suggestResponse.status === 200 && suggestResponse.data.suggestions?.length > 0) {
      logTest('AI Response Suggestions', true, 
        `Generated ${suggestResponse.data.suggestions.length} suggestions`
      );
    } else {
      logTest('AI Response Suggestions', false, 
        suggestResponse.data.error || 'No suggestions generated'
      );
    }
    
    return ticket.id;
  } else {
    logTest('Ticket Creation', false, 
      `Status: ${response.status}, Error: ${response.data.error}`
    );
    return null;
  }
}

// 6. Test AI Operations
async function testAIOperations() {
  console.log('\n🤖 Testing AI Operations\n' + '='.repeat(40));
  
  // Test AI configuration
  const configResponse = await apiCall('GET', '/api/ai/config');
  logTest('AI Configuration', 
    configResponse.status === 200,
    configResponse.status === 200 
      ? `Provider: ${configResponse.data.provider}, Model: ${configResponse.data.model}`
      : 'Not configured'
  );
  
  // Test AI test endpoint
  const testResponse = await apiCall('GET', '/api/ai/test');
  if (testResponse.status === 200) {
    const results = testResponse.data.results;
    
    results?.forEach(test => {
      logTest(`AI ${test.operation}`, 
        test.success,
        test.error || test.result?.substring(0, 50) + '...'
      );
    });
  } else {
    logTest('AI Test Suite', false, `Status: ${testResponse.status}`);
  }
}

// 7. Test COA Operations
async function testCOAOperations() {
  console.log('\n📄 Testing COA Operations\n' + '='.repeat(40));
  
  // Search for COAs
  const searchResponse = await apiCall('GET', '/api/coa?product=sulfuric+acid');
  logTest('COA Search', 
    searchResponse.status === 200,
    searchResponse.status === 200 
      ? `Found ${searchResponse.data.documents?.length || 0} documents`
      : `Status: ${searchResponse.status}`
  );
  
  // Test adding a COA
  const coaData = {
    productName: 'Test Chemical',
    lotNumber: 'TEST-' + Date.now(),
    documentUrl: 'https://example.com/coa.pdf',
    expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
  };
  
  const addResponse = await apiCall('POST', '/api/coa', coaData);
  logTest('Add COA Document', 
    addResponse.status === 200 || addResponse.status === 201,
    addResponse.status === 200 || addResponse.status === 201
      ? 'Added successfully'
      : `Status: ${addResponse.status}`
  );
}

// 8. Test Freight Operations
async function testFreightOperations() {
  console.log('\n🚚 Testing Freight Operations\n' + '='.repeat(40));
  
  // Get freight list
  const listResponse = await apiCall('GET', '/api/freight/list');
  logTest('Get Freight List', 
    listResponse.status === 200,
    listResponse.status === 200 
      ? `${listResponse.data.items?.length || 0} items in queue`
      : `Status: ${listResponse.status}`
  );
  
  // Add to freight list
  const freightData = {
    customerName: 'Test Customer',
    customerEmail: 'test@example.com',
    products: ['Sulfuric Acid - 1000 gal'],
    originCity: 'Houston',
    originState: 'TX',
    destinationCity: 'Dallas',
    destinationState: 'TX',
    estimatedWeight: 8000
  };
  
  const addResponse = await apiCall('POST', '/api/freight/list', freightData);
  logTest('Add to Freight List', 
    addResponse.status === 200 || addResponse.status === 201,
    addResponse.status === 200 || addResponse.status === 201
      ? 'Added successfully'
      : `Status: ${addResponse.status}`
  );
}

// 9. Test Report Generation
async function testReporting() {
  console.log('\n📊 Testing Reporting\n' + '='.repeat(40));
  
  // Get weekly statistics
  const statsResponse = await apiCall('GET', '/api/reports/weekly');
  logTest('Weekly Statistics', 
    statsResponse.status === 200,
    statsResponse.status === 200 
      ? `Total tickets: ${statsResponse.data.ticketStats?.total || 0}`
      : `Status: ${statsResponse.status}`
  );
}

// 10. Run E2E Tests
async function runE2ETests() {
  console.log('\n🧪 Running E2E Test Suite\n' + '='.repeat(40));
  
  const { exec } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);
  
  try {
    console.log('Running Playwright tests (this may take a while)...\n');
    const { stdout, stderr } = await execPromise('npx playwright test --reporter=json', {
      timeout: 120000 // 2 minutes timeout
    });
    
    const results = JSON.parse(stdout);
    logTest('E2E Test Suite', 
      results.stats.failures === 0,
      `Passed: ${results.stats.passes}, Failed: ${results.stats.failures}`
    );
  } catch (error) {
    logTest('E2E Test Suite', false, 'Failed to run or parse results');
  }
}

// Generate test report
function generateReport() {
  console.log('\n' + '='.repeat(50));
  console.log('📋 TEST SUMMARY');
  console.log('='.repeat(50));
  
  const passed = TEST_RESULTS.filter(t => t.success).length;
  const failed = TEST_RESULTS.filter(t => !t.success).length;
  const total = TEST_RESULTS.length;
  const passRate = ((passed / total) * 100).toFixed(1);
  
  console.log(`\nTotal Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Pass Rate: ${passRate}%`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    TEST_RESULTS.filter(t => !t.success).forEach(test => {
      console.log(`   - ${test.name}: ${test.details}`);
    });
  }
  
  // Save report to file
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total,
      passed,
      failed,
      passRate: parseFloat(passRate)
    },
    results: TEST_RESULTS
  };
  
  fs.writeFileSync('test-report.json', JSON.stringify(report, null, 2));
  console.log('\n📁 Detailed report saved to test-report.json');
  
  return passed === total;
}

// Main test runner
async function main() {
  console.log('🚀 ALLIANCE CUSTOMER SERVICE - COMPREHENSIVE TEST SUITE');
  console.log('='.repeat(50));
  console.log(`Started at: ${new Date().toLocaleString()}\n`);
  
  // Check if server is running
  try {
    await axios.get(`${API_BASE_URL}/api/health`, { timeout: 5000 });
  } catch (error) {
    console.error('❌ Server is not responding at', API_BASE_URL);
    console.error('   Please ensure the development server is running: npm run dev');
    process.exit(1);
  }
  
  // Run all tests
  await testHealthCheck();
  await testShopifyIntegration();
  await testQuickBooksIntegration();
  await testCustomerOperations();
  await testTicketOperations();
  await testAIOperations();
  await testCOAOperations();
  await testFreightOperations();
  await testReporting();
  
  // Optional: Run E2E tests (commented out as they take longer)
  // await runE2ETests();
  
  // Generate report
  const allPassed = generateReport();
  
  console.log('\n' + (allPassed ? '✅ ALL TESTS PASSED!' : '⚠️  SOME TESTS FAILED'));
  console.log('Test run completed at:', new Date().toLocaleString());
  
  process.exit(allPassed ? 0 : 1);
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

// Run tests
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});