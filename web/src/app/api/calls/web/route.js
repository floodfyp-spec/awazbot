import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AccessToken, RoomConfiguration, RoomAgentDispatch } from 'livekit-server-sdk';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';

const callRequestSchema = z.object({
  mode: z.enum(['directory', 'provider']),
  provider_id: z.string().uuid().optional(),
  test: z.boolean().optional().default(false),
}).refine(
  (data) => data.mode !== 'provider' || !!data.provider_id,
  {
    message: 'provider_id is required when mode is "provider"',
    path: ['provider_id'],
  }
);

export async function POST(request) {
  // 1. IP Rate Limiting
  const forwardedFor = request.headers.get('x-forwarded-for');
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';
  const { allowed } = checkRateLimit(ip);

  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait a minute before making another call.' },
      { status: 429 }
    );
  }

  // 2. Validate Request Body
  let body;
  try {
    const raw = await request.json();
    body = callRequestSchema.parse(raw);
  } catch (err) {
    return NextResponse.json(
      { error: err.errors?.[0]?.message || 'Invalid call request parameters.' },
      { status: 400 }
    );
  }

  const { mode, provider_id, test } = body;

  try {
    const supabase = createAdminClient();
    const callUuid = crypto.randomUUID();
    const roomName = `call_${callUuid}`;

    // 3. Insert calls record
    let callId = callUuid;
    try {
      const { data: callRecord, error: callError } = await supabase
        .from('calls')
        .insert({
          id: callUuid,
          room_name: roomName,
          mode,
          provider_id: provider_id || null,
          channel: 'web',
          is_test: Boolean(test),
          outcome: test ? 'test' : null,
        })
        .select('id')
        .single();

      if (callRecord?.id) {
        callId = callRecord.id;
      } else if (callError) {
        console.warn('Note: Could not insert call row (DB migration might be pending):', callError.message);
      }
    } catch (insertErr) {
      console.warn('DB insert skipped during call initialization:', insertErr.message);
    }

    // 4. Generate LiveKit Access Token
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      return NextResponse.json(
        { error: 'LiveKit server credentials are not properly configured.' },
        { status: 500 }
      );
    }

    const customerIdentity = `cust_${crypto.randomUUID().slice(0, 8)}`;
    const token = new AccessToken(apiKey, apiSecret, {
      identity: customerIdentity,
      name: 'Customer',
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    // Configure Agent Dispatch metadata
    token.roomConfig = new RoomConfiguration({
      agents: [
        new RoomAgentDispatch({
          agentName: 'awazbot',
          metadata: JSON.stringify({
            mode,
            provider_id: provider_id || null,
            channel: 'web',
            call_id: callId,
            test: !!test,
          }),
        }),
      ],
    });

    const jwtToken = await token.toJwt();

    return NextResponse.json({
      token: jwtToken,
      url: livekitUrl,
      roomName,
      callId,
    });
  } catch (err) {
    console.error('Unexpected error in POST /api/calls/web:', err);
    return NextResponse.json(
      { error: 'Internal server error while initializing call.' },
      { status: 500 }
    );
  }
}
