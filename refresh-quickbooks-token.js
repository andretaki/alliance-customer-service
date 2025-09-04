#!/usr/bin/env node

/**
 * Manual QuickBooks Token Refresh Script
 * Run this to manually refresh your QuickBooks OAuth tokens
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

async function refreshToken() {
  const clientId = process.env.QBO_CLIENT_ID || process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QBO_CLIENT_SECRET || process.env.QUICKBOOKS_CLIENT_SECRET;
  const refreshToken = process.env.QBO_REFRESH_TOKEN || process.env.QUICKBOOKS_REFRESH_TOKEN;
  const realmId = process.env.QBO_REALM_ID;
  
  console.log('\n🔄 QuickBooks Token Refresh\n');
  
  if (!clientId || !clientSecret) {
    console.error('❌ Error: Missing QuickBooks OAuth credentials');
    console.error('Please ensure QBO_CLIENT_ID and QBO_CLIENT_SECRET are set in .env.local');
    process.exit(1);
  }
  
  if (!refreshToken) {
    console.error('❌ Error: No refresh token available');
    console.error('You need to complete the OAuth setup first.');
    console.error('Run: node setup-quickbooks-oauth.js');
    process.exit(1);
  }
  
  console.log('Current Configuration:');
  console.log('- Client ID:', clientId ? '✅ Set' : '❌ Missing');
  console.log('- Client Secret:', clientSecret ? '✅ Set' : '❌ Missing');
  console.log('- Refresh Token:', refreshToken ? '✅ Set' : '❌ Missing');
  console.log('- Realm ID:', realmId || '❌ Missing');
  
  try {
    console.log('\n🔄 Refreshing token...');
    
    const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
    
    const response = await axios.post(
      tokenUrl,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      }),
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      }
    );
    
    const { access_token, refresh_token: new_refresh_token, expires_in } = response.data;
    
    console.log('\n✅ Token refreshed successfully!');
    console.log('- Token expires in:', Math.floor(expires_in / 3600), 'hours');
    console.log('- Expiry time:', new Date(Date.now() + expires_in * 1000).toISOString());
    
    // Update .env.local file
    const envPath = path.join(__dirname, '.env.local');
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Update access token
    const accessTokenRegex = /^QBO_ACCESS_TOKEN=.*$/m;
    if (accessTokenRegex.test(envContent)) {
      envContent = envContent.replace(accessTokenRegex, `QBO_ACCESS_TOKEN="${access_token}"`);
    } else {
      envContent += `\nQBO_ACCESS_TOKEN="${access_token}"`;
    }
    
    // Update refresh token if a new one was provided
    if (new_refresh_token && new_refresh_token !== refreshToken) {
      const refreshTokenRegex = /^QBO_REFRESH_TOKEN=.*$/m;
      if (refreshTokenRegex.test(envContent)) {
        envContent = envContent.replace(refreshTokenRegex, `QBO_REFRESH_TOKEN="${new_refresh_token}"`);
      } else {
        envContent += `\nQBO_REFRESH_TOKEN="${new_refresh_token}"`;
      }
      console.log('- New refresh token received and saved');
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log('\n✅ Environment variables updated in .env.local');
    
    // Test the new token
    if (realmId) {
      console.log('\n🧪 Testing new token...');
      const environment = process.env.QBO_ENVIRONMENT || 'production';
      const baseUrl = environment === 'production' 
        ? 'https://quickbooks.api.intuit.com'
        : 'https://sandbox-quickbooks.api.intuit.com';
      
      try {
        const testResponse = await axios.get(
          `${baseUrl}/v3/company/${realmId}/companyinfo/${realmId}`,
          {
            headers: {
              'Authorization': `Bearer ${access_token}`,
              'Accept': 'application/json'
            }
          }
        );
        
        console.log('✅ Token test successful!');
        console.log('- Company:', testResponse.data.CompanyInfo.CompanyName);
      } catch (testError) {
        console.error('⚠️  Token test failed:', testError.message);
      }
    }
    
    console.log('\n✅ Token refresh complete!');
    console.log('\nYour QuickBooks integration is now ready to use.');
    
  } catch (error) {
    console.error('\n❌ Error refreshing token:', error.response?.data || error.message);
    
    if (error.response?.data?.error === 'invalid_grant') {
      console.error('\n⚠️  Your refresh token has expired or is invalid.');
      console.error('You need to complete the OAuth flow again.');
      console.error('Run: node setup-quickbooks-oauth.js');
    }
    
    process.exit(1);
  }
}

refreshToken();