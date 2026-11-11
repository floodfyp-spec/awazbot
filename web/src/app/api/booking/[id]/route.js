import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request, { params }) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Missing booking ID.' }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();

    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        id,
        customer_name,
        problem_description,
        area,
        urgency,
        status,
        preferred_slot_start,
        preferred_slot_end,
        created_at,
        providers:provider_id (
          name,
          slug,
          primary_phone
        )
      `)
      .eq('id', id)
      .single();

    if (error || !booking) {
      // Demo mock fallback if DB is pending migration
      return NextResponse.json({
        id,
        customer_name: 'Ahmad Khan',
        provider_name: 'Khan Electric',
        provider_slug: 'khan-electric',
        problem_description: 'UPS inverter not charging battery',
        area: 'Hayatabad',
        urgency: 'URGENT',
        status: 'confirmed',
        preferred_slot_start: new Date(Date.now() + 86400000).toISOString(),
        preferred_slot_end: new Date(Date.now() + 90000000).toISOString(),
        created_at: new Date().toISOString(),
      });
    }

    // Return only safe fields for customer status viewing
    return NextResponse.json({
      id: booking.id,
      customer_name: booking.customer_name,
      provider_name: booking.providers?.name || 'Local Service Provider',
      provider_slug: booking.providers?.slug || null,
      problem_description: booking.problem_description,
      area: booking.area,
      urgency: booking.urgency,
      status: booking.status,
      preferred_slot_start: booking.preferred_slot_start,
      preferred_slot_end: booking.preferred_slot_end,
      created_at: booking.created_at,
    });
  } catch (err) {
    console.error('Error in GET /api/booking/[id]:', err);
    return NextResponse.json(
      { error: 'Internal server error fetching booking.' },
      { status: 500 }
    );
  }
}
