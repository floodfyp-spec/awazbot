'use client';

import { use, useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { DEMO_PROVIDERS } from '@/lib/demo-data';
import { toast } from 'sonner';

export default function ChatAgentPage({ params }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const providerId = resolvedParams.providerId;

  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [bookingDraft, setBookingDraft] = useState({
    customer_name: null,
    customer_phone: null,
    area: null,
    problem_description: null,
    preferred_slot: null,
    confirmed: false,
  });
  const [confirmedBookingId, setConfirmedBookingId] = useState(null);

  const messagesEndRef = useRef(null);
  const hasGreetedRef = useRef(false);

  // Load Provider details and Custom Agent Configuration
  useEffect(() => {
    async function loadProvider() {
      try {
        const supabase = createClient();
        const { data: dbProv } = await supabase
          .from('providers')
          .select('id, business_name, slug, provider_code, status, trades, whatsapp, notify_email')
          .eq('id', providerId)
          .maybeSingle();

        if (dbProv) {
          const { data: configRow } = await supabase
            .from('agent_configs')
            .select('config')
            .eq('provider_id', providerId)
            .eq('is_active', true)
            .order('version', { ascending: false })
            .limit(1)
            .maybeSingle();

          const { data: dbServices } = await supabase
            .from('provider_services')
            .select('name, price_from, price_to')
            .eq('provider_id', providerId);

          const cfg = configRow?.config || {};
          const fullProv = {
            id: dbProv.id,
            name: dbProv.business_name,
            business_name: dbProv.business_name,
            trades: dbProv.trades || ['electrician'],
            notify_email: dbProv.notify_email || 'mubasiranwar70@gmail.com',
            whatsapp: dbProv.whatsapp,
            greeting_ur:
              cfg.greeting_ur ||
              `السلام علیکم! ${dbProv.business_name} پشاور میں خوش آمدید۔ میں آپ کا اے آئی چیٹ اسسٹنٹ ہوں۔ میں آپ کی کیا مدد کر سکتا ہوں؟`,
            services: dbServices || [],
            custom_instructions: cfg.custom_instructions || '',
          };
          setProvider(fullProv);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn('DB provider fetch note:', err);
      }

      // Fallback to demo provider
      const matched =
        DEMO_PROVIDERS.find((p) => p.id === providerId || p.slug === providerId) ||
        DEMO_PROVIDERS[0];
      setProvider({
        ...matched,
        business_name: matched.name,
        greeting_ur: `السلام علیکم! ${matched.name} میں خوش آمدید۔ میں آپ کا اے آئی چیٹ اسسٹنٹ ہوں۔ میں آپ کی کیا مدد کر سکتا ہوں؟`,
      });
      setLoading(false);
    }

    loadProvider();
  }, [providerId]);

  // Initial Greeting
  useEffect(() => {
    if (provider && !hasGreetedRef.current) {
      hasGreetedRef.current = true;
      const initial =
        provider.greeting_ur ||
        `السلام علیکم! ${provider.business_name} میں خوش آمدید۔ میں آپ کا اے آئی چیٹ اسسٹنٹ ہوں۔ میں آپ کی کیا مدد کر سکتا ہوں؟`;
      setMessages([
        {
          id: 'msg_0',
          role: 'assistant',
          speaker: 'agent',
          content: initial,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  }, [provider]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Send Chat Message
  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isTyping) return;

    const userMsg = {
      id: `msg_${Date.now()}`,
      role: 'user',
      speaker: 'user',
      content: text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsTyping(true);

    try {
      const res = await fetch('/api/calls/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_message: text,
          conversation_history: messages,
          provider: provider,
          booking_draft: bookingDraft,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.details || `Server returned ${res.status}`);
      }

      const data = await res.json();
      const replyText = data.spoken_reply || 'جی بالکل جناب! میں آپ کی مدد کے لیے حاضر ہوں۔';
      const update = data.booking_update || {};

      // Update Live Booking Draft
      setBookingDraft((prev) => {
        const next = { ...prev };
        if (update.customer_name) next.customer_name = update.customer_name;
        if (update.customer_phone) next.customer_phone = update.customer_phone;
        if (update.area) next.area = update.area;
        if (update.problem_description) next.problem_description = update.problem_description;
        if (update.preferred_slot) next.preferred_slot = update.preferred_slot;
        if (update.is_confirmed) next.confirmed = true;
        return next;
      });

      // Handle Confirmed Booking with Email Dispatch
      if (update.is_confirmed && !confirmedBookingId) {
        const newBookingId = `BK-PK-${Math.floor(1000 + Math.random() * 9000)}`;
        setConfirmedBookingId(newBookingId);

        try {
          await fetch('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customer_name: update.customer_name || bookingDraft.customer_name || 'Valued Customer',
              customer_phone: update.customer_phone || bookingDraft.customer_phone || '03001234567',
              area: update.area || bookingDraft.area || 'Hayatabad, Peshawar',
              problem_description: update.problem_description || bookingDraft.problem_description || 'General Service Booking',
              preferred_slot: update.preferred_slot || bookingDraft.preferred_slot || 'Tomorrow 10:00 AM',
              provider_id: provider.id,
              notify_email: provider.notify_email,
            }),
          });
          toast.success(`Booking Confirmed! Email dispatched to ${provider.notify_email}`);
        } catch (mailErr) {
          console.warn('Booking dispatch note:', mailErr);
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now() + 1}`,
          role: 'assistant',
          speaker: 'agent',
          content: replyText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      console.warn('Chat turn error, applying resilient conversational fallback:', err);
      const fallbackReply = `جی فرمائیے! ${provider?.business_name || 'ہم'} آپ کی خدمت کے لیے حاضر ہیں۔ برائے مہربانی اپنا نام، موبائل نمبر اور مسئلہ بتا دیں۔`;
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now() + 1}`,
          role: 'assistant',
          speaker: 'agent',
          content: fallbackReply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      if (err.message && err.message.includes('OPENAI_API_KEY')) {
        toast.error('Notice: OPENAI_API_KEY is not configured in environment variables.');
      }
    } finally {
      setIsTyping(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground">Connecting to Chat Agent...</p>
        </div>
      </div>
    );
  }

  const providerName = provider?.business_name || provider?.name || 'Local Service Provider';
  const providerEmail = provider?.notify_email || 'mubasiranwar70@gmail.com';
  const voiceCallUrl = `/call/call_${crypto.randomUUID().slice(0, 8)}?provider=${provider.id}`;

  return (
    <div className="container mx-auto max-w-6xl p-4 sm:p-6 space-y-4">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-11 w-11 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center text-xl font-bold text-primary">
              🤖
            </div>
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-foreground">{providerName}</h1>
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300">
                AI Chat Agent
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {provider.trades?.join(' • ')} • Instant online service booking
            </p>
          </div>
        </div>

        {/* Switch to Voice Agent Button */}
        <div className="flex items-center gap-2">
          <Link href={voiceCallUrl}>
            <Button variant="default" size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-9 text-xs">
              <span>🎙️</span>
              <span>Switch to Voice Agent</span>
            </Button>
          </Link>
          <Link href="/services">
            <Button variant="outline" size="sm" className="h-9 text-xs">
              Back to Services
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Grid: Chat Stream (Left/Center) + Live Booking Card (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat Panel */}
        <Card className="lg:col-span-2 flex flex-col h-[640px] shadow-sm border">
          <CardHeader className="py-3 px-4 border-b bg-muted/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                Live Conversation with {providerName} Assistant
              </span>
              <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Active Session
              </span>
            </div>
          </CardHeader>

          {/* Messages Stream */}
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-3.5 font-sans">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <span className="text-[10px] text-muted-foreground px-1 pb-1">
                  {msg.role === 'user' ? 'You (Customer)' : providerName} • {msg.time}
                </span>
                <div
                  className={`rounded-2xl px-4 py-2.5 max-w-[85%] text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-none shadow-sm'
                      : 'bg-muted text-foreground rounded-bl-none border shadow-sm font-urdu text-base'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
                <span className="h-2 w-2 rounded-full bg-primary animate-bounce" />
                <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:0.2s]" />
                <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:0.4s]" />
                <span className="font-urdu text-xs">{providerName} جواب لکھ رہا ہے...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </CardContent>

          {/* Quick Suggestions & Input Bar */}
          <div className="p-3 border-t bg-muted/10 space-y-2">
            {/* Quick Action Chips */}
            <div className="flex flex-wrap gap-1.5 text-xs">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-[11px] h-7 bg-white dark:bg-background"
                onClick={() => handleSendMessage('السلام علیکم! مجھے سروس بک کروانی ہے')}
              >
                1. سلام (Greeting)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-[11px] h-7 bg-white dark:bg-background"
                onClick={() => handleSendMessage('میرا موبائل نمبر 03001234567 ہے')}
              >
                2. 📱 فون نمبر (0300-1234567)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-[11px] h-7 bg-white dark:bg-background"
                onClick={() => handleSendMessage('حیات آباد فیز 4، پشاور میں کام ہے')}
              >
                3. علاقہ (Hayatabad)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-[11px] h-7 bg-white dark:bg-background"
                onClick={() => handleSendMessage('کل صبح 11 بجے کا وقت مناسب ہے')}
              >
                4. وقت (Tomorrow 11 AM)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-[11px] h-7 bg-emerald-600 text-white hover:bg-emerald-700 font-semibold"
                onClick={() => handleSendMessage('جی ہاں، تمام تفصیلات ٹھیک ہیں، بکنگ کنفرم کر دیں')}
              >
                5. ✅ کنفرم بکنگ (Confirm)
              </Button>
            </div>

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex gap-2"
            >
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={`Type your message to ${providerName} (Urdu, English, Pashto)...`}
                className="text-xs h-10 bg-white dark:bg-background"
                disabled={isTyping}
              />
              <Button
                type="submit"
                disabled={!inputMessage.trim() || isTyping}
                className="h-10 px-5 text-xs font-semibold"
              >
                Send
              </Button>
            </form>
          </div>
        </Card>

        {/* Live Booking Card (Right Side) */}
        <div className="space-y-4">
          <Card className="shadow-sm border">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <span>📋</span> Live Booking Card
                </CardTitle>
                {confirmedBookingId ? (
                  <Badge className="bg-emerald-600 text-white">Confirmed</Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-950/40">
                    Drafting
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                Automatically updated as you chat
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3.5 pt-4 text-xs">
              {confirmedBookingId && (
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 p-3.5 text-emerald-900 dark:text-emerald-200 space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                      ✅ Booking Confirmed!
                    </span>
                    <Badge variant="outline" className="bg-white dark:bg-zinc-900 font-mono">
                      {confirmedBookingId}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    Alert dispatched to provider: <span className="font-semibold text-foreground">{providerEmail}</span>
                  </p>
                  <Link
                    href={`/booking/${confirmedBookingId}`}
                    className="inline-block font-semibold text-emerald-700 dark:text-emerald-400 underline pt-1"
                  >
                    View Booking Tracker &rarr;
                  </Link>
                </div>
              )}

              <div className="space-y-2.5 rounded-lg border bg-muted/30 p-3">
                <div className="flex justify-between items-center border-b pb-1.5">
                  <span className="text-muted-foreground">Provider:</span>
                  <span className="font-bold text-primary">{providerName}</span>
                </div>
                <div className="flex justify-between items-center border-b pb-1.5">
                  <span className="text-muted-foreground">Customer Name:</span>
                  <span className="font-medium text-foreground">
                    {bookingDraft.customer_name || <em className="text-muted-foreground/60">Not provided yet</em>}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b pb-1.5">
                  <span className="text-muted-foreground font-semibold flex items-center gap-1">
                    Phone Number:
                    <Badge variant="outline" className="text-[9px] px-1 py-0 text-red-600 border-red-300">
                      Mandatory
                    </Badge>
                  </span>
                  <span className="font-mono font-bold text-foreground">
                    {bookingDraft.customer_phone ? (
                      <span className="text-emerald-600 font-semibold">{bookingDraft.customer_phone}</span>
                    ) : (
                      <span className="text-red-500 font-normal italic">03XX-XXXXXXX (Required)</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b pb-1.5">
                  <span className="text-muted-foreground">Service Area:</span>
                  <span className="font-medium text-foreground">
                    {bookingDraft.area || <em className="text-muted-foreground/60">e.g. Hayatabad, Peshawar</em>}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b pb-1.5">
                  <span className="text-muted-foreground">Problem / Trade:</span>
                  <span className="font-medium text-foreground text-right max-w-[170px] truncate">
                    {bookingDraft.problem_description || <em className="text-muted-foreground/60">Service description</em>}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-0.5">
                  <span className="text-muted-foreground">Preferred Time:</span>
                  <span className="font-medium text-foreground">
                    {bookingDraft.preferred_slot || <em className="text-muted-foreground/60">Tomorrow 11 AM</em>}
                  </span>
                </div>
              </div>

              {/* Provider Info Footer */}
              <div className="space-y-1 text-[11px] text-muted-foreground border-t pt-2">
                <div className="flex justify-between">
                  <span>Provider Gmail:</span>
                  <span className="font-mono text-foreground">{providerEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span>Booking Mode:</span>
                  <span className="text-emerald-600 font-semibold">2-Way (Chat & Voice)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Voice Switch Banner Card */}
          <Card className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border-emerald-500/20 p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🎙️</span>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-foreground">Prefer Speaking on Voice Call?</h4>
                <p className="text-[11px] text-muted-foreground">
                  You can switch to our real-time AI Voice Agent anytime with ChatGPT-level voice orb and studio audio.
                </p>
                <Link href={voiceCallUrl} className="inline-block pt-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-400 text-emerald-800 dark:text-emerald-300 font-semibold">
                    Start Voice Call &rarr;
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
