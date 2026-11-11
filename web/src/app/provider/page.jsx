import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Provider Dashboard — AwazBot KP',
};

export default async function ProviderDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 1. Fetch provider details
  const { data: provider } = await supabase
    .from('providers')
    .select('*')
    .eq('owner_user_id', user.id)
    .maybeSingle();

  // If no provider profile, show onboarding prompt
  if (!provider) {
    return (
      <div className="container mx-auto max-w-xl px-4 py-12 text-center">
        <Card className="shadow-md border-primary/30">
          <CardHeader className="space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-3xl">
              🏢
            </div>
            <CardTitle className="text-2xl font-bold">Welcome to AwazBot KP</CardTitle>
            <CardDescription className="text-sm">
              You haven&apos;t set up your local service business profile yet. Complete our 3-minute onboarding to create your AI voice receptionist.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center pt-2">
            <Link href="/provider/onboarding">
              <Button className="h-11 px-8 text-sm font-semibold shadow-md">
                Start Provider Onboarding &rarr;
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // 2. Fetch stats: bookings, calls, active config
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: todayBookings } = await supabase
    .from('bookings')
    .select('id, customer_name, area, problem_text, urgency, status, slot_start, created_at')
    .eq('provider_id', provider.id)
    .gte('created_at', todayStart.toISOString())
    .order('created_at', { ascending: false });

  const { data: recentBookings } = await supabase
    .from('bookings')
    .select('id, customer_name, area, problem_text, urgency, status, slot_start, created_at')
    .eq('provider_id', provider.id)
    .order('created_at', { ascending: false })
    .limit(5);

  const { data: recentCalls } = await supabase
    .from('calls')
    .select('id, channel, started_at, duration_s, language, outcome, is_test')
    .eq('provider_id', provider.id)
    .order('started_at', { ascending: false })
    .limit(10);

  const { data: activeConfig } = await supabase
    .from('agent_configs')
    .select('version, created_at')
    .eq('provider_id', provider.id)
    .eq('is_active', true)
    .maybeSingle();

  const emergencyCount = recentCalls?.filter((c) => c.outcome === 'emergency').length || 0;
  const isPending = provider.status === 'pending';

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 space-y-6">
      {/* Pending status notification banner */}
      {isPending && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-4 text-amber-900 dark:text-amber-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-semibold text-sm">Account Status: Pending Admin Review</p>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                Your profile is hidden from the public search directory until verified. You can test your voice receptionist anytime.
              </p>
            </div>
          </div>
          <Link href="/provider/agent/test">
            <Button size="sm" variant="outline" className="border-amber-400 bg-white dark:bg-background text-xs font-semibold h-8 shrink-0">
              Test Agent Now &rarr;
            </Button>
          </Link>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">
              Today&apos;s Bookings
            </CardDescription>
            <CardTitle className="text-2xl font-black text-foreground">
              {todayBookings?.length || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/provider/bookings" className="text-xs font-semibold text-primary hover:underline">
              View all bookings &rarr;
            </Link>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">
              Recent Calls
            </CardDescription>
            <CardTitle className="text-2xl font-black text-foreground">
              {recentCalls?.length || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/provider/calls" className="text-xs font-semibold text-primary hover:underline">
              Inspect transcripts &rarr;
            </Link>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">
              Active Agent
            </CardDescription>
            <CardTitle className="text-2xl font-black text-foreground">
              v{activeConfig?.version || 1}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/provider/agent" className="text-xs font-semibold text-primary hover:underline">
              Configure personality &rarr;
            </Link>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">
              Emergency Alerts
            </CardDescription>
            <CardTitle className="text-2xl font-black text-destructive">
              {emergencyCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {emergencyCount === 0 ? 'No safety flags detected' : 'Requires immediate attention'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Two Columns: Recent Bookings & Recent Calls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Recent Bookings Table */}
        <Card className="shadow-xs flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-bold">Recent Bookings</CardTitle>
              <CardDescription className="text-xs">
                Live customer reservations across Web and WhatsApp
              </CardDescription>
            </div>
            <Link href="/provider/bookings">
              <Button variant="ghost" size="sm" className="text-xs font-semibold h-8">
                View All
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            {!recentBookings || recentBookings.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No bookings recorded yet. Start a test call to create your first booking!
              </div>
            ) : (
              <div className="divide-y text-xs">
                {recentBookings.map((b) => (
                  <div key={b.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="space-y-1 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-sm">{b.customer_name}</span>
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                          {b.area}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground truncate max-w-[260px]">{b.problem_text}</p>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <Badge
                        variant={
                          b.status === 'confirmed'
                            ? 'default'
                            : b.status === 'rejected'
                            ? 'destructive'
                            : 'secondary'
                        }
                        className="capitalize text-[11px]"
                      >
                        {b.status}
                      </Badge>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Recent Calls Table */}
        <Card className="shadow-xs flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-bold">Recent Calls</CardTitle>
              <CardDescription className="text-xs">
                Interactive voice reception history
              </CardDescription>
            </div>
            <Link href="/provider/calls">
              <Button variant="ghost" size="sm" className="text-xs font-semibold h-8">
                View All
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            {!recentCalls || recentCalls.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No voice sessions recorded yet.
              </div>
            ) : (
              <div className="divide-y text-xs">
                {recentCalls.map((c) => (
                  <div key={c.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold uppercase tracking-wider text-[11px] text-foreground">
                          {c.channel}
                        </span>
                        {c.is_test && (
                          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-300 py-0">
                            Test
                          </Badge>
                        )}
                        <span className="text-muted-foreground">({c.language})</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Duration: {c.duration_s || 0}s | ID: {c.id.slice(0, 8)}...
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge
                        variant={c.outcome === 'emergency' ? 'destructive' : 'outline'}
                        className="capitalize text-[10px]"
                      >
                        {c.outcome || 'completed'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
