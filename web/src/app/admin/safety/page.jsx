'use client';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const LANGS = ['en', 'ur', 'ps', 'ur_roman'];
const LANG_LABELS = { en: 'English', ur: 'اردو', ps: 'پښتو', ur_roman: 'Urdu Roman' };

function RuleModal({ rule, onClose, onSaved, supabase }) {
  const isNew = !rule.id;
  const [code, setCode] = useState(rule.code || '');
  const [keywords, setKeywords] = useState(rule.keywords || { en: [], ur: [], ps: [], ur_roman: [] });
  const [message, setMessage] = useState(rule.message || { en: '', ur: '', ps: '', ur_roman: '' });
  const [active, setActive] = useState(rule.active !== false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function setKw(lang, val) {
    setKeywords(k => ({ ...k, [lang]: val.split(',').map(s => s.trim()).filter(Boolean) }));
  }

  async function save() {
    if (!code.trim()) { setError('Rule code is required'); return; }
    setSaving(true);
    setError('');
    const payload = { code: code.trim(), keywords, message, active };
    let err;
    if (isNew) {
      ({ error: err } = await supabase.from('safety_rules').insert(payload));
    } else {
      ({ error: err } = await supabase.from('safety_rules').update(payload).eq('id', rule.id));
    }
    if (err) { setError(err.message); setSaving(false); return; }
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-base">{isNew ? 'New Safety Rule' : `Edit: ${rule.code}`}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">×</button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}

          <div>
            <Label className="text-xs font-semibold mb-1 block">Rule Code (unique identifier)</Label>
            <Input value={code} onChange={e => setCode(e.target.value)} placeholder="gas_leak" className="font-mono" disabled={!isNew} />
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={active} onCheckedChange={setActive} />
            <Label className="text-sm">{active ? 'Active (یعنی فعال)' : 'Inactive (غیر فعال)'}</Label>
          </div>

          <div>
            <p className="text-xs font-semibold mb-2">Keywords (comma-separated per language)</p>
            <Tabs defaultValue="en">
              <TabsList className="mb-3">
                {LANGS.map(l => <TabsTrigger key={l} value={l} className="text-xs">{LANG_LABELS[l]}</TabsTrigger>)}
              </TabsList>
              {LANGS.map(l => (
                <TabsContent key={l} value={l}>
                  <Input
                    value={(keywords[l] || []).join(', ')}
                    onChange={e => setKw(l, e.target.value)}
                    placeholder={l === 'en' ? 'gas leak, smell gas, gas pipe' : ''}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {(keywords[l] || []).length} keyword(s)
                  </p>
                </TabsContent>
              ))}
            </Tabs>
          </div>

          <div>
            <p className="text-xs font-semibold mb-2">Safety Message (spoken to caller per language)</p>
            <Tabs defaultValue="en">
              <TabsList className="mb-3">
                {LANGS.map(l => <TabsTrigger key={l} value={l} className="text-xs">{LANG_LABELS[l]}</TabsTrigger>)}
              </TabsList>
              {LANGS.map(l => (
                <TabsContent key={l} value={l}>
                  <Textarea
                    value={message[l] || ''}
                    onChange={e => setMessage(m => ({ ...m, [l]: e.target.value }))}
                    rows={3}
                    dir={['ur', 'ps'].includes(l) ? 'rtl' : 'ltr'}
                    placeholder={l === 'en' ? 'Leave the area immediately. Call 1122 for rescue.' : ''}
                  />
                </TabsContent>
              ))}
            </Tabs>
          </div>

          <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
            ⚠️ After saving, re-render audio files: run <code className="font-mono bg-amber-100 dark:bg-amber-900 px-1 rounded">python scripts/render_phrases.py</code> in the project root to update <code>assets/audio/</code>.
          </div>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Rule'}</Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminSafetyPage() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const DEFAULT_RULES = [
    {
      id: 'sr-001',
      code: 'gas_leak',
      active: true,
      keywords: {
        en: ['gas leak', 'gas smell', 'cylinder leak', 'smell gas'],
        ur: ['گیس لیک', 'سلنڈر لیک', 'گیس کی بو', 'سلنڈر کی بو'],
        ps: ['د ګاز بوی', 'ګاز شلیدلی', 'ګاز خپریدل'],
        ur_roman: ['gas leak', 'gas ki boo', 'cylinder leak'],
      },
      message: {
        en: 'Leave the area immediately. Do not switch on any electrical appliances. Call 1122.',
        ur: 'فوری طور پر علاقہ خالی کریں اور کسی برقی سوئچ کو مت چھوئیں۔ 1122 پر کال کریں۔',
        ps: 'سمدستي سیمه خالي کړئ او برېښنايي سویچونه مه چالان کوئ. ۱۱۲۲ ته زنګ ووهئ.',
      },
    },
    {
      id: 'sr-002',
      code: 'electric_spark',
      active: true,
      keywords: {
        en: ['electric fire', 'sparks flying', 'burning smell from breaker', 'switchboard caught fire'],
        ur: ['بجلی کی آگ', 'چنگاریاں نکل رہی ہیں', 'بریکر سے دھواں', 'تاریں جل رہی ہیں'],
        ps: ['د برېښنا اور', 'تارونه سوځي', 'څنګښونه'],
        ur_roman: ['bijli ki aag', 'changariyan', 'sparks', 'taare jal rahi hain'],
      },
      message: {
        en: 'DANGER: Do not throw water on electrical fires! Switch off main breaker if safe and call 1122.',
        ur: 'خطرہ: بجلی کی آگ پر پانی ہرگز نہ پھینکیں! اگر محفوظ ہو تو مین بریکر بند کریں اور 1122 کو کال کریں۔',
      },
    },
    {
      id: 'sr-003',
      code: 'pipe_burst',
      active: true,
      keywords: {
        en: ['pipe burst', 'flooding near electric', 'water inside switchboard'],
        ur: ['پائپ پھٹ گیا', 'سیلاب آ گیا', 'سوئچ بورڈ میں پانی'],
        ps: ['پایپ شلیدلی', 'اوبه ډنډ شوې'],
      },
      message: {
        en: 'Turn off main water supply valve. Stay away from flooded electrical wiring.',
        ur: 'فوری طور پر مین پانی کا والو بند کریں۔ پانی میں ڈوبی تاروں سے دور رہیں۔',
      },
    },
    {
      id: 'sr-004',
      code: 'injury_shock',
      active: true,
      keywords: {
        en: ['electric shock', 'electrocuted', 'person shocked', 'unconscious from shock'],
        ur: ['کرنٹ لگ گیا', 'برقی جھٹکا لگا', 'کرنٹ لگنے سے بے ہوش'],
        ps: ['برېښنا ونیوه', 'کرنټ لګېدلی'],
      },
      message: {
        en: 'EMERGENCY: Do not touch victim with bare hands! Disconnect power immediately or use dry wood. Call 1122.',
        ur: 'ایمرجنسی: کرنٹ لگے شخص کو ننگے ہاتھوں سے نہ چھوئیں! فوراً بجلی کا سوئچ بند کریں اور 1122 پر کال کریں۔',
      },
    },
  ];

  async function load() {
    setLoading(true);
    try {
      const { data } = await supabase.from('safety_rules').select('*').order('created_at');
      if (data && data.length > 0) {
        setRules(data);
      } else {
        setRules(DEFAULT_RULES);
      }
    } catch {
      setRules(DEFAULT_RULES);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleActive(rule) {
    await supabase.from('safety_rules').update({ active: !rule.active }).eq('id', rule.id);
    load();
  }

  async function deleteRule(id) {
    if (!confirm('Delete this safety rule? This cannot be undone.')) return;
    await supabase.from('safety_rules').delete().eq('id', id);
    load();
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold">Safety Rules (حفاظتی قوانین)</h1>
          <p className="text-sm text-muted-foreground mt-1">Emergency keyword triggers — pre-LLM safety guard</p>
        </div>
        <Button onClick={() => setEditing({})}>+ New Rule</Button>
      </div>

      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-200">
        These rules run BEFORE the LLM. Any matching keyword immediately interrupts the call and triggers emergency actions (email to 1122 + spoken safety message).
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-3">
          {rules.map(r => (
            <div key={r.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-sm">{r.code}</span>
                    <Badge variant={r.active ? 'default' : 'secondary'} className="text-[10px]">
                      {r.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Object.entries(r.keywords || {}).flatMap(([lang, kws]) =>
                      (kws || []).slice(0, 5).map(kw => (
                        <span key={`${lang}-${kw}`} className="text-[10px] bg-muted px-2 py-0.5 rounded-full font-mono"
                          dir={['ur', 'ps'].includes(lang) ? 'rtl' : 'ltr'}>
                          {kw}
                        </span>
                      ))
                    )}
                    {Object.values(r.keywords || {}).flat().length > 15 && (
                      <span className="text-[10px] text-muted-foreground">+more</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={r.active} onCheckedChange={() => toggleActive(r)} />
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditing(r)}>Edit</Button>
                  <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => deleteRule(r.id)}>Del</Button>
                </div>
              </div>
            </div>
          ))}
          {rules.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-4xl mb-3">🚨</p>
              <p className="font-medium">No safety rules yet</p>
              <p className="text-sm">Add rules to protect callers from emergencies.</p>
            </div>
          )}
        </div>
      )}

      {editing !== null && (
        <RuleModal rule={editing} supabase={supabase} onClose={() => setEditing(null)} onSaved={load} />
      )}
    </div>
  );
}
