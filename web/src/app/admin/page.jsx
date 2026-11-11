import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Admin Control Center — AwazBot KP',
};

export default async function AdminPortalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from('profiles').select('*').eq('id', user.id).single()
    : { data: null };

  const { count: providerCount } = await supabase
    .from('providers')
    .select('*', { count: 'exact', head: true });

  const { count: bookingCount } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true });

  const { count: callCount } = await supabase
    .from('calls')
    .select('*', { count: 'exact', head: true });

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Admin Control Center</h1>
          <p className="text-muted-foreground mt-1">
            Platform governance and system overview
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="destructive" className="px-3 py-1 text-xs">
            Admin Access
          </Badge>
          <span className="text-xs text-muted-foreground">
            {profile?.full_name || user?.email}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Registered Providers</CardTitle>
            <CardDescription>Peshawar verified service catalog</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{providerCount ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Total across 4 trades</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Total Bookings</CardTitle>
            <CardDescription>Voice & WhatsApp job orders</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{bookingCount ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Pending and confirmed</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">LiveKit Voice Calls</CardTitle>
            <CardDescription>Total incoming voice sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{callCount ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Real-time STT/LLM/TTS sessions</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
