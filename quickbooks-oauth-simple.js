#!/usr/bin/env node

/**
 * Simple QuickBooks OAuth Helper
 * Opens the auth URL and waits for you to paste the code
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

require('dotenv').config({ path: '.env.local' });

const clientId = process.env.QBO_CLIENT_ID;
const clientSecret = process.env.QBO_CLIENT_SECRET;
const redirectUri = process.env.QBO_REDIRECT_URI || 'https://sales.alliancechemical.com/qbo/callback';

console.log('\n🔐 QuickBooks Quick OAuth Setup\n');

// Generate and open auth URL
const state = 'security_' + Date.now();
const authUrl = `https://appcenter.intuit.com/connect/oauth2?` +
  `client_id=${clientId}` +
  `&scope=com.intuit.quickbooks.accounting` +
  `&redirect_uri=${encodeURIComponent(redirectUri)}` +
  `&response_type=code` +
  `&state=${state}` +
  `&access_type=offline`;

console.log('Opening QuickBooks authorization in your browser...\n');
console.log('If browser doesn\'t open, visit this URL:');
console.log(authUrl);
console.log('\n' + '='.repeat(80) + '\n');

// Open browser
const platform = process.platform;
const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
exec(`${command} "${authUrl}"`);

console.log('After authorizing QuickBooks, you\'ll be redirected to your site.');
console.log('The URL will look like:');
console.log('https://sales.alliancechemical.com/...');
console.log('\nPaste ONLY the authorization code and realm ID below:');
console.log('(You can find these in the URL as code=XXX and realmId=YYY)\n');

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Enter the CODE value: ', async (code) => {
  rl.question('Enter the REALMID value: ', async (realmId) => {
    
    console.log('\n📋 Exchanging code for tokens...\n');
    
    try {
      const response = await axios.post(
        'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: code.trim(),
          redirect_uri: redirectUri
        }),
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          }
        }
      );
      
      const { access_token, refresh_token, expires_in } = response.data;
      
      console.log('✅ Success! Tokens obtained.');
      console.log('Token expires in:', Math.floor(expires_in / 3600), 'hours');
      
      // Update .env.local
      const envPath = path.join(__dirname, '.env.local');
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      // Remove old tokens if they exist
      envContent = envContent.replace(/^QBO_ACCESS_TOKEN=.*$/m, '');
      envContent = envContent.replace(/^QBO_REFRESH_TOKEN=.*$/m, '');
      envContent = envContent.replace(/^QBO_REALM_ID=.*$/m, '');
      
      // Add new tokens
      envContent = envContent.trim() + '\n';
      envContent += `\n# QuickBooks OAuth Tokens (Updated: ${new Date().toISOString()})\n`;
      envContent += `QBO_ACCESS_TOKEN="${access_token}"\n`;
      envContent += `QBO_REFRESH_TOKEN="${refresh_token}"\n`;
      envContent += `QBO_REALM_ID="${realmId.trim()}"\n`;
      
      fs.writeFileSync(envPath, envContent);
      
      console.log('\n✅ Environment variables updated!');
      console.log('QuickBooks integration is now ready to use.');
      
      // Test the connection
      console.log('\n🧪 Testing connection...');
      const baseUrl = process.env.QBO_ENVIRONMENT === 'production' 
        ? 'https://quickbooks.api.intuit.com'
        : 'https://sandbox-quickbooks.api.intuit.com';
      
      try {
        const testResponse = await axios.get(
          `${baseUrl}/v3/company/${realmId.trim()}/companyinfo/${realmId.trim()}`,
          {
            headers: {
              'Authorization': `Bearer ${access_token}`,
              'Accept': 'application/json'
            }
          }
        );
        
        console.log('✅ Connection successful!');
        console.log('Company:', testResponse.data.CompanyInfo.CompanyName);
      } catch (testError) {
        console.error('⚠️ Connection test failed:', testError.message);
      }
      
    } catch (error) {
      console.error('\n❌ Error:', error.response?.data || error.message);
      if (error.response?.data?.error_description) {
        console.error('Details:', error.response.data.error_description);
      }
    }
    
    rl.close();
  });
});