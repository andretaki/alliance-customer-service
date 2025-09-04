import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest } from 'next/server';

// Initialize Redis client using environment variables
const redis = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
  ? new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    })
  : null;

// Create rate limiters for different endpoints
export const rateLimiters = {
  // Public webhook endpoint - 10 requests per minute per IP
  webhook: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    analytics: true,
    prefix: 'ratelimit:webhook',
  }) : null,

  // Ticket creation - 30 requests per minute per IP
  tickets: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '1 m'),
    analytics: true,
    prefix: 'ratelimit:tickets',
  }) : null,

  // General API - 100 requests per minute per IP
  api: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'),
    analytics: true,
    prefix: 'ratelimit:api',
  }) : null,

  // Aggressive rate limiting for auth endpoints - 5 per minute
  auth: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '1 m'),
    analytics: true,
    prefix: 'ratelimit:auth',
  }) : null,
};

/**
 * Get client identifier from request
 */
export function getClientId(request: NextRequest): string {
  // Try to get real IP from various headers
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwarded.split(',')[0].trim();
  }
  
  if (realIp) {
    return realIp;
  }
  
  if (cfConnectingIp) {
    return cfConnectingIp;
  }
  
  // Fallback to a generic identifier if no IP is found
  return 'anonymous';
}

/**
 * Check rate limit for a request
 */
export async function checkRateLimit(
  request: NextRequest,
  limiterType: keyof typeof rateLimiters = 'api'
): Promise<{ success: boolean; limit?: number; remaining?: number; reset?: number }> {
  const limiter = rateLimiters[limiterType];
  
  if (!limiter) {
    // If rate limiting is not configured, allow all requests
    console.log('Rate limiting not configured (Redis not available)');
    return { success: true };
  }
  
  const clientId = getClientId(request);
  
  try {
    const { success, limit, remaining, reset } = await limiter.limit(clientId);
    
    if (!success) {
      console.log(`Rate limit exceeded for ${clientId} on ${limiterType}`);
    }
    
    return { success, limit, remaining, reset };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // On error, allow the request but log it
    return { success: true };
  }
}

/**
 * Create rate limit response headers
 */
export function createRateLimitHeaders(result: {
  limit?: number;
  remaining?: number;
  reset?: number;
}): HeadersInit {
  const headers: HeadersInit = {};
  
  if (result.limit !== undefined) {
    headers['X-RateLimit-Limit'] = result.limit.toString();
  }
  
  if (result.remaining !== undefined) {
    headers['X-RateLimit-Remaining'] = result.remaining.toString();
  }
  
  if (result.reset !== undefined) {
    headers['X-RateLimit-Reset'] = result.reset.toString();
  }
  
  return headers;
}