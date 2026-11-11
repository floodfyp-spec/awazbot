'use client';

import { useState, useEffect } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';

export default function ProviderCallsPage() {
  const [provider, setProvider] = useState(null);
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  // Transcript dialog state
  const [selectedCall, setSelectedCall] = useState(null);
  const [turns, setTurns] = useState([]);
  const [turnsLoading, setTurnsLoading] = useState(false);

  useEffect(() => {
    async function loadCalls() {
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

      const { data: callsData, error } = await supabase
        .from('calls')
        .select('*')
        .eq('provider_id', prov.id)
        .order('started_at', { ascending: false });

      if (!error && callsData) {
        setCalls(callsData);
      }
      setLoading(false);
    }

    loadCalls();
  }, []);

  const handleOpenTranscript = async (call) => {
    setSelectedCall(call);
    setTurnsLoading(true);
    const supabase = createClient();

    const { data: turnsData, error } = await supabase
      .from('call_turns')
      .select('*')
      .eq('call_id', call.id)
      .order('ts', { ascending: true });

    if (!error && turnsData) {
      setTurns(turnsData);
    } else {
      setTurns([]);
      toast.info('No recorded transcript turns for this call session.');
    }
    setTurnsLoading(false);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-12 text-center text-sm text-muted-foreground">
        Loading call logs...
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Call Logs & Transcripts
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review live voice reception sessions, speech recognition turns, and customer inquiries.
          </p>
        </div>
        <Badge variant="outline" className="text-xs px-2.5 py-1">
          Total Calls: {calls.length}
        </Badge>
      </div>

      <Card className="shadow-xs overflow-hidden">
        <CardContent className="p-0">
          {calls.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground">
              No calls recorded yet. Click &quot;Test My Agent&quot; to initiate a test call.
            </div>
          ) : (
            <div className="divide-y text-xs">
              {calls.map((c) => (
                <div
                  key={c.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm uppercase tracking-wide text-foreground">
                        {c.channel}
                      </span>
                      {c.is_test && (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-amber-50 text-amber-800 border-amber-300 py-0"
                        >
                          Test
                        </Badge>
                      )}
                      <Badge
                        variant={c.outcome === 'emergency' ? 'destructive' : 'secondary'}
                        className="capitalize text-[10px] py-0"
                      >
                        {c.outcome || 'completed'}
                      </Badge>
                      <span className="text-muted-foreground font-mono">
                        Lang: {c.language?.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>ID: {c.id.slice(0, 12)}...</span>
                      <span>•</span>
                      <span>Duration: {c.duration_s || 0}s</span>
                      <span>•</span>
                      <span>
                        {new Date(c.started_at).toLocaleString([], {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenTranscript(c)}
                    className="h-8 px-3 text-xs font-semibold shrink-0"
                  >
                    View Transcript &rarr;
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transcript Viewer Dialog */}
      <Dialog open={!!selectedCall} onOpenChange={(open) => !open && setSelectedCall(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              Call Transcript — {selectedCall?.id?.slice(0, 10)}...
            </DialogTitle>
            <DialogDescription className="text-xs">
              Channel: {selectedCall?.channel} • Duration: {selectedCall?.duration_s || 0}s • Outcome: {selectedCall?.outcome}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 p-3 bg-muted/20 rounded-lg border text-xs">
            {turnsLoading ? (
              <p className="text-center text-muted-foreground italic py-8">
                Loading transcript turns...
              </p>
            ) : turns.length === 0 ? (
              <p className="text-center text-muted-foreground italic py-8">
                No individual turns stored for this call.
              </p>
            ) : (
              turns.map((turn, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${
                    turn.speaker === 'customer' ? 'items-end' : 'items-start'
                  }`}
                >
                  <span className="text-[10px] text-muted-foreground px-1 pb-0.5">
                    {turn.speaker === 'customer' ? 'Customer' : 'AwazBot'} • {turn.lang || 'ur'}
                  </span>
                  <div
                    className={`rounded-2xl px-3.5 py-2 max-w-[85%] text-xs leading-relaxed ${
                      turn.speaker === 'customer'
                        ? 'bg-primary text-primary-foreground rounded-br-none font-sans'
                        : 'bg-card text-foreground rounded-bl-none border font-sans'
                    }`}
                  >
                    {turn.text}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
