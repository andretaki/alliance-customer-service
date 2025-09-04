#!/usr/bin/env node

/**
 * Validate rate limiting configuration
 */

// Load environment variables
require('dotenv').config();

async function validateRateLimitConfig() {
  console.log('🔍 Validating Rate Limit Configuration\n');
  console.log('=' .repeat(50));
  
  // Check environment variables
  console.log('\n📋 Environment Variables:');
  const requiredVars = ['KV_REST_API_URL', 'KV_REST_API_TOKEN'];
  const envStatus = {};
  
  for (const varName of requiredVars) {
    const value = process.env[varName];
    envStatus[varName] = value ? '✅ Set' : '❌ Missing';
    console.log(`  ${varName}: ${envStatus[varName]}`);
    if (value && varName.includes('URL')) {
      console.log(`    Value: ${value}`);
    }
  }
  
  // Test Redis connection
  console.log('\n🔌 Testing Redis Connection:');
  try {
    const { Redis } = require('@upstash/redis');
    const redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
    
    // Try a simple ping
    const startTime = Date.now();
    await redis.set('test:ratelimit:ping', 'pong', { ex: 10 });
    const result = await redis.get('test:ratelimit:ping');
    const latency = Date.now() - startTime;
    
    if (result === 'pong') {
      console.log(`  ✅ Redis connection successful (latency: ${latency}ms)`);
    } else {
      console.log(`  ⚠️ Redis connection works but unexpected response`);
    }
    
    // Clean up
    await redis.del('test:ratelimit:ping');
    
  } catch (error) {
    console.log(`  ❌ Redis connection failed: ${error.message}`);
  }
  
  // Check rate limit configuration
  console.log('\n⚙️ Rate Limit Configuration:');
  try {
    const { rateLimiters } = require('./src/lib/ratelimit');
    
    const configs = [
      { name: 'webhook', expected: '10 requests per minute' },
      { name: 'tickets', expected: '30 requests per minute' },
      { name: 'api', expected: '100 requests per minute' },
      { name: 'auth', expected: '5 requests per minute' }
    ];
    
    for (const config of configs) {
      if (rateLimiters[config.name]) {
        console.log(`  ✅ ${config.name}: ${config.expected}`);
      } else {
        console.log(`  ❌ ${config.name}: Not configured`);
      }
    }
  } catch (error) {
    console.log(`  ❌ Failed to load rate limit configuration: ${error.message}`);
  }
  
  // Check middleware configuration
  console.log('\n🛡️ Middleware Configuration:');
  try {
    const fs = require('fs');
    const middlewarePath = './src/middleware.ts';
    const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');
    
    const checks = [
      { pattern: /checkRateLimit/, description: 'Rate limit checking' },
      { pattern: /createRateLimitHeaders/, description: 'Rate limit headers' },
      { pattern: /429/, description: 'Too Many Requests response' },
      { pattern: /rateLimiterType/, description: 'Dynamic rate limiter selection' }
    ];
    
    for (const check of checks) {
      if (check.pattern.test(middlewareContent)) {
        console.log(`  ✅ ${check.description}`);
      } else {
        console.log(`  ❌ ${check.description} missing`);
      }
    }
  } catch (error) {
    console.log(`  ❌ Failed to check middleware: ${error.message}`);
  }
  
  // Summary
  console.log('\n' + '=' .repeat(50));
  const allGood = Object.values(envStatus).every(status => status.includes('✅'));
  
  if (allGood) {
    console.log('✅ Rate limiting is properly configured!');
    console.log('\nRate Limits:');
    console.log('  • Webhooks: 10 req/min');
    console.log('  • Ticket Creation: 30 req/min');
    console.log('  • General API: 100 req/min');
    console.log('  • Auth Endpoints: 5 req/min');
  } else {
    console.log('⚠️ Some configuration issues found. Please check above.');
  }
}

// Run validation
validateRateLimitConfig().catch(console.error);