import crypto from 'crypto';

export interface ThreeCXConfig {
  webhookSecret?: string;
  recordingBaseUrl?: string;
}

export class ThreeCXService {
  private config: ThreeCXConfig;

  constructor(config: ThreeCXConfig = {}) {
    this.config = {
      webhookSecret: config.webhookSecret || process.env.THREE_CX_WEBHOOK_SECRET,
      recordingBaseUrl: config.recordingBaseUrl || process.env.THREE_CX_RECORDING_BASE_URL,
    };
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.config.webhookSecret) {
      console.warn('No 3CX webhook secret configured, skipping verification');
      return true;
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  parseCallEvent(payload: any): {
    callId: string;
    direction: 'inbound' | 'outbound';
    from: string;
    to: string;
    agent?: {
      ext: string;
      name: string;
    };
    startTime: string;
    endTime?: string;
    recordingUrl?: string;
  } {
    // Parse 3CX webhook payload format
    // This will vary based on your 3CX configuration
    return {
      callId: payload.CallID || payload.call_id || payload.id,
      direction: payload.Direction?.toLowerCase() || 
                 (payload.is_inbound ? 'inbound' : 'outbound'),
      from: payload.From || payload.from_number || payload.caller,
      to: payload.To || payload.to_number || payload.called,
      agent: payload.Agent ? {
        ext: payload.Agent.Extension || payload.Agent.ext,
        name: payload.Agent.Name || payload.Agent.name,
      } : undefined,
      startTime: payload.StartTime || payload.start_time || payload.started_at,
      endTime: payload.EndTime || payload.end_time || payload.ended_at,
      recordingUrl: this.buildRecordingUrl(payload.RecordingFile || payload.recording_file),
    };
  }

  private buildRecordingUrl(recordingFile?: string): string | undefined {
    if (!recordingFile) return undefined;
    if (!this.config.recordingBaseUrl) return recordingFile;
    
    // If it's already a full URL, return as is
    if (recordingFile.startsWith('http')) return recordingFile;
    
    // Otherwise, combine with base URL
    return `${this.config.recordingBaseUrl}/${recordingFile}`;
  }

  formatPhoneNumber(number: string): string {
    // Remove all non-numeric characters
    const cleaned = number.replace(/\D/g, '');
    
    // Format as US phone number if 10 digits
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    }
    
    // If already has country code
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`;
    }
    
    // Return with + prefix if not already present
    return number.startsWith('+') ? number : `+${cleaned}`;
  }

  extractCallMetadata(payload: any): Record<string, any> {
    // Extract additional metadata from 3CX payload
    return {
      queue: payload.Queue || payload.queue,
      waitTime: payload.WaitTime || payload.wait_time,
      talkTime: payload.TalkTime || payload.talk_time,
      holdTime: payload.HoldTime || payload.hold_time,
      transferredFrom: payload.TransferredFrom || payload.transferred_from,
      transferredTo: payload.TransferredTo || payload.transferred_to,
      disconnectedBy: payload.DisconnectedBy || payload.disconnected_by,
      callType: payload.CallType || payload.call_type,
      did: payload.DID || payload.did,
      tags: payload.Tags || payload.tags,
    };
  }
}