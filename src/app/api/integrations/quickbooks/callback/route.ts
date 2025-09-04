import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

/**
 * QuickBooks OAuth Callback Handler
 * Handles the redirect from QuickBooks after authorization
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const realmId = searchParams.get('realmId');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    
    // Check for errors from QuickBooks
    if (error) {
      return NextResponse.json(
        { 
          success: false,
          error: error,
          description: searchParams.get('error_description')
        },
        { status: 400 }
      );
    }
    
    if (!code || !realmId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Missing authorization code or realm ID'
        },
        { status: 400 }
      );
    }
    
    console.log('[QuickBooks Callback] Received authorization code');
    console.log('[QuickBooks Callback] Realm ID:', realmId);
    
    // Exchange code for tokens
    const clientId = process.env.QBO_CLIENT_ID || process.env.QUICKBOOKS_CLIENT_ID;
    const clientSecret = process.env.QBO_CLIENT_SECRET || process.env.QUICKBOOKS_CLIENT_SECRET;
    const redirectUri = process.env.QBO_REDIRECT_URI || 'http://localhost:3002/api/integrations/quickbooks/callback';
    
    const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
    
    try {
      const response = await axios.post(
        tokenUrl,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
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
      
      console.log('[QuickBooks Callback] Tokens obtained successfully');
      console.log('[QuickBooks Callback] Token expires in:', Math.floor(expires_in / 3600), 'hours');
      
      // Update environment variables in .env.local (for development)
      if (process.env.NODE_ENV === 'development') {
        try {
          const envPath = path.join(process.cwd(), '.env.local');
          let envContent = await fs.readFile(envPath, 'utf8');
          
          // Update or add tokens
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
          
          await fs.writeFile(envPath, envContent);
          console.log('[QuickBooks Callback] Updated .env.local with new tokens');
        } catch (error) {
          console.error('[QuickBooks Callback] Could not update .env.local:', error);
        }
      }
      
      // Update in-memory environment variables
      process.env.QBO_ACCESS_TOKEN = access_token;
      process.env.QBO_REFRESH_TOKEN = refresh_token;
      process.env.QBO_REALM_ID = realmId;
      
      // Test the connection
      const environment = process.env.QBO_ENVIRONMENT || 'production';
      const baseUrl = environment === 'production' 
        ? 'https://quickbooks.api.intuit.com'
        : 'https://sandbox-quickbooks.api.intuit.com';
      
      let companyName = 'Unknown';
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
        companyName = testResponse.data.CompanyInfo.CompanyName;
      } catch (testError) {
        console.error('[QuickBooks Callback] Connection test failed:', testError);
      }
      
      // Return success HTML page
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>QuickBooks Connected</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              background: white;
              padding: 2rem 3rem;
              border-radius: 10px;
              box-shadow: 0 20px 40px rgba(0,0,0,0.1);
              text-align: center;
              max-width: 500px;
            }
            h1 {
              color: #2d3748;
              margin-bottom: 1rem;
            }
            .success {
              color: #48bb78;
              font-size: 3rem;
              margin-bottom: 1rem;
            }
            .info {
              color: #718096;
              margin: 0.5rem 0;
            }
            .token-info {
              background: #f7fafc;
              padding: 1rem;
              border-radius: 5px;
              margin-top: 1rem;
              font-family: monospace;
              font-size: 0.875rem;
              word-break: break-all;
            }
            .close-btn {
              margin-top: 2rem;
              padding: 0.75rem 2rem;
              background: #667eea;
              color: white;
              border: none;
              border-radius: 5px;
              cursor: pointer;
              font-size: 1rem;
            }
            .close-btn:hover {
              background: #5a67d8;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success">✅</div>
            <h1>QuickBooks Connected Successfully!</h1>
            <p class="info">Company: <strong>${companyName}</strong></p>
            <p class="info">Realm ID: <strong>${realmId}</strong></p>
            <p class="info">Token expires in: <strong>${Math.floor(expires_in / 3600)} hours</strong></p>
            <div class="token-info">
              <strong>Access Token:</strong> ${access_token.substring(0, 20)}...<br><br>
              <strong>Refresh Token:</strong> ${refresh_token ? refresh_token.substring(0, 20) + '...' : 'Not provided'}
            </div>
            <p class="info" style="margin-top: 1.5rem;">
              ✅ Your .env.local file has been updated with the new tokens.<br>
              ✅ QuickBooks integration is now ready to use!
            </p>
            <button class="close-btn" onclick="window.close()">Close Window</button>
          </div>
        </body>
        </html>
      `;
      
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html'
        }
      });
      
    } catch (tokenError: any) {
      console.error('[QuickBooks Callback] Token exchange failed:', tokenError.response?.data || tokenError.message);
      
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to exchange code for tokens',
          details: tokenError.response?.data || tokenError.message,
          code: code,
          realmId: realmId
        },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('[QuickBooks Callback] Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Callback processing failed' 
      },
      { status: 500 }
    );
  }
}