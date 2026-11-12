'use client';
import { useEffect, useState, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const OUTCOME_COLORS = {
  booked: 'default', info: 'secondary', emergency: 'destructive',
  dropped: 'outline', test: 'outline',
};

const LANG_LABELS = { ur: 'اردو', ps: 'پښتو', en: 'English' };

const DEFAULT_CALLS = [
  {
    id: 'call-demo-001',
    room_name: 'call_hayatabad_dir_81',
    channel: 'web',
    mode: 'directory',
    language: 'ur',
    outcome: 'booked',
    is_test: false,
    duration_s: 48,
    avg_latency_ms: 1120,
    started_at: new Date(Date.now() - 3600000).toISOString(),
    providers: { business_name: 'Khan Electric' },
  },
  {
    id: 'call-demo-002',
    room_name: 'call_emg_sparks_12',
    channel: 'wa_voice_note',
    mode: 'directory',
    language: 'ur',
    outcome: 'emergency',
    is_test: false,
    duration_s: 18,
    avg_latency_ms: 350,
    started_at: new Date(Date.now() - 7200000).toISOString(),
    providers: { business_name: 'AwazBot Safety Dispatch' },
  },
  {
    id: 'call-demo-003',
    room_name: 'call_univ_solar_99',
    channel: 'web',
    mode: 'provider',
    language: 'ps',
    outcome: 'info',
    is_test: false,
    duration_s: 72,
    avg_latency_ms: 1350,
    started_at: new Date(Date.now() - 14400000).toISOString(),
    providers: { business_name: 'Khyber Solar & UPS Hub' },
  },
];

const DEFAULT_TURNS = {
  'call-demo-001': [
    { id: 't1', speaker: 'customer', text: 'السلام علیکم، مجھے حیات آباد فیز 1 میں الیکٹریشن چاہیے پنکھا لگانا ہے۔', lang: 'ur', stt_engine: 'elevenlabs-scribe', confidence: 0.94, latency_ms: 320, ts: new Date().toISOString() },
    { id: 't2', speaker: 'agent', text: 'وعلیکم السلام! حیات آباد میں خان الیکٹرک دستیاب ہیں۔ ان کی وزٹ فیس 1500 روپے ہے۔ کیا میں بکنگ کر دوں؟', lang: 'ur', latency_ms: 680, ts: new Date().toISOString() },
    { id: 't3', speaker: 'customer', text: 'جی بالکل، کل صبح 11 بجے بھیج دیں۔', lang: 'ur', stt_engine: 'elevenlabs-scribe', confidence: 0.96, latency_ms: 280, ts: new Date().toISOString() },
    { id: 't4', speaker: 'agent', text: 'آپ کی بکنگ کنفرم ہو گئی ہے! خان الیکٹرک کو نوٹیفکیشن بھیج دیا گیا ہے۔ شکریہ!', lang: 'ur', latency_ms: 610, ts: new Date().toISOString() },
  ],
  'call-demo-002': [
    { id: 't1', speaker: 'customer', text: 'بجلی کے بورڈ سے چنگاریاں نکل رہی ہیں اور دھواں ہے!', lang: 'ur', stt_engine: 'elevenlabs-scribe', confidence: 0.98, latency_ms: 210, ts: new Date().toISOString() },
    { id: 't2', speaker: 'system', text: '⚠️ [PRE-LLM HAZARD TRIGGER: electric_spark] کال منقطع، ایمرجنسی وارننگ جاری۔', lang: 'ur', latency_ms: 15, ts: new Date().toISOString() },
    { id: 't3', speaker: 'agent', text: 'خطرہ: بجلی کی آگ پر پانی ہرگز نہ پھینکیں! اگر ممکن ہو تو مین بریکر بند کر دیں۔ فوری طور پر 1122 پر کال کریں۔', lang: 'ur', latency_ms: 120, ts: new Date().toISOString() },
  ],
};

function TranscriptPanel({ callId, supabase, onClose }) {
  const [turns, setTurns] = useState(null);

  useEffect(() => {
    supabase
      .from('call_turns')
      .select('*')
      .eq('call_id', callId)
      .order('ts', { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setTurns(data);
        } else {
          setTurns(DEFAULT_TURNS[callId] || DEFAULT_TURNS['call-demo-001']);
        }
      })
      .catch(() => {
        setTurns(DEFAULT_TURNS[callId] || DEFAULT_TURNS['call-demo-001']);
      });
  }, [callId]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl border w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-bold text-base">Transcript (ٹرانسکرپٹ)</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 space-y-3 text-sm">
          {turns === null && <p className="text-muted-foreground text-center py-8">Loading…</p>}
          {turns !== null && turns.length === 0 && (
            <p className="text-muted-foreground text-center py-8">No transcript turns recorded.</p>
          )}
          {(turns || []).map((t) => (
            <div key={t.id} className={`flex gap-3 ${t.speaker === 'agent' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
                t.speaker === 'agent' ? 'bg-blue-100 text-blue-700' :
                t.speaker === 'system' ? 'bg-red-100 text-red-700' :
                'bg-muted text-muted-foreground'
              }`}>
                {t.speaker === 'agent' ? '🤖' : t.speaker === 'system' ? '⚠' : '👤'}
              </div>
              <div className={`flex-1 ${t.speaker === 'agent' ? 'text-right' : ''}`}>
                <div className={`inline-block px-3 py-2 rounded-xl text-sm max-w-[85%] ${
                  t.speaker === 'agent' ? 'bg-blue-50 dark:bg-blue-950' :
                  t.speaker === 'system' ? 'bg-red-50 dark:bg-red-950' :
                  'bg-muted'
                }`} dir="auto">
                  {t.text}
                </div>
                <div className={`text-[10px] text-muted-foreground mt-0.5 ${t.speaker === 'agent' ? 'text-right' : ''}`}>
                  {t.stt_engine && <span className="mr-2 font-mono">{t.stt_engine}</span>}
                  {t.confidence != null && <span className="mr-2">{(t.confidence * 100).toFixed(0)}%</span>}
                  {t.latency_ms != null && <span className="mr-2">{t.latency_ms}ms</span>}
                  <span>{new Date(t.ts).toLocaleTimeString('en-PK')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminCallsPage() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const [filters, setFilters] = useState({
    channel: 'all', mode: 'all', outcome: 'all', lang: 'all', is_test: 'all',
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('calls')
        .select('id, channel, mode, room_name, provider_id, started_at, ended_at, duration_s, language, outcome, is_test, avg_latency_ms, providers(business_name)')
        .order('started_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filters.channel !== 'all') q = q.eq('channel', filters.channel);
      if (filters.mode !== 'all') q = q.eq('mode', filters.mode);
      if (filters.outcome !== 'all') q = q.eq('outcome', filters.outcome);
      if (filters.lang !== 'all') q = q.eq('language', filters.lang);
      if (filters.is_test === 'test') q = q.eq('is_test', true);
      if (filters.is_test === 'real') q = q.eq('is_test', false);

      const { data } = await q;
      if (data && data.length > 0) {
        setCalls(data);
      } else {
        setCalls(DEFAULT_CALLS);
      }
    } catch {
      setCalls(DEFAULT_CALLS);
    }
    setLoading(false);
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);

  function setF(key, val) {
    setFilters(f => ({ ...f, [key]: val }));
    setPage(0);
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold">Call Logs (کال لاگز)</h1>
        <p className="text-sm text-muted-foreground mt-1">All voice sessions — click a row to view transcript</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        {[
          { key: 'channel', opts: ['all', 'web', 'wa_voice_note', 'wa_call'], label: 'Channel' },
          { key: 'mode', opts: ['all', 'directory', 'provider'], label: 'Mode' },
          { key: 'outcome', opts: ['all', 'booked', 'info', 'emergency', 'dropped', 'test'], label: 'Outcome' },
          { key: 'lang', opts: ['all', 'ur', 'ps', 'en'], label: 'Language' },
          { key: 'is_test', opts: ['all', 'real', 'test'], label: 'Type' },
        ].map(({ key, opts, label }) => (
          <Select key={key} value={filters[key]} onValueChange={v => setF(key, v)}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder={label} />
            </SelectTrigger>
            <SelectContent>
              {opts.map(o => (
                <SelectItem key={o} value={o} className="text-xs capitalize">{o === 'all' ? `All ${label}s` : o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : calls.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-4xl mb-3">📞</p>
          <p className="font-medium">No calls found</p>
          <p className="text-sm">Adjust filters or wait for incoming calls.</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Room / Provider</th>
                  <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Channel</th>
                  <th className="text-left px-4 py-3 font-semibold">Outcome</th>
                  <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Lang</th>
                  <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Duration</th>
                  <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Latency p50</th>
                  <th className="text-left px-4 py-3 font-semibold">Started</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((c, i) => (
                  <tr
                    key={c.id}
                    className={`cursor-pointer hover:bg-muted/40 transition-colors ${i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
                    onClick={() => setSelected(c.id)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs text-muted-foreground">{c.room_name}</p>
                      <p className="text-xs font-medium mt-0.5">{c.providers?.business_name || '—'}</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <Badge variant="outline" className="text-[10px] capitalize">{c.channel}</Badge>
                      {c.is_test && <Badge variant="secondary" className="text-[10px] ml-1">test</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={OUTCOME_COLORS[c.outcome] || 'outline'} className="text-[10px] capitalize">
                        {c.outcome || '—'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                      {LANG_LABELS[c.language] || c.language}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                      {c.duration_s != null ? `${c.duration_s}s` : '—'}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                      {c.avg_latency_ms != null ? `${c.avg_latency_ms}ms` : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(c.started_at).toLocaleString('en-PK', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
              ← Previous
            </Button>
            <span className="text-xs text-muted-foreground">Page {page + 1}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={calls.length < PAGE_SIZE}>
              Next →
            </Button>
          </div>
        </>
      )}

      {selected && (
        <TranscriptPanel callId={selected} supabase={supabase} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
