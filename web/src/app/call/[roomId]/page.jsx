'use client';

import { use, useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRoomContext,
  useConnectionState,
} from '@livekit/components-react';
import { ConnectionState, RoomEvent } from 'livekit-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { getDictionary } from '@/lib/i18n';
import { toast } from 'sonner';

/**
 * Inner call component rendered inside LiveKitRoom context
 */
function CallInterface({ roomId, lang, callData }) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const t = getDictionary(lang);

  // Agent & call states
  const [agentState, setAgentState] = useState('connecting'); // connecting, listening, thinking, speaking
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState([]);
  const [bookingDraft, setBookingDraft] = useState({
    customer_name: null,
    area: null,
    problem_description: null,
    preferred_slot: null,
    confirmed: false,
  });
  const [confirmedBookingId, setConfirmedBookingId] = useState(null);

  // Dev simulation input
  const [devInput, setDevInput] = useState('');
  const transcriptEndRef = useRef(null);

  // Scroll transcript to bottom on new items
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // Duration timer
  useEffect(() => {
    let timer;
    if (connectionState === ConnectionState.Connected) {
      timer = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [connectionState]);

  // Format seconds to mm:ss
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Listen to LiveKit data packets on topics: awaz.booking, awaz.agent_state, awaz.transcript
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload, participant, kind, topic) => {
      try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text);

        if (topic === 'awaz.booking') {
          if (data.type === 'draft_update') {
            setBookingDraft((prev) => ({
              ...prev,
              ...(data.draft || {}),
            }));
          } else if (data.type === 'booking_confirmed') {
            setConfirmedBookingId(data.booking_id);
            if (data.draft) {
              setBookingDraft(data.draft);
            }
            toast.success(`Booking confirmed! ID: ${data.booking_id}`);
          }
        } else if (topic === 'awaz.agent_state') {
          if (data.state) {
            setAgentState(data.state);
          }
        } else if (topic === 'awaz.transcript') {
          setTranscript((prev) => [
            ...prev,
            { speaker: data.speaker, text: data.text, time: new Date().toLocaleTimeString() },
          ]);
        }
      } catch (err) {
        console.error('Error decoding room data packet:', err);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room]);

  // Toggle Microphone
  const toggleMic = async () => {
    if (!room?.localParticipant) return;
    try {
      const nextMuted = !isMuted;
      await room.localParticipant.setMicrophoneEnabled(!nextMuted);
      setIsMuted(nextMuted);
      toast.info(nextMuted ? 'Microphone muted' : 'Microphone unmuted');
    } catch (err) {
      toast.error('Could not toggle microphone: ' + err.message);
    }
  };

  // Send typed simulated turn via 'awaz.user_turn' data topic
  const sendUserTurn = useCallback(
    async (textToSend) => {
      const content = (textToSend || devInput).trim();
      if (!content || !room?.localParticipant) return;

      try {
        const payload = new TextEncoder().encode(content);
        await room.localParticipant.publishData(payload, {
          topic: 'awaz.user_turn',
          reliable: true,
        });

        // Optimistically record user turn in local transcript
        setTranscript((prev) => [
          ...prev,
          { speaker: 'user', text: content, time: new Date().toLocaleTimeString() },
        ]);
        setDevInput('');
        setAgentState('thinking');
      } catch (err) {
        toast.error('Failed to send text turn: ' + err.message);
      }
    },
    [devInput, room]
  );

  // Agent State Color & Indicator
  const getStateVisuals = () => {
    switch (agentState) {
      case 'speaking':
        return {
          color: 'bg-blue-500 shadow-blue-500/50',
          label: 'AwazBot Speaking',
          badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
        };
      case 'thinking':
        return {
          color: 'bg-amber-500 shadow-amber-500/50',
          label: 'AwazBot Thinking',
          badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
        };
      case 'listening':
        return {
          color: 'bg-emerald-500 shadow-emerald-500/50',
          label: 'Listening to you...',
          badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
        };
      default:
        return {
          color: 'bg-zinc-400 shadow-zinc-400/50',
          label: 'Connecting...',
          badgeClass: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300',
        };
    }
  };

  const visuals = getStateVisuals();

  return (
    <div className="container mx-auto max-w-4xl p-4 sm:p-6 space-y-6">
      {/* Top Status Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <span className={`inline-flex h-4 w-4 rounded-full ${visuals.color} animate-pulse`} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">
              Khan Electric — Receptionist
            </h1>
            <p className="text-xs text-muted-foreground font-mono">
              Room: {roomId?.slice(0, 18)}... | Call ID: {callData?.callId?.slice(0, 14)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className={`text-xs px-2.5 py-1 ${visuals.badgeClass}`}>
            {visuals.label}
          </Badge>
          <span className="font-mono text-sm font-semibold px-3 py-1 rounded bg-muted">
            {formatTime(duration)}
          </span>
          <Link href="/services">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => room?.disconnect()}
              className="font-semibold shadow-sm"
            >
              {t.endCall}
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Live Booking Card */}
        <Card className="shadow-sm border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold">
                Live Booking Card
              </CardTitle>
              {confirmedBookingId ? (
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">
                  Confirmed
                </Badge>
              ) : (
                <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-950/40">
                  Drafting
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs">
              Synchronized automatically via LiveKit WebRTC data topic &apos;awaz.booking&apos;
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 text-sm">
            {confirmedBookingId && (
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 p-3 text-emerald-900 dark:text-emerald-200 space-y-1">
                <p className="font-semibold text-xs uppercase tracking-wide">
                  Booking Confirmed!
                </p>
                <p className="text-sm">
                  Ref ID: <span className="font-mono font-bold">{confirmedBookingId}</span>
                </p>
                <Link
                  href={`/booking/${confirmedBookingId}`}
                  className="inline-block text-xs font-semibold text-emerald-700 dark:text-emerald-400 underline pt-1"
                >
                  View Booking Tracker &rarr;
                </Link>
              </div>
            )}

            <div className="space-y-3 rounded-lg border bg-muted/40 p-3.5">
              <div className="flex justify-between items-center text-xs border-b pb-2">
                <span className="text-muted-foreground">Customer Name:</span>
                <span className="font-medium text-foreground">
                  {bookingDraft.customer_name || <em className="text-muted-foreground/60">Listening...</em>}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs border-b pb-2">
                <span className="text-muted-foreground">Service Area:</span>
                <span className="font-medium text-foreground">
                  {bookingDraft.area || <em className="text-muted-foreground/60">e.g. Hayatabad, University Town</em>}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs border-b pb-2">
                <span className="text-muted-foreground">Problem / Issue:</span>
                <span className="font-medium text-foreground text-right max-w-[200px] truncate">
                  {bookingDraft.problem_description || <em className="text-muted-foreground/60">e.g. UPS tuning, Short circuit</em>}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs border-b pb-2">
                <span className="text-muted-foreground">Preferred Time:</span>
                <span className="font-medium text-foreground">
                  {bookingDraft.preferred_slot || bookingDraft.preferred_time || <em className="text-muted-foreground/60">Tomorrow 10 AM</em>}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs pt-1">
                <span className="text-muted-foreground">Confirmed by Caller:</span>
                <span className="font-medium">
                  {bookingDraft.confirmed || bookingDraft.customer_confirmed ? (
                    <span className="text-emerald-600 font-bold">YES (Verified)</span>
                  ) : (
                    <span className="text-amber-600">Pending explicit recap</span>
                  )}
                </span>
              </div>
            </div>

            {/* In-Call Controls */}
            <div className="flex items-center justify-between pt-2">
              <Button
                variant={isMuted ? 'destructive' : 'outline'}
                size="sm"
                onClick={toggleMic}
                className="gap-2 text-xs"
              >
                {isMuted ? 'Unmute Mic' : 'Mute Mic'}
              </Button>
              <span className="text-xs text-muted-foreground">
                Connection: <span className="text-emerald-600 font-semibold capitalize">{connectionState}</span>
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Live Conversation Transcript */}
        <Card className="shadow-sm flex flex-col h-[400px]">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-bold">
              Live Transcript
            </CardTitle>
            <CardDescription className="text-xs">
              Live bilingual speech transcription (Urdu / Pashto / English)
            </CardDescription>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-4 space-y-3 font-sans text-sm">
            {transcript.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center text-xs text-muted-foreground p-6">
                Waiting for conversation to start... AwazBot will greet you shortly.
              </div>
            ) : (
              transcript.map((turn, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${
                    turn.speaker === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <span className="text-[10px] text-muted-foreground px-1 pb-0.5">
                    {turn.speaker === 'user' ? 'Customer' : 'AwazBot'} • {turn.time}
                  </span>
                  <div
                    className={`rounded-2xl px-3.5 py-2 max-w-[85%] text-xs leading-relaxed ${
                      turn.speaker === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-none'
                        : 'bg-muted text-foreground rounded-bl-none border'
                    }`}
                  >
                    {turn.text}
                  </div>
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </CardContent>
        </Card>
      </div>

      {/* Dev Mode Simulated Turns Box (Spec requirement) */}
      <Card className="border-dashed border-amber-300 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-center justify-between">
            <span>Dev Mode: Simulated Typed Urdu Turns (No Mic Required)</span>
            <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-800">
              Interactive Test Pipeline
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7 bg-white dark:bg-background"
              onClick={() => sendUserTurn('السلام علیکم، میرے گھر میں شارٹ سرکٹ کا مسئلہ ہے')}
            >
              1. مسئلہ (Short Circuit)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7 bg-white dark:bg-background"
              onClick={() => sendUserTurn('میرا نام احمد خان ہے')}
            >
              2. نام (Ahmad Khan)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7 bg-white dark:bg-background"
              onClick={() => sendUserTurn('حیات آباد فیز 2 میں رہتا ہوں')}
            >
              3. علاقہ (Hayatabad Phase 2)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7 bg-white dark:bg-background"
              onClick={() => sendUserTurn('کل صبح 10 بجے کا وقت ٹھیک ہے')}
            >
              4. وقت (Tomorrow 10 AM)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7 bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => sendUserTurn('جی ہاں، بالکل ٹھیک ہے، بک کر دیں')}
            >
              5. تصدیق (Haan, Confirm)
            </Button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendUserTurn();
            }}
            className="flex gap-2"
          >
            <Input
              value={devInput}
              onChange={(e) => setDevInput(e.target.value)}
              placeholder="Type any message in Urdu, Pashto, or English..."
              className="text-xs h-9 bg-white dark:bg-background"
            />
            <Button type="submit" size="sm" className="h-9 px-4 text-xs font-semibold">
              Send Turn
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Main Call Page with LiveKit Room Provider wrapper
 */
export default function CallScreenPage({ params }) {
  const { roomId } = use(params);
  const [lang, setLang] = useState('en');
  const [callSession, setCallSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const match = document.cookie.match(/awaz_lang=([^;]+)/);
    if (match) {
      setLang(match[1]);
    }
  }, []);

  // Fetch or retrieve token from sessionStorage or API
  useEffect(() => {
    async function initSession() {
      if (typeof window === 'undefined') return;

      // 1. Check sessionStorage first
      const stored = sessionStorage.getItem(`call_${roomId}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.token) {
            setCallSession(parsed);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Could not parse stored call session', e);
        }
      }

      // 2. Fetch fresh token from /api/calls/web
      try {
        const res = await fetch('/api/calls/web', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'provider',
            provider_id: 'd1111111-1111-1111-1111-111111111101', // Khan Electric fallback
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Failed to initialize call session.');
        } else {
          setCallSession(data);
          sessionStorage.setItem(`call_${roomId}`, JSON.stringify(data));
        }
      } catch (err) {
        setError('Network error fetching call token: ' + err.message);
      } finally {
        setLoading(false);
      }
    }

    initSession();
  }, [roomId]);

  if (loading) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground">Connecting to AwazBot KP...</p>
        </div>
      </div>
    );
  }

  if (error || !callSession?.token) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center p-6">
        <Card className="text-center border-destructive/30">
          <CardHeader>
            <CardTitle className="text-lg text-destructive">Connection Error</CardTitle>
            <CardDescription className="text-xs">
              {error || 'Unable to obtain a valid LiveKit session token.'}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center gap-3">
            <Link href="/services">
              <Button variant="outline" size="sm">Back to Services</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const livekitUrl =
    callSession.livekitUrl ||
    process.env.NEXT_PUBLIC_LIVEKIT_URL ||
    'wss://awazbot-kp-test.livekit.cloud';

  return (
    <LiveKitRoom
      token={callSession.token}
      serverUrl={livekitUrl}
      connect={true}
      audio={true}
      video={false}
      data-lk-theme="default"
      onError={(err) => console.error('LiveKit Room Error:', err)}
    >
      <RoomAudioRenderer />
      <CallInterface roomId={roomId} lang={lang} callData={callSession} />
    </LiveKitRoom>
  );
}
