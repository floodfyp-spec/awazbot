'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';

export default function TestAgentPage() {
  const router = useRouter();
  const [provider, setProvider] = useState(null);
  const [activeConfig, setActiveConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState(false);

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: prov } = await supabase
        .from('providers')
        .select('*')
        .eq('owner_user_id', user.id)
        .maybeSingle();

      if (!prov) {
        setLoading(false);
        return;
      }
      setProvider(prov);

      const { data: cfg } = await supabase
        .from('agent_configs')
        .select('*')
        .eq('provider_id', prov.id)
        .eq('is_active', true)
        .maybeSingle();

      setActiveConfig(cfg);
      setLoading(false);
    }

    loadData();
  }, []);

  const handleStartTestCall = async () => {
    if (!provider) return;
    setCalling(true);
    try {
      const res = await fetch('/api/calls/web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'provider',
          provider_id: provider.id,
          test: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to start test session.');
        return;
      }

      // Store call session in sessionStorage
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`call_${data.roomName}`, JSON.stringify(data));
      }

      toast.success('LiveKit voice session initiated! Connecting...');
      router.push(`/call/${data.roomName}?provider=${encodeURIComponent(provider.id)}`);
    } catch (err) {
      toast.error('Network error starting test call: ' + err.message);
    } finally {
      setCalling(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-12 text-center text-sm text-muted-foreground">
        Loading test environment...
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 sm:px-6 space-y-6">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Test Your AI Voice Agent
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Start an interactive WebRTC voice call to experience your receptionist firsthand before going live.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Launch Call Card (2 cols) */}
        <div className="md:col-span-2 space-y-4">
          <Card className="shadow-md border-primary/30">
            <CardHeader className="text-center pb-3">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary text-3xl mb-2">
                🎙️
              </div>
              <CardTitle className="text-xl font-bold">
                {activeConfig?.config?.agent_name || `${provider?.business_name} Receptionist`}
              </CardTitle>
              <CardDescription className="text-xs">
                Active Version {activeConfig?.version || 1} • {provider?.trades?.join(', ')}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 text-xs">
              <div className="rounded-lg bg-muted/60 p-4 border space-y-2 text-left">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Provider Status:</span>
                  <Badge variant={provider?.status === 'approved' ? 'default' : 'secondary'} className="capitalize text-[10px]">
                    {provider?.status} (Test mode enabled)
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Urdu Voice:</span>
                  <span className="font-semibold text-foreground">
                    {activeConfig?.config?.voice_ur || 'ur-PK-UzmaNeural'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Initial Greeting (Urdu):</span>
                  <span className="font-sans text-right max-w-[200px] truncate text-foreground" dir="rtl">
                    {activeConfig?.config?.greeting_ur || 'خوش آمدید!'}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground text-center">
                Calls initiated from this test screen are automatically marked with the <span className="font-semibold text-foreground">Test</span> flag in your analytics.
              </p>
            </CardContent>

            <CardFooter className="flex justify-center pt-2">
              <Button
                size="lg"
                onClick={handleStartTestCall}
                disabled={calling}
                className="w-full sm:w-auto h-12 px-8 text-base font-semibold shadow-md gap-2"
              >
                <span>{calling ? 'Connecting Room...' : 'Start Test Call Now'}</span>
                <span>&rarr;</span>
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Right: How to Test Tips (1 col) */}
        <div className="space-y-4">
          <Card className="shadow-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">Test Checklist</CardTitle>
              <CardDescription className="text-xs">
                Suggested dialogue flow to verify your receptionist:
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="rounded-md border p-2.5 bg-muted/30 space-y-1">
                <p className="font-bold text-foreground">1. State Problem</p>
                <p className="font-sans text-muted-foreground" dir="rtl">
                  &quot;میرے گھر میں شارٹ سرکٹ کا مسئلہ ہے&quot;
                </p>
              </div>

              <div className="rounded-md border p-2.5 bg-muted/30 space-y-1">
                <p className="font-bold text-foreground">2. Provide Name</p>
                <p className="font-sans text-muted-foreground" dir="rtl">
                  &quot;میرا نام احمد خان ہے&quot;
                </p>
              </div>

              <div className="rounded-md border p-2.5 bg-muted/30 space-y-1">
                <p className="font-bold text-foreground">3. State Area</p>
                <p className="font-sans text-muted-foreground" dir="rtl">
                  &quot;حیات آباد فیز 2 میں رہتا ہوں&quot;
                </p>
              </div>

              <div className="rounded-md border p-2.5 bg-muted/30 space-y-1">
                <p className="font-bold text-foreground">4. Desired Time</p>
                <p className="font-sans text-muted-foreground" dir="rtl">
                  &quot;کل صبح 10 بجے آ جائیں&quot;
                </p>
              </div>

              <div className="rounded-md border p-2.5 bg-muted/30 space-y-1">
                <p className="font-bold text-foreground">5. Explicit Confirmation</p>
                <p className="font-sans text-muted-foreground" dir="rtl">
                  &quot;جی ہاں، بالکل ٹھیک ہے، بک کر دیں&quot;
                </p>
              </div>

              <p className="text-[10px] text-muted-foreground pt-1 italic">
                Tip: You can use the Dev Mode text buttons on the call screen if you don&apos;t have a microphone handy.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
