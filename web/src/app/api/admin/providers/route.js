import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { DEMO_PROVIDERS } from '@/lib/demo-data';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('providers')
      .select('id, business_name, slug, provider_code, status, trades, whatsapp, notify_email, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Note on DB providers fetch in API:', error.message);
    }

    const dbProviders = data || [];
    const dbIds = new Set(dbProviders.map((p) => p.id));

    // Also include demo providers that are not in DB for full catalogue preview
    const additionalDemos = DEMO_PROVIDERS.filter((d) => !dbIds.has(d.id)).map((d, i) => ({
      id: d.id,
      business_name: d.name,
      slug: d.slug,
      provider_code: d.provider_code,
      status: i === 1 || i === 3 ? 'pending' : (d.status || 'approved'),
      trades: d.trades,
      whatsapp: d.primary_phone,
      notify_email: d.notify_email || 'mubasiranwar70@gmail.com',
      created_at: new Date(Date.now() - i * 86400000).toISOString(),
    }));

    return NextResponse.json({
      providers: [...dbProviders, ...additionalDemos],
    });
  } catch (err) {
    console.error('Error fetching admin providers:', err);
    return NextResponse.json(
      { error: 'Failed to fetch providers', details: err.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      business_name,
      trade,
      whatsapp,
      notify_email,
      area,
      status = 'approved',
      greeting_ur,
      voice,
    } = body;

    if (!business_name?.trim()) {
      return NextResponse.json({ error: 'Business name is required' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const newId = crypto.randomUUID();
    const cleanName = business_name.trim();
    const slug = `${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Date.now().toString().slice(-4)}`;
    const providerCode = `${cleanName.slice(0, 4).toUpperCase()}-${Math.floor(10 + Math.random() * 90)}`;

    const newProvider = {
      id: newId,
      business_name: cleanName,
      slug,
      provider_code: providerCode,
      status: status || 'approved',
      trades: [trade || 'electrician'],
      whatsapp: whatsapp || '03001234567',
      notify_email: notify_email || 'mubasiranwar70@gmail.com',
      created_at: new Date().toISOString(),
    };

    // 1. Insert into providers table
    const { data: inserted, error: insertError } = await supabase
      .from('providers')
      .insert(newProvider)
      .select()
      .single();

    if (insertError) {
      console.warn('DB Provider insert warning:', insertError.message);
    }

    // 2. Insert into agent_configs table
    try {
      await supabase.from('agent_configs').insert({
        provider_id: newId,
        version: 1,
        is_active: true,
        config: {
          agent_name: `${cleanName} Assistant`,
          greeting_ur: greeting_ur || `السلام علیکم! ${cleanName} میں خوش آمدید۔ میں آپ کا خودکار اسسٹنٹ ہوں۔ میں آپ کی کیا مدد کر سکتا ہوں؟`,
          voice_ur: voice || 'ur-PK-UzmaNeural',
          booking_mode: 'lead',
          interruptible: true,
          provider_name: cleanName,
        },
      });
    } catch (cfgErr) {
      console.warn('Agent config insert note:', cfgErr.message);
    }

    // 3. Insert default services for this trade into provider_services
    try {
      const defaultServices = trade === 'ups_solar' ? [
        { name: 'Solar Inverter Inspection & Tuning', price_from: 2000, price_to: 5000 },
        { name: 'Battery Health Check & Setup', price_from: 1000, price_to: 2500 }
      ] : trade === 'ac_fridge' ? [
        { name: 'AC Master Jet Wash Service', price_from: 1800, price_to: 3500 },
        { name: 'AC Freon Gas Refill', price_from: 3500, price_to: 6500 }
      ] : trade === 'plumber_gas' ? [
        { name: 'Water Pipe Leakage Repair', price_from: 1000, price_to: 2500 },
        { name: 'Gas Pipe & Geyser Installation', price_from: 1500, price_to: 4000 }
      ] : [
        { name: 'Short Circuit & Wiring Fault Repair', price_from: 1000, price_to: 2500 },
        { name: 'Switchboard & Breaker Replacement', price_from: 500, price_to: 1500 }
      ];

      await supabase.from('provider_services').insert(
        defaultServices.map((s) => ({
          provider_id: newId,
          name: s.name,
          price_from: s.price_from,
          price_to: s.price_to,
        }))
      );
    } catch (svcErr) {
      console.warn('Provider services insert note:', svcErr.message);
    }

    return NextResponse.json({
      success: true,
      provider: inserted || newProvider,
    });
  } catch (err) {
    console.error('Error creating provider via admin API:', err);
    return NextResponse.json(
      { error: 'Failed to create provider', details: err.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from('providers')
      .update({ status })
      .eq('id', id);

    if (error) {
      console.warn('Note on updating provider status in DB:', error.message);
    }

    return NextResponse.json({
      success: true,
      id,
      status,
    });
  } catch (err) {
    console.error('Error updating provider status:', err);
    return NextResponse.json(
      { error: 'Failed to update provider status', details: err.message },
      { status: 500 }
    );
  }
}
