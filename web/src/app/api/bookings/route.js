import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      customer_name,
      customer_phone,
      area,
      problem_description,
      preferred_slot,
      provider_id,
      notify_email,
      call_id,
    } = body;

    const supabase = createAdminClient();
    const bookingId = `BK-${Date.now().toString().slice(-6)}`;
    const targetProviderId = provider_id || 'd1111111-1111-1111-1111-111111111101';

    // 1. Resolve Provider details (business_name and notify_email)
    let providerName = 'Local Service Provider';
    let targetNotifyEmail = notify_email;

    try {
      const { data: prov } = await supabase
        .from('providers')
        .select('id, business_name, notify_email, whatsapp')
        .eq('id', targetProviderId)
        .maybeSingle();

      if (prov) {
        providerName = prov.business_name || providerName;
        if (!targetNotifyEmail || targetNotifyEmail.includes('example.com')) {
          targetNotifyEmail = prov.notify_email || targetNotifyEmail;
        }
      }
    } catch (lookupErr) {
      console.warn('Provider lookup for booking email note:', lookupErr.message);
    }

    if (!targetNotifyEmail || targetNotifyEmail.includes('example.com')) {
      targetNotifyEmail = process.env.DEMO_NOTIFY_EMAIL || 'mubasiranwar70@gmail.com';
    }

    // 2. Insert into Supabase bookings table
    let savedBooking = null;
    try {
      const slotTime = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const validProviderId =
        targetProviderId && targetProviderId.length === 36 && targetProviderId.includes('-')
          ? targetProviderId
          : '9e6f40c0-f2f5-4fe1-abee-f7b2ac41161b';

      const validCallId =
        call_id && call_id.length === 36 && call_id.includes('-')
          ? call_id
          : null;

      const { data, error } = await supabase.from('bookings').insert({
        provider_id: validProviderId,
        call_id: validCallId,
        customer_name: customer_name || 'Valued Customer',
        customer_phone: customer_phone || '03001234567',
        problem_text: problem_description || 'General Service Request',
        issue_code: 'general_repair',
        area: area || 'Peshawar',
        status: 'confirmed',
        slot_start: slotTime,
        urgency: 'ROUTINE',
      }).select().single();

      if (error) {
        console.warn('Note on bookings table insert:', error.message);
      } else {
        savedBooking = data;
      }
    } catch (dbErr) {
      console.warn('DB booking insert exception:', dbErr.message);
    }

    // 3. Dispatch Email notification directly to provider's Gmail via FastAPI backend
    try {
      await fetch('http://127.0.0.1:8000/api/notify/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Secret': process.env.INTERNAL_API_SECRET || 'awazbot_secret_internal_key_2026',
        },
        body: JSON.stringify({
          to: targetNotifyEmail,
          subject: `New Booking: ${problem_description || 'Service Request'} - ${area || 'Peshawar'}`,
          booking: {
            id: bookingId,
            customer_name: customer_name || 'Customer',
            customer_phone: customer_phone || '03001234567',
            area: area || 'Peshawar',
            problem_description: problem_description || 'General Service Request',
            preferred_slot: preferred_slot || 'Tomorrow 10:00 AM',
            urgency: 'ROUTINE',
          },
          provider: {
            id: targetProviderId,
            name: providerName,
            notify_email: targetNotifyEmail,
          },
        }),
      });
    } catch (mailErr) {
      console.warn('Email dispatch warning (continuing):', mailErr.message);
    }

    return NextResponse.json({
      success: true,
      booking_id: bookingId,
      customer_name,
      area,
      problem_description,
      preferred_slot,
      notified_email: targetNotifyEmail,
      provider_name: providerName,
    });
  } catch (err) {
    console.error('Error creating booking:', err);
    return NextResponse.json(
      { error: 'Failed to create booking', details: err.message },
      { status: 500 }
    );
  }
}
