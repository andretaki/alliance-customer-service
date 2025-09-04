import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { transcripts } from '@/db/ticketing';

const createTranscriptSchema = z.object({
  text: z.string(),
  summary: z.string().optional(),
  sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
  modelMeta: z.record(z.string(), z.any()).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const { callId } = await params;
    const body = await request.json();
    const validated = createTranscriptSchema.parse(body);

    const [transcript] = await db
      .insert(transcripts)
      .values({
        callId: callId,
        text: validated.text,
        summary: validated.summary,
        sentiment: validated.sentiment,
        modelMeta: validated.modelMeta,
      })
      .returning();

    return NextResponse.json({
      success: true,
      transcript,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Failed to create transcript:', error);
    return NextResponse.json(
      { error: 'Failed to create transcript' },
      { status: 500 }
    );
  }
}