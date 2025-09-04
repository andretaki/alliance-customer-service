#!/usr/bin/env node

/**
 * QuickBooks OAuth Setup Helper
 * This script helps you complete the OAuth flow and get refresh tokens
 */

const readline = require('readline');
const axios = require('axios');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise((resolve) => {
  rl.question(prompt, resolve);
});

// QuickBooks OAuth Configuration
const config = {
  clientId: process.env.QBO_CLIENT_ID || process.env.QUICKBOOKS_CLIENT_ID,
  clientSecret: process.env.QBO_CLIENT_SECRET || process.env.QUICKBOOKS_CLIENT_SECRET,
  redirectUri: process.env.QBO_REDIRECT_URI || 'https://sales.alliancechemical.com/qbo/callback',
  realmId: process.env.QBO_REALM_ID || process.env.QUICKBOOKS_REALM_ID,
  environment: process.env.QBO_ENVIRONMENT || 'production'
};

console.log('\n🔐 QuickBooks OAuth Setup Helper\n');
console.log('Current Configuration:');
console.log('- Client ID:', config.clientId ? '✅ Set' : '❌ Missing');
console.log('- Client Secret:', config.clientSecret ? '✅ Set' : '❌ Missing');
console.log('- Redirect URI:', config.redirectUri);
console.log('- Realm ID:', config.realmId || '❌ Missing');
console.log('- Environment:', config.environment);

async function main() {
  try {
    if (!config.clientId || !config.clientSecret) {
      console.error('\n❌ Error: Missing QuickBooks OAuth credentials');
      console.error('Please ensure QBO_CLIENT_ID and QBO_CLIENT_SECRET are set in .env.local');
      process.exit(1);
    }

    console.log('\n📋 Step 1: Generate Authorization URL\n');
    
    const state = 'security_' + Math.random().toString(36).substring(7);
    const authUrl = `https://appcenter.intuit.com/connect/oauth2?` +
      `client_id=${config.clientId}` +
      `&scope=com.intuit.quickbooks.accounting` +
      `&redirect_uri=${encodeURIComponent(config.redirectUri)}` +
      `&response_type=code` +
      `&state=${state}` +
      `&access_type=offline`;

    console.log('Authorization URL generated. Please follow these steps:\n');
    console.log('1. Open this URL in your browser:');
    console.log('\n' + authUrl + '\n');
    
    // Try to open in browser
    try {
      const platform = process.platform;
      const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
      spawn(command, [authUrl], { detached: true });
      console.log('✅ Browser opened automatically');
    } catch (e) {
      console.log('⚠️  Could not open browser automatically. Please copy and paste the URL above.');
    }
    
    console.log('\n2. Sign in to QuickBooks and authorize the application');
    console.log('3. You will be redirected to the callback URL');
    console.log('4. Copy the FULL redirect URL from your browser address bar');
    console.log('   (It should contain "code=" and "realmId=" parameters)\n');
    
    const redirectUrl = await question('Paste the redirect URL here: ');
    
    // Parse the redirect URL
    const url = new URL(redirectUrl);
    const code = url.searchParams.get('code');
    const realmId = url.searchParams.get('realmId');
    
    if (!code || !realmId) {
      console.error('\n❌ Error: Could not extract code or realmId from the URL');
      console.error('Make sure you copied the complete URL including all parameters');
      process.exit(1);
    }
    
    console.log('\n✅ Authorization code extracted');
    console.log('✅ Realm ID (Company ID):', realmId);
    
    console.log('\n📋 Step 2: Exchange Code for Tokens\n');
    
    const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
    
    const response = await axios.post(
      tokenUrl,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: config.redirectUri
      }),
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      }
    );
    
    const { access_token, refresh_token, expires_in } = response.data;
    
    console.log('\n✅ Tokens obtained successfully!');
    console.log('- Access token expires in:', Math.floor(expires_in / 3600), 'hours');
    
    // Update .env.local file
    console.log('\n📋 Step 3: Update Environment Variables\n');
    
    const envPath = path.join(__dirname, '.env.local');
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Update or add QBO variables
    const updates = {
      'QBO_ACCESS_TOKEN': access_token,
      'QBO_REFRESH_TOKEN': refresh_token,
      'QBO_REALM_ID': realmId
    };
    
    for (const [key, value] of Object.entries(updates)) {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}="${value}"`);
      } else {
        envContent += `\n${key}="${value}"`;
      }
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Environment variables updated in .env.local');
    
    // Test the connection
    console.log('\n📋 Step 4: Test Connection\n');
    
    const baseUrl = config.environment === 'production' 
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
      
      console.log('✅ Connection test successful!');
      console.log('Company Name:', testResponse.data.CompanyInfo.CompanyName);
      console.log('\n🎉 QuickBooks OAuth setup complete!');
      console.log('\nYour application can now access QuickBooks data.');
      console.log('The refresh token will be used to automatically renew the access token when it expires.');
      
    } catch (testError) {
      console.error('⚠️  Connection test failed:', testError.message);
      console.log('\nTokens were saved, but the connection test failed.');
      console.log('Please check your QuickBooks app settings and try again.');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
    if (error.response?.data?.error_description) {
      console.error('Details:', error.response.data.error_description);
    }
  } finally {
    rl.close();
  }
}

main();