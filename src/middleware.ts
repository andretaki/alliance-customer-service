import { NextRequest, NextResponse } from 'next/server';
import { requireServiceAuth, getCorsHeaders } from '@/lib/auth';
import { checkRateLimit, createRateLimitHeaders } from '@/lib/ratelimit';
import { verifyWebhook } from '@/lib/hmac';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin');

  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 200 });
    
    // Add CORS headers
    const corsHeaders = getCorsHeaders(origin);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return response;
  }

  // Determine which rate limiter to use based on endpoint
  let rateLimiterType: 'webhook' | 'tickets' | 'auth' | 'api' = 'api';
  
  if (pathname.startsWith('/api/calls/webhook') || pathname.startsWith('/api/webhooks/')) {
    rateLimiterType = 'webhook';
  } else if (pathname === '/api/tickets' && request.method === 'POST') {
    rateLimiterType = 'tickets';
  } else if (pathname.startsWith('/api/auth/') || pathname.startsWith('/api/login') || pathname.startsWith('/api/register')) {
    rateLimiterType = 'auth';
  }

  // Apply rate limiting to all API endpoints
  if (pathname.startsWith('/api/')) {
    const rateLimitResult = await checkRateLimit(request, rateLimiterType);
    
    if (!rateLimitResult.success) {
      const response = NextResponse.json(
        { error: 'Too many requests' },
        { 
          status: 429,
          headers: createRateLimitHeaders(rateLimitResult)
        }
      );
      
      const corsHeaders = getCorsHeaders(origin);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      
      return response;
    }
    
    // Add rate limit headers to successful requests
    const headers = createRateLimitHeaders(rateLimitResult);
    Object.entries(headers).forEach(([key, value]) => {
      request.headers.set(key, value as string);
    });
  }

  // Skip auth for health check and public endpoints
  const publicEndpoints = [
    '/api/health',
    '/api/dashboard/stats', // Dashboard stats endpoint
    '/api/integrations', // Temporarily public for testing integrations
    '/api/calls/webhook', // 3CX webhook needs to be public but with HMAC
    '/api/products/search', // Product search for intake form
    '/api/customers', // Temporarily public for testing
    '/api/tickets', // Temporarily public for testing
    '/api/ai' // Temporarily public for testing
  ];

  if (publicEndpoints.some(endpoint => pathname.startsWith(endpoint))) {
    // For webhook endpoints, verify HMAC
    if (pathname.startsWith('/api/calls/webhook')) {
      const webhookResult = await verifyWebhook(request, {
        secret: process.env.THREE_CX_WEBHOOK_SECRET,
        verifyTimestamp: true,
        maxAge: 300 // 5 minutes
      });
      
      if (!webhookResult.valid) {
        return NextResponse.json(
          { error: webhookResult.error || 'Unauthorized' },
          { status: 401 }
        );
      }
    }
    
    const response = NextResponse.next();
    
    // Add CORS headers to all responses
    const corsHeaders = getCorsHeaders(origin);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return response;
  }

  // Require service authentication for all API endpoints
  if (pathname.startsWith('/api/')) {
    const authResult = requireServiceAuth(request);
    
    if ('error' in authResult) {
      const response = NextResponse.json(
        { success: false, error: authResult.error }, 
        { status: authResult.status }
      );
      
      // Add CORS headers even to error responses
      const corsHeaders = getCorsHeaders(origin);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      
      return response;
    }

    // Add service context to headers for downstream use
    const response = NextResponse.next();
    
    response.headers.set('x-service-context', JSON.stringify(authResult.context));
    
    // Add CORS headers
    const corsHeaders = getCorsHeaders(origin);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return response;
  }

  // For non-API routes, just add CORS headers and continue
  const response = NextResponse.next();
  const corsHeaders = getCorsHeaders(origin);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}

export const config = {
  matcher: [
    // Match all API routes and pages
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)'
  ]
};