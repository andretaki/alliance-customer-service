import crypto from 'crypto';
import { NextRequest } from 'next/server';

/**
 * Verify HMAC signature for webhook requests
 */
export async function verifyHMAC(
  request: NextRequest,
  secret: string,
  body: string | Buffer
): Promise<boolean> {
  try {
    // Get the signature from headers
    const signature = request.headers.get('x-webhook-signature') || 
                     request.headers.get('x-signature') ||
                     request.headers.get('x-hub-signature-256');
    
    if (!signature) {
      console.error('No signature header found');
      return false;
    }
    
    // Support different signature formats
    let receivedSignature = signature;
    
    // GitHub style: sha256=xxxxx
    if (signature.includes('=')) {
      const [algorithm, sig] = signature.split('=');
      if (algorithm !== 'sha256') {
        console.error(`Unsupported signature algorithm: ${algorithm}`);
        return false;
      }
      receivedSignature = sig;
    }
    
    // Calculate expected signature
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(typeof body === 'string' ? body : body.toString());
    const expectedSignature = hmac.digest('hex');
    
    // Constant-time comparison to prevent timing attacks
    const received = Buffer.from(receivedSignature, 'hex');
    const expected = Buffer.from(expectedSignature, 'hex');
    
    if (received.length !== expected.length) {
      console.error('Signature length mismatch');
      return false;
    }
    
    return crypto.timingSafeEqual(received, expected);
  } catch (error) {
    console.error('HMAC verification failed:', error);
    return false;
  }
}

/**
 * Generate HMAC signature for outgoing webhooks
 */
export function generateHMAC(secret: string, payload: string | Buffer): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(typeof payload === 'string' ? payload : payload.toString());
  return hmac.digest('hex');
}

/**
 * Verify timestamp to prevent replay attacks
 */
export function verifyTimestamp(
  request: NextRequest,
  maxAgeSeconds: number = 300 // 5 minutes default
): boolean {
  const timestamp = request.headers.get('x-webhook-timestamp') ||
                   request.headers.get('x-timestamp');
  
  if (!timestamp) {
    console.error('No timestamp header found');
    return false;
  }
  
  const requestTime = parseInt(timestamp, 10);
  const currentTime = Math.floor(Date.now() / 1000);
  
  if (isNaN(requestTime)) {
    console.error('Invalid timestamp format');
    return false;
  }
  
  const age = Math.abs(currentTime - requestTime);
  
  if (age > maxAgeSeconds) {
    console.error(`Request too old: ${age} seconds`);
    return false;
  }
  
  return true;
}

/**
 * Middleware to verify webhook authenticity
 */
export async function verifyWebhook(
  request: NextRequest,
  options: {
    secret?: string;
    verifyTimestamp?: boolean;
    maxAge?: number;
  } = {}
): Promise<{ valid: boolean; error?: string; body?: string }> {
  try {
    // Get webhook secret from options or environment
    const secret = options.secret || process.env.WEBHOOK_SECRET;
    
    if (!secret) {
      return { 
        valid: false, 
        error: 'Webhook secret not configured' 
      };
    }
    
    // Verify timestamp if required
    if (options.verifyTimestamp) {
      if (!verifyTimestamp(request, options.maxAge)) {
        return { 
          valid: false, 
          error: 'Invalid or expired timestamp' 
        };
      }
    }
    
    // Read request body
    const body = await request.text();
    
    // Clone request to preserve body for handler
    const clonedRequest = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body,
    });
    
    // Verify HMAC
    const isValid = await verifyHMAC(request, secret, body);
    
    if (!isValid) {
      return { 
        valid: false, 
        error: 'Invalid signature' 
      };
    }
    
    return { 
      valid: true, 
      body 
    };
  } catch (error) {
    console.error('Webhook verification error:', error);
    return { 
      valid: false, 
      error: 'Verification failed' 
    };
  }
}

/**
 * Create webhook headers for outgoing requests
 */
export function createWebhookHeaders(
  secret: string,
  payload: string,
  includeTimestamp: boolean = true
): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  // Add signature
  const signature = generateHMAC(secret, payload);
  headers['X-Webhook-Signature'] = `sha256=${signature}`;
  
  // Add timestamp
  if (includeTimestamp) {
    headers['X-Webhook-Timestamp'] = Math.floor(Date.now() / 1000).toString();
  }
  
  return headers;
}