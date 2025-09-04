#!/usr/bin/env node

/**
 * Test script for rate limiting functionality
 */

const API_BASE_URL = process.env.API_URL || 'http://localhost:3002';

async function testEndpoint(endpoint, rateLimit, method = 'GET') {
  console.log(`\nTesting ${method} ${endpoint} (limit: ${rateLimit} req/min)`);
  console.log('=' .repeat(50));
  
  const requests = [];
  const results = {
    successful: 0,
    rateLimited: 0,
    errors: 0
  };
  
  // Make requests up to the limit + 5 extra
  const totalRequests = rateLimit + 5;
  
  for (let i = 0; i < totalRequests; i++) {
    const request = fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        // Use different IPs for testing if possible
        'X-Forwarded-For': `192.168.1.${i % 255}`
      },
      body: method === 'POST' ? JSON.stringify({ test: true }) : undefined
    }).then(async response => {
      const headers = {
        limit: response.headers.get('X-RateLimit-Limit'),
        remaining: response.headers.get('X-RateLimit-Remaining'),
        reset: response.headers.get('X-RateLimit-Reset')
      };
      
      if (response.status === 429) {
        results.rateLimited++;
        console.log(`Request ${i + 1}: ❌ Rate limited (429)`);
      } else if (response.ok || response.status === 401) {
        results.successful++;
        console.log(`Request ${i + 1}: ✅ Success (${response.status}) - Remaining: ${headers.remaining}/${headers.limit}`);
      } else {
        results.errors++;
        console.log(`Request ${i + 1}: ⚠️ Error (${response.status})`);
      }
      
      return { status: response.status, headers };
    }).catch(error => {
      results.errors++;
      console.log(`Request ${i + 1}: 💥 Network error: ${error.message}`);
      return { error: error.message };
    });
    
    requests.push(request);
    
    // Small delay between requests to avoid overwhelming
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  // Wait for all requests to complete
  await Promise.all(requests);
  
  console.log('\nResults:');
  console.log(`  Successful: ${results.successful}`);
  console.log(`  Rate Limited: ${results.rateLimited}`);
  console.log(`  Errors: ${results.errors}`);
  console.log(`  Expected rate limits after ${rateLimit}: ${totalRequests - rateLimit}`);
  
  return results;
}

async function runTests() {
  console.log('🚀 Starting Rate Limit Tests');
  console.log(`Testing against: ${API_BASE_URL}`);
  console.log('Note: Using same IP for all requests in this test\n');
  
  try {
    // Test webhook endpoint (10 req/min)
    await testEndpoint('/api/calls/webhook', 10, 'POST');
    
    // Wait a bit before next test
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test ticket creation (30 req/min)
    await testEndpoint('/api/tickets', 30, 'POST');
    
    // Wait a bit before next test
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test general API endpoint (100 req/min)
    await testEndpoint('/api/health', 100, 'GET');
    
    console.log('\n✅ All tests completed!');
    console.log('\nNote: Rate limiting is per IP address. In production, each client would have their own limits.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
runTests().catch(console.error);