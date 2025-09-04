#!/usr/bin/env node

/**
 * QuickBooks OAuth Setup Helper
 * Helps you complete the OAuth flow to get new access and refresh tokens
 */

const express = require('express');
const axios = require('axios');
const open = require('open');
require('dotenv').config({ path: '.env.local' });

const CLIENT_ID = process.env.QBO_CLIENT_ID || 'AB52noxUvil6kya5IsjHrIxJ93UcN8SPTTVQ3kQUPCDjd4qplo';
const CLIENT_SECRET = process.env.QBO_CLIENT_SECRET || 'HK1meBPoAf0FTpaHvTunOiLD1K3vFiLkE13MIxQs';
const REDIRECT_URI = 'http://localhost:8080/callback'; // Local callback for testing
const ENVIRONMENT = process.env.QBO_ENVIRONMENT || 'production';

// QuickBooks OAuth URLs
const DISCOVERY_URL = ENVIRONMENT === 'production'
  ? 'https://developer.api.intuit.com/.well-known/openid_configuration'
  : 'https://developer.api.intuit.com/.well-known/openid_sandbox_configuration';

let authorizationUrl = '';
let tokenUrl = '';

async function getDiscoveryUrls() {
  try {
    const response = await axios.get(DISCOVERY_URL);
    authorizationUrl = response.data.authorization_endpoint;
    tokenUrl = response.data.token_endpoint;
    console.log('✅ Discovery URLs loaded');
  } catch (error) {
    console.error('❌ Failed to get discovery URLs:', error.message);
    // Fallback to known URLs
    if (ENVIRONMENT === 'production') {
      authorizationUrl = 'https://appcenter.intuit.com/connect/oauth2';
      tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
    } else {
      authorizationUrl = 'https://appcenter.intuit.com/connect/oauth2';
      tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
    }
  }
}

async function startOAuthFlow() {
  console.log('🚀 QuickBooks OAuth Setup Helper');
  console.log('==================================');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Client ID: ${CLIENT_ID}`);
  console.log(`Redirect URI: ${REDIRECT_URI}\n`);

  // Get discovery URLs
  await getDiscoveryUrls();

  // Create express server for callback
  const app = express();
  let server;

  app.get('/callback', async (req, res) => {
    const { code, realmId, state, error } = req.query;

    if (error) {
      console.error('❌ OAuth Error:', error);
      res.send(`<h1>Error</h1><p>${error}</p>`);
      server.close();
      process.exit(1);
    }

    if (!code || !realmId) {
      console.error('❌ Missing code or realmId');
      res.send('<h1>Error</h1><p>Missing authorization code or realm ID</p>');
      server.close();
      process.exit(1);
    }

    console.log('\n✅ Authorization code received!');
    console.log(`   Realm ID: ${realmId}`);

    // Exchange code for tokens
    try {
      console.log('\n🔄 Exchanging code for tokens...');
      
      const tokenResponse = await axios.post(
        tokenUrl,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: REDIRECT_URI
        }),
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          }
        }
      );

      const { access_token, refresh_token, expires_in } = tokenResponse.data;

      console.log('\n✅ Tokens received successfully!');
      console.log('==================================\n');
      console.log('Add these to your .env.local file:\n');
      console.log(`QBO_ACCESS_TOKEN="${access_token}"`);
      console.log(`QBO_REFRESH_TOKEN="${refresh_token}"`);
      console.log(`QBO_REALM_ID="${realmId}"`);
      console.log(`\n⏱️  Access token expires in: ${expires_in} seconds (${Math.floor(expires_in / 3600)} hours)`);

      // Save to file for convenience
      const fs = require('fs');
      const envUpdate = `
# QuickBooks OAuth Tokens (Generated ${new Date().toISOString()})
QBO_ACCESS_TOKEN="${access_token}"
QBO_REFRESH_TOKEN="${refresh_token}"
QBO_REALM_ID="${realmId}"
`;
      
      fs.writeFileSync('.env.quickbooks.new', envUpdate);
      console.log('\n📁 Tokens also saved to .env.quickbooks.new');
      console.log('   Copy these to your .env.local file when ready');

      // Test the connection
      console.log('\n🧪 Testing connection...');
      const baseUrl = ENVIRONMENT === 'production'
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

        console.log('✅ Connection successful!');
        console.log(`   Company: ${testResponse.data.CompanyInfo.CompanyName}`);
        console.log(`   Country: ${testResponse.data.CompanyInfo.Country}`);
      } catch (testError) {
        console.error('⚠️  Connection test failed:', testError.message);
      }

      res.send(`
        <html>
          <head>
            <title>QuickBooks OAuth Success</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
              h1 { color: #28a745; }
              pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
              .warning { color: #ffc107; }
            </style>
          </head>
          <body>
            <h1>✅ QuickBooks OAuth Successful!</h1>
            <p>Your tokens have been generated. Check the console for the tokens to add to your .env.local file.</p>
            <p class="warning">⚠️ Keep these tokens secure and never commit them to version control.</p>
            <p>You can close this window and return to the terminal.</p>
          </body>
        </html>
      `);

      // Close server after success
      setTimeout(() => {
        server.close();
        process.exit(0);
      }, 3000);

    } catch (tokenError) {
      console.error('❌ Token exchange failed:', tokenError.response?.data || tokenError.message);
      res.send(`<h1>Error</h1><p>Failed to exchange code for tokens: ${tokenError.message}</p>`);
      server.close();
      process.exit(1);
    }
  });

  // Start server
  server = app.listen(8080, () => {
    console.log('🌐 Callback server listening on http://localhost:8080');
    
    // Build OAuth URL
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      scope: 'com.intuit.quickbooks.accounting',
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      state: `security_${Date.now()}`,
      access_type: 'offline'
    });

    const fullAuthUrl = `${authorizationUrl}?${params}`;
    
    console.log('\n📋 OAuth Authorization URL:');
    console.log(fullAuthUrl);
    console.log('\n👆 Opening in your browser...');
    console.log('   If it doesn\'t open, copy and paste the URL above');
    console.log('\n⏳ Waiting for authorization callback...\n');

    // Open browser
    open(fullAuthUrl).catch(() => {
      console.log('⚠️  Could not open browser automatically. Please open the URL manually.');
    });
  });

  // Handle server errors
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error('❌ Port 8080 is already in use. Please close any other applications using this port.');
    } else {
      console.error('❌ Server error:', err);
    }
    process.exit(1);
  });
}

// Check dependencies
async function checkDependencies() {
  try {
    require('express');
    require('open');
  } catch (error) {
    console.log('📦 Installing required dependencies...');
    const { execSync } = require('child_process');
    execSync('npm install express open', { stdio: 'inherit' });
  }
}

// Main
async function main() {
  await checkDependencies();
  await startOAuthFlow();
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});