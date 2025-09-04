#!/usr/bin/env node

/**
 * QuickBooks OAuth Token Refresh Utility
 * Use this to refresh your QuickBooks access token when it expires
 */

const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

async function refreshQuickBooksToken() {
  console.log('🔄 Refreshing QuickBooks OAuth Token...');
  console.log('=====================================');
  
  const clientId = process.env.QBO_CLIENT_ID;
  const clientSecret = process.env.QBO_CLIENT_SECRET;
  const refreshToken = process.env.QBO_REFRESH_TOKEN;
  
  if (!clientId || !clientSecret) {
    console.error('❌ Missing QuickBooks client credentials');
    console.log('   Required: QBO_CLIENT_ID, QBO_CLIENT_SECRET');
    process.exit(1);
  }
  
  if (!refreshToken) {
    console.error('❌ No refresh token available');
    console.log('   You need to complete the OAuth flow first to get a refresh token');
    console.log('   Visit: https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0');
    process.exit(1);
  }
  
  try {
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
    
    console.log('✅ Token refreshed successfully!');
    console.log('\n📝 Update your .env.local file with:');
    console.log('=====================================');
    console.log(`QBO_ACCESS_TOKEN="${response.data.access_token}"`);
    console.log(`QBO_REFRESH_TOKEN="${response.data.refresh_token}"`);
    console.log('\n⏱️  Token expires in:', response.data.expires_in, 'seconds');
    console.log('   (Approximately', Math.floor(response.data.expires_in / 3600), 'hours)');
    
    // Save to .env.local.new file
    const fs = require('fs');
    const envContent = fs.readFileSync('.env.local', 'utf8');
    
    let newContent = envContent;
    newContent = newContent.replace(/QBO_ACCESS_TOKEN="[^"]*"/, `QBO_ACCESS_TOKEN="${response.data.access_token}"`);
    newContent = newContent.replace(/QBO_REFRESH_TOKEN="[^"]*"/, `QBO_REFRESH_TOKEN="${response.data.refresh_token}"`);
    
    fs.writeFileSync('.env.local.new', newContent);
    console.log('\n✅ New tokens saved to .env.local.new');
    console.log('   Review and rename to .env.local when ready');
    
  } catch (error) {
    console.error('❌ Failed to refresh token!');
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Error:', error.response.data.error || error.response.data);
      
      if (error.response.data.error === 'invalid_grant') {
        console.log('\n⚠️  The refresh token has expired or is invalid');
        console.log('   You need to re-authenticate through the OAuth flow');
      }
    } else {
      console.log('   Error:', error.message);
    }
    process.exit(1);
  }
}

// Run the refresh
refreshQuickBooksToken();