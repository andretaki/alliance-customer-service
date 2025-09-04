import { db } from '@/db';
import { calls } from '@/db/ticketing';
import { eq } from 'drizzle-orm';

export interface ThreeCXCallData {
  callid: string;
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
  raw?: any;
}

export class CallIngestor {
  async ingestCall(data: ThreeCXCallData) {
    try {
      // Check if call already exists
      const existingCall = await db
        .select()
        .from(calls)
        .where(eq(calls.callId, data.callid))
        .limit(1);

      if (existingCall.length > 0) {
        // Update existing call with end time and recording if provided
        const [updatedCall] = await db
          .update(calls)
          .set({
            endedAt: data.endTime ? new Date(data.endTime) : undefined,
            recordingUrl: data.recordingUrl || existingCall[0].recordingUrl,
            raw: data.raw || existingCall[0].raw,
          })
          .where(eq(calls.callId, data.callid))
          .returning();
        
        return updatedCall;
      }

      // Insert new call
      const [newCall] = await db
        .insert(calls)
        .values({
          callId: data.callid,
          direction: data.direction,
          fromNumber: data.from,
          toNumber: data.to,
          agentExt: data.agent?.ext,
          agentName: data.agent?.name,
          startedAt: new Date(data.startTime),
          endedAt: data.endTime ? new Date(data.endTime) : undefined,
          recordingUrl: data.recordingUrl,
          raw: data.raw,
        })
        .returning();

      return newCall;
    } catch (error) {
      console.error('Failed to ingest call:', error);
      throw new Error(`Failed to ingest call: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getCallById(callId: string) {
    const [call] = await db
      .select()
      .from(calls)
      .where(eq(calls.callId, callId))
      .limit(1);
    
    return call;
  }

  async getCallsByNumber(phoneNumber: string) {
    return await db
      .select()
      .from(calls)
      .where(eq(calls.fromNumber, phoneNumber))
      .orderBy(calls.startedAt);
  }
}