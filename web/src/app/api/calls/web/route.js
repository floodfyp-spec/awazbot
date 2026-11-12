import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AccessToken, RoomConfiguration, RoomAgentDispatch } from 'livekit-server-sdk';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { DEMO_PROVIDERS } from '@/lib/demo-data';

const callRequestSchema = z.object({
  mode: z.enum(['directory', 'provider']),
  provider_id: z.string().optional(),
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

    // 3. Resolve target provider details from DB or DEMO_PROVIDERS
    let providerInfo = null;
    if (provider_id) {
      try {
        const { data: dbProv } = await supabase
          .from('providers')
          .select('id, business_name, slug, provider_code, status, trades, whatsapp, notify_email')
          .eq('id', provider_id)
          .maybeSingle();

        if (dbProv) {
          // Fetch active agent configuration
          const { data: configRow } = await supabase
            .from('agent_configs')
            .select('id, version, config, is_active')
            .eq('provider_id', provider_id)
            .eq('is_active', true)
            .order('version', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Fetch provider services
          const { data: dbServices } = await supabase
            .from('provider_services')
            .select('id, name, price_from, price_to')
            .eq('provider_id', provider_id);

          const agentCfg = configRow?.config || {};
          const bName = dbProv.business_name || 'Local Service Provider';

          providerInfo = {
            id: dbProv.id,
            name: bName,
            business_name: bName,
            slug: dbProv.slug,
            provider_code: dbProv.provider_code,
            status: dbProv.status,
            trades: dbProv.trades || ['electrician'],
            whatsapp: dbProv.whatsapp,
            notify_email: dbProv.notify_email || 'mubasiranwar70@gmail.com',
            agent_name: agentCfg.agent_name || `${bName} Voice Receptionist`,
            greeting_ur:
              agentCfg.greeting_ur ||
              `السلام علیکم! ${bName} میں خوش آمدید۔ میں آپ کا خودکار اسسٹنٹ ہوں۔ میں آپ کی کیا مدد کر سکتا ہوں؟`,
            greeting_ps: agentCfg.greeting_ps || 'TODO_PS',
            greeting_en: agentCfg.greeting_en || `Welcome to ${bName}. How can we assist you today?`,
            voice_ur: agentCfg.voice_ur || 'ur-PK-UzmaNeural',
            voice_ps: agentCfg.voice_ps || 'ps-AF-LatifaNeural',
            services: (dbServices && dbServices.length > 0) ? dbServices : (agentCfg.services || []),
            custom_instructions: agentCfg.custom_instructions || '',
            agent_config: agentCfg,
          };
        }
      } catch (e) {
        console.warn('DB provider lookup note:', e.message);
      }

      if (!providerInfo) {
        const demo =
          DEMO_PROVIDERS.find(
            (p) => p.id === provider_id || p.slug === provider_id
          ) || DEMO_PROVIDERS[0];
        providerInfo = {
          ...demo,
          business_name: demo.name,
          greeting_ur: `السلام علیکم! ${demo.name} میں خوش آمدید۔ میں آپ کا خودکار اسسٹنٹ ہوں۔ میں آپ کی کیا مدد کر سکتا ہوں؟`,
          voice_ur: 'ur-PK-UzmaNeural',
          agent_name: `${demo.name} Assistant`,
        };
      }
    }

    // 4. Insert calls record
    let callId = callUuid;
    try {
      const { data: callRecord, error: callError } = await supabase
        .from('calls')
        .insert({
          id: callUuid,
          room_name: roomName,
          mode,
          provider_id: providerInfo?.id || provider_id || null,
          channel: 'web',
          is_test: Boolean(test),
          outcome: test ? 'test' : null,
        })
        .select('id')
        .single();

      if (callRecord?.id) {
        callId = callRecord.id;
      } else if (callError) {
        console.warn('Note on call record insert:', callError.message);
      }
    } catch (insertErr) {
      console.warn('DB insert skipped during call initialization:', insertErr.message);
    }

    // 5. Generate LiveKit Access Token
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
            provider_id: providerInfo?.id || provider_id || null,
            channel: 'web',
            call_id: callId,
            test: !!test,
            provider_name: providerInfo?.name || providerInfo?.business_name,
            notify_email: providerInfo?.notify_email,
            greeting_ur: providerInfo?.greeting_ur,
            greeting_ps: providerInfo?.greeting_ps,
            voice_ur: providerInfo?.voice_ur,
            agent_name: providerInfo?.agent_name,
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
      mode,
      provider_id: providerInfo?.id || provider_id || null,
      provider: providerInfo,
    });
  } catch (err) {
    console.error('Unexpected error in POST /api/calls/web:', err);
    return NextResponse.json(
      { error: 'Internal server error while initializing call.' },
      { status: 500 }
    );
  }
}
