'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getDictionary } from '@/lib/i18n';

export default function BookingStatusPage({ params }) {
  const { id } = use(params);
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lang, setLang] = useState('en');

  useEffect(() => {
    const match = document.cookie.match(/awaz_lang=([^;]+)/);
    if (match) {
      setLang(match[1]);
    }
  }, []);

  const t = getDictionary(lang);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/booking/${id}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('Booking record not found.');
          } else {
            setError('Failed to load booking status.');
          }
          return;
        }
        const data = await res.json();
        setBooking(data);
        setError(null);
      } catch (err) {
        setError('Network error while refreshing status.');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    // Poll every 5 seconds for status updates per spec
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [id]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">{t.confirmedStatus}</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">{t.completedStatus}</Badge>;
      case 'cancelled':
      case 'rejected':
        return <Badge variant="destructive">{t.cancelledStatus}</Badge>;
      case 'pending':
      default:
        return <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-950/40">{t.pendingStatus}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center justify-center p-4">
        <div className="h-64 w-full animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center p-4">
        <Card className="w-full text-center">
          <CardHeader>
            <CardTitle className="text-destructive">Booking Not Found</CardTitle>
            <CardDescription>{error || 'The requested booking could not be located.'}</CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Link href="/services">
              <Button>Browse Directory</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center justify-center p-4 sm:p-6">
      <Card className="w-full shadow-md border-border">
        <CardHeader className="space-y-1 border-b pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold tracking-tight">
              {t.bookingStatusTitle}
            </CardTitle>
            {getStatusBadge(booking.status)}
          </div>
          <CardDescription className="text-xs text-muted-foreground font-mono">
            {t.bookingId}: {booking.id}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">{t.technician}</p>
              <p className="font-semibold text-foreground text-base mt-0.5">
                {booking.provider_name}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t.customerName}</p>
              <p className="font-semibold text-foreground text-base mt-0.5">
                {booking.customer_name}
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 border space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Problem Description</p>
              <p className="text-sm font-medium text-foreground mt-0.5">
                {booking.problem_description}
              </p>
            </div>
            <div className="flex justify-between items-center text-xs pt-1 border-t">
              <span className="text-muted-foreground">Area: <strong className="text-foreground">{booking.area}</strong></span>
              {booking.urgency && (
                <Badge variant={booking.urgency === 'EMERGENCY' ? 'destructive' : 'secondary'} className="text-[10px] uppercase">
                  {booking.urgency}
                </Badge>
              )}
            </div>
          </div>

          {booking.preferred_slot_start && (
            <div className="flex items-center justify-between text-sm py-1 border-b">
              <span className="text-muted-foreground">{t.scheduledSlot}</span>
              <span className="font-medium">
                {new Date(booking.preferred_slot_start).toLocaleDateString(lang === 'ur' ? 'ur-PK' : 'en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 pt-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-xs text-muted-foreground">
              {t.statusUpdatedEvery}
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex justify-between gap-3 border-t pt-4">
          <Link href="/services">
            <Button variant="outline" className="h-10 text-sm">
              Back to Directory
            </Button>
          </Link>
          {booking.provider_slug && (
            <Link href={`/p/${booking.provider_slug}`}>
              <Button variant="secondary" className="h-10 text-sm">
                Provider Details
              </Button>
            </Link>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
