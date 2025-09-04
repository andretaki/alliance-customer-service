import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

/**
 * Automatic QuickBooks Token Refresh Job
 * This can be called by a cron job to refresh tokens before they expire
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const clientId = process.env.QBO_CLIENT_ID || process.env.QUICKBOOKS_CLIENT_ID;
    const clientSecret = process.env.QBO_CLIENT_SECRET || process.env.QUICKBOOKS_CLIENT_SECRET;
    const refreshToken = process.env.QBO_REFRESH_TOKEN || process.env.QUICKBOOKS_REFRESH_TOKEN;
    
    if (!clientId || !clientSecret) {
      console.error('[QuickBooks Refresh] Missing OAuth credentials');
      return NextResponse.json(
        { 
          success: false,
          error: 'QuickBooks OAuth credentials not configured'
        },
        { status: 500 }
      );
    }
    
    if (!refreshToken) {
      console.log('[QuickBooks Refresh] No refresh token available - OAuth setup required');
      return NextResponse.json(
        { 
          success: false,
          error: 'No refresh token available',
          requiresSetup: true
        },
        { status: 200 } // Return 200 to not trigger cron job failures
      );
    }
    
    console.log('[QuickBooks Refresh] Starting token refresh...');
    
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
    
    console.log('[QuickBooks Refresh] Token refreshed successfully');
    console.log(`[QuickBooks Refresh] New token expires in ${Math.floor(expires_in / 3600)} hours`);
    
    // Update environment variables in .env.local (for development)
    if (process.env.NODE_ENV === 'development') {
      try {
        const envPath = path.join(process.cwd(), '.env.local');
        let envContent = await fs.readFile(envPath, 'utf8');
        
        // Update tokens
        envContent = envContent.replace(
          /^QBO_ACCESS_TOKEN=.*$/m,
          `QBO_ACCESS_TOKEN="${access_token}"`
        );
        
        if (new_refresh_token && new_refresh_token !== refreshToken) {
          envContent = envContent.replace(
            /^QBO_REFRESH_TOKEN=.*$/m,
            `QBO_REFRESH_TOKEN="${new_refresh_token}"`
          );
        }
        
        await fs.writeFile(envPath, envContent);
        console.log('[QuickBooks Refresh] Updated .env.local with new tokens');
      } catch (error) {
        console.error('[QuickBooks Refresh] Could not update .env.local:', error);
      }
    }
    
    // In production, you would save these to your secure token store
    // For now, we'll update the environment variables in memory
    process.env.QBO_ACCESS_TOKEN = access_token;
    if (new_refresh_token) {
      process.env.QBO_REFRESH_TOKEN = new_refresh_token;
    }
    
    return NextResponse.json({
      success: true,
      message: 'Token refreshed successfully',
      expiresIn: expires_in,
      expiresAt: new Date(Date.now() + expires_in * 1000).toISOString()
    });
    
  } catch (error: any) {
    console.error('[QuickBooks Refresh] Token refresh failed:', error?.response?.data || error?.message);
    
    if (error?.response?.data?.error === 'invalid_grant') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Refresh token expired or invalid',
          requiresSetup: true
        },
        { status: 200 } // Return 200 to not trigger cron job failures
      );
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to refresh token',
        details: error?.response?.data || error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Check if token needs refresh
 */
export async function GET(request: NextRequest) {
  try {
    const accessToken = process.env.QBO_ACCESS_TOKEN;
    const refreshToken = process.env.QBO_REFRESH_TOKEN;
    const realmId = process.env.QBO_REALM_ID;
    const environment = process.env.QBO_ENVIRONMENT || 'production';
    
    if (!accessToken || !realmId) {
      return NextResponse.json({
        needsRefresh: false,
        configured: false,
        message: 'QuickBooks not configured'
      });
    }
    
    if (!refreshToken) {
      return NextResponse.json({
        needsRefresh: true,
        hasRefreshToken: false,
        message: 'No refresh token - OAuth setup required'
      });
    }
    
    // Test the current token
    const baseUrl = environment === 'production' 
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';
    
    try {
      await axios.get(
        `${baseUrl}/v3/company/${realmId}/companyinfo/${realmId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        }
      );
      
      return NextResponse.json({
        needsRefresh: false,
        tokenValid: true,
        message: 'Token is still valid'
      });
      
    } catch (testError: any) {
      if (testError.response?.status === 401) {
        return NextResponse.json({
          needsRefresh: true,
          tokenValid: false,
          hasRefreshToken: true,
          message: 'Token expired - refresh needed'
        });
      }
      
      throw testError;
    }
    
  } catch (error) {
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}