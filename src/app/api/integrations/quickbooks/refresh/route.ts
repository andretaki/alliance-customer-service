import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

/**
 * QuickBooks OAuth Token Refresh Endpoint
 * Refreshes the QuickBooks access token using the refresh token
 */
export async function POST(request: NextRequest) {
  try {
    const clientId = process.env.QBO_CLIENT_ID || process.env.QUICKBOOKS_CLIENT_ID;
    const clientSecret = process.env.QBO_CLIENT_SECRET || process.env.QUICKBOOKS_CLIENT_SECRET;
    const refreshToken = process.env.QBO_REFRESH_TOKEN || process.env.QUICKBOOKS_REFRESH_TOKEN;
    
    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { 
          success: false,
          error: 'QuickBooks OAuth credentials not configured',
          details: 'Missing QBO_CLIENT_ID or QBO_CLIENT_SECRET'
        },
        { status: 500 }
      );
    }
    
    if (!refreshToken) {
      return NextResponse.json(
        { 
          success: false,
          error: 'No refresh token available',
          details: 'You need to complete the OAuth flow first to get a refresh token',
          authUrl: `https://appcenter.intuit.com/connect/oauth2?client_id=${clientId}&scope=com.intuit.quickbooks.accounting&redirect_uri=${encodeURIComponent(process.env.QBO_REDIRECT_URI || '')}&response_type=code&state=security_token`
        },
        { status: 400 }
      );
    }
    
    console.log('[QuickBooks] Refreshing OAuth token...');
    
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
    
    console.log('[QuickBooks] Token refreshed successfully');
    console.log(`[QuickBooks] New token expires in ${expires_in} seconds (${Math.floor(expires_in / 3600)} hours)`);
    
    // In production, you would save these tokens securely
    // For now, return them so they can be updated in environment variables
    return NextResponse.json({
      success: true,
      message: 'Token refreshed successfully',
      tokens: {
        accessToken: access_token,
        refreshToken: new_refresh_token,
        expiresIn: expires_in,
        expiresAt: new Date(Date.now() + expires_in * 1000).toISOString()
      },
      instructions: [
        'Update your .env.local file with:',
        `QBO_ACCESS_TOKEN="${access_token}"`,
        `QBO_REFRESH_TOKEN="${new_refresh_token}"`
      ]
    });
    
  } catch (error) {
    const axiosError = error as any;
    console.error('[QuickBooks] Token refresh failed:', axiosError.response?.data || axiosError.message);
    
    if (axiosError.response?.data?.error === 'invalid_grant') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Refresh token expired or invalid',
          details: 'You need to re-authenticate through the OAuth flow',
          authUrl: `https://appcenter.intuit.com/connect/oauth2?client_id=${process.env.QBO_CLIENT_ID}&scope=com.intuit.quickbooks.accounting&redirect_uri=${encodeURIComponent(process.env.QBO_REDIRECT_URI || '')}&response_type=code&state=security_token`
        },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to refresh token',
        details: axiosError.response?.data || axiosError.message
      },
      { status: 500 }
    );
  }
}

/**
 * Check current token status
 */
export async function GET(request: NextRequest) {
  try {
    const accessToken = process.env.QBO_ACCESS_TOKEN || process.env.QUICKBOOKS_ACCESS_TOKEN;
    const realmId = process.env.QBO_REALM_ID || process.env.QUICKBOOKS_COMPANY_ID;
    const environment = process.env.QBO_ENVIRONMENT || process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox';
    
    if (!accessToken || !realmId) {
      return NextResponse.json({
        success: false,
        configured: false,
        message: 'QuickBooks not configured'
      });
    }
    
    // Test the token by making a simple API call
    const baseUrl = environment === 'production' 
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';
    
    try {
      const response = await axios.get(
        `${baseUrl}/v3/company/${realmId}/companyinfo/${realmId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        }
      );
      
      return NextResponse.json({
        success: true,
        configured: true,
        tokenValid: true,
        company: response.data.CompanyInfo.CompanyName,
        environment
      });
      
    } catch (testError: any) {
      if (testError.response?.status === 401) {
        return NextResponse.json({
          success: false,
          configured: true,
          tokenValid: false,
          message: 'Token expired - needs refresh',
          refreshUrl: '/api/integrations/quickbooks/refresh'
        });
      }
      
      throw testError;
    }
    
  } catch (error) {
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Refresh failed' 
      },
      { status: 500 }
    );
  }
}