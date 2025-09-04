import { NextRequest } from 'next/server';
import { z } from 'zod';

// Service-to-service authentication schema
const serviceAuthSchema = z.object({
  serviceSecret: z.string().min(1),
  serviceName: z.string().min(1),
  timestamp: z.number(),
});

export interface ServiceContext {
  serviceName: string;
  timestamp: number;
  isAuthenticated: boolean;
}

/**
 * Authenticate service-to-service requests
 */
export function authenticateService(request: NextRequest): ServiceContext {
  const context: ServiceContext = {
    serviceName: 'unknown',
    timestamp: Date.now(),
    isAuthenticated: false
  };

  try {
    const authHeader = request.headers.get('authorization');
    const serviceHeader = request.headers.get('x-service-name');
    const timestampHeader = request.headers.get('x-timestamp');

    if (!authHeader?.startsWith('Bearer ') || !serviceHeader || !timestampHeader) {
      return context;
    }

    const token = authHeader.substring(7);
    const expectedSecret = process.env.SERVICE_SECRET;

    if (!expectedSecret) {
      console.error('[ServiceAuth] SERVICE_SECRET not configured');
      return context;
    }

    // Validate timestamp (reject requests older than 5 minutes)
    const requestTimestamp = parseInt(timestampHeader);
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (isNaN(requestTimestamp) || Math.abs(now - requestTimestamp) > fiveMinutes) {
      console.warn('[ServiceAuth] Request timestamp invalid or expired');
      return context;
    }

    // Validate service secret
    if (token === expectedSecret) {
      context.serviceName = serviceHeader;
      context.timestamp = requestTimestamp;
      context.isAuthenticated = true;
    } else {
      console.warn('[ServiceAuth] Invalid service secret');
    }

    return context;
  } catch (error) {
    console.error('[ServiceAuth] Error authenticating service:', error);
    return context;
  }
}

/**
 * Middleware to require service authentication
 */
export function requireServiceAuth(request: NextRequest) {
  const context = authenticateService(request);
  
  if (!context.isAuthenticated) {
    return {
      error: 'Unauthorized - invalid service authentication',
      status: 401
    };
  }

  return { context };
}

/**
 * Generate service-to-service auth headers
 */
export function generateServiceAuthHeaders(serviceName: string): Record<string, string> {
  const secret = process.env.SERVICE_SECRET;
  const timestamp = Date.now();

  if (!secret) {
    throw new Error('SERVICE_SECRET not configured');
  }

  return {
    'Authorization': `Bearer ${secret}`,
    'X-Service-Name': serviceName,
    'X-Timestamp': timestamp.toString(),
    'Content-Type': 'application/json'
  };
}

/**
 * Check if request origin is allowed
 */
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;

  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
  
  // Always allow localhost for development
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
    return true;
  }

  return allowedOrigins.includes(origin);
}

/**
 * CORS headers for service responses
 */
export function getCorsHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Service-Name, X-Timestamp',
    'Access-Control-Max-Age': '86400' // 24 hours
  };

  if (isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin!;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}