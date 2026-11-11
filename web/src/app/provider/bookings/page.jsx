'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { updateBookingStatus } from '@/lib/actions/provider';

function BookingsContent() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const highlightedRowRef = useRef(null);

  const [provider, setProvider] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('all'); // all, pending, confirmed, rejected, done
  const [search, setSearch] = useState('');
  const [unmaskedPhones, setUnmaskedPhones] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});

  // 1. Initial Load of Provider and Bookings
  useEffect(() => {
    async function loadBookings() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: prov } = await supabase
        .from('providers')
        .select('id, business_name')
        .eq('owner_user_id', user.id)
        .maybeSingle();

      if (!prov) {
        setLoading(false);
        return;
      }
      setProvider(prov);

      const { data: bks, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('provider_id', prov.id)
        .order('created_at', { ascending: false });

      if (!error && bks) {
        setBookings(bks);
      }
      setLoading(false);
    }

    loadBookings();
  }, []);

  // 2. Supabase Realtime Subscription for live updates
  useEffect(() => {
    if (!provider?.id) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`bookings_provider_${provider.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `provider_id=eq.${provider.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newBooking = payload.new;
            setBookings((prev) => [newBooking, ...prev]);
            toast.info(`🔔 New booking from ${newBooking.customer_name || 'Customer'}!`, {
              description: `${newBooking.area} — ${newBooking.problem_text?.slice(0, 40)}...`,
              duration: 6000,
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new;
            setBookings((prev) =>
              prev.map((b) => (b.id === updated.id ? updated : b))
            );
          } else if (payload.eventType === 'DELETE') {
            setBookings((prev) => prev.filter((b) => b.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [provider?.id]);

  // 3. Highlight row scroll-into-view
  useEffect(() => {
    if (highlightId && highlightedRowRef.current) {
      highlightedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightId, bookings]);

  // Mask phone helper (0300-***-4567)
  const formatPhone = (phone, id) => {
    if (unmaskedPhones[id]) return phone;
    if (!phone) return '0300-***-4567';
    const clean = phone.replace(/[^\d]/g, '');
    if (clean.length >= 10) {
      return `${clean.slice(0, 4)}-***-${clean.slice(-4)}`;
    }
    return '0300-***-4567';
  };

  const toggleUnmask = (id) => {
    setUnmaskedPhones((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Status transition handlers (Approve / Reject)
  const handleStatusChange = async (bookingId, nextStatus) => {
    setActionLoading((prev) => ({ ...prev, [bookingId]: true }));
    // Optimistic UI update
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status: nextStatus } : b))
    );

    try {
      const res = await updateBookingStatus(bookingId, nextStatus);
      if (res.ok) {
        toast.success(`Booking ${nextStatus === 'confirmed' ? 'Approved' : 'Rejected'}!`);
      } else {
        toast.error(res.error || 'Failed to update booking status.');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionLoading((prev) => ({ ...prev, [bookingId]: false }));
    }
  };

  // Filter and search logic
  const filteredBookings = bookings.filter((b) => {
    const matchesFilter = filter === 'all' || b.status === filter;
    const matchesSearch =
      !search ||
      b.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      b.area?.toLowerCase().includes(search.toLowerCase()) ||
      b.problem_text?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  if (loading) {
    return (
      <div className="container mx-auto p-12 text-center text-sm text-muted-foreground">
        Loading live bookings inbox...
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Bookings Inbox
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time reservations captured by your voice receptionist and WhatsApp bots.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs px-2.5 py-1">
            Total: {bookings.length}
          </Badge>
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-semibold px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-950/40">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            Live Realtime Active
          </span>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-1 overflow-x-auto pb-1 text-xs">
          {['all', 'pending', 'confirmed', 'rejected', 'done'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`capitalize px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 ${
                filter === tab
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-card text-muted-foreground hover:bg-muted border'
              }`}
            >
              {tab} (
              {tab === 'all'
                ? bookings.length
                : bookings.filter((b) => b.status === tab).length}
              )
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64">
          <Input
            placeholder="Search name, area, problem..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs h-9 bg-card"
          />
        </div>
      </div>

      {/* Bookings Table / Cards */}
      <Card className="shadow-xs overflow-hidden">
        <CardContent className="p-0">
          {filteredBookings.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground">
              No bookings found matching the current filter.
            </div>
          ) : (
            <div className="divide-y text-xs">
              {filteredBookings.map((b) => {
                const isHighlighted = b.id === highlightId;
                return (
                  <div
                    key={b.id}
                    ref={isHighlighted ? highlightedRowRef : null}
                    className={`p-4 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isHighlighted
                        ? 'bg-amber-50 dark:bg-amber-950/40 ring-2 ring-primary'
                        : 'hover:bg-muted/30'
                    }`}
                  >
                    {/* Left: Customer Info & Problem */}
                    <div className="space-y-1.5 max-w-xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-foreground">
                          {b.customer_name}
                        </span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {b.area}
                        </Badge>
                        <Badge
                          variant={
                            b.status === 'confirmed'
                              ? 'default'
                              : b.status === 'rejected'
                              ? 'destructive'
                              : 'secondary'
                          }
                          className="capitalize text-[10px] px-2 py-0"
                        >
                          {b.status}
                        </Badge>
                        {b.urgency === 'EMERGENCY' && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 font-bold animate-pulse">
                            🚨 EMERGENCY
                          </Badge>
                        )}
                      </div>

                      <p className="text-foreground text-xs leading-relaxed">
                        {b.problem_text}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground pt-0.5">
                        <span className="font-mono">
                          Slot: {new Date(b.slot_start).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} at {new Date(b.slot_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span>•</span>
                        <div className="flex items-center gap-1 font-mono">
                          <span>Phone: {formatPhone(b.customer_phone, b.id)}</span>
                          <button
                            type="button"
                            onClick={() => toggleUnmask(b.id)}
                            className="text-[10px] text-primary underline hover:opacity-80"
                          >
                            {unmaskedPhones[b.id] ? 'Hide' : 'Unmask'}
                          </button>
                        </div>
                        <span>•</span>
                        <Link
                          href={`/booking/${b.id}`}
                          target="_blank"
                          className="underline hover:text-primary"
                        >
                          Public Tracker &rarr;
                        </Link>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      {b.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleStatusChange(b.id, 'confirmed')}
                            disabled={actionLoading[b.id]}
                            className="h-8 px-3 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(b.id, 'rejected')}
                            disabled={actionLoading[b.id]}
                            className="h-8 px-3 text-xs font-semibold border-destructive/40 text-destructive hover:bg-destructive/10"
                          >
                            Reject
                          </Button>
                        </>
                      )}

                      {b.status === 'confirmed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(b.id, 'done')}
                          disabled={actionLoading[b.id]}
                          className="h-8 px-3 text-xs"
                        >
                          Mark Completed
                        </Button>
                      )}

                      {b.status === 'rejected' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStatusChange(b.id, 'pending')}
                          disabled={actionLoading[b.id]}
                          className="h-8 px-3 text-xs text-muted-foreground"
                        >
                          Reopen
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProviderBookingsPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-sm">Loading bookings...</div>}>
      <BookingsContent />
    </Suspense>
  );
}
