'use client';
import { useEffect, useState, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const LANGS = ['en', 'ur', 'ur_roman', 'ps'];
const LANG_LABELS = { en: 'English', ur: 'اردو', ur_roman: 'Urdu Roman', ps: 'پښتو' };

const URGENCY_COLORS = {
  EMERGENCY: 'destructive',
  URGENT: 'default',
  ROUTINE: 'secondary',
};

function IssueModal({ issue, categoryCode, onClose, onSaved, supabase }) {
  const isNew = !issue.id;
  const [code, setCode] = useState(issue.code || '');
  const [urgency, setUrgency] = useState(issue.urgency || 'ROUTINE');
  const [synonyms, setSynonyms] = useState(
    issue.synonyms || { en: [], ur: [], ur_roman: [], ps: [] }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function setSyns(lang, val) {
    setSynonyms(s => ({
      ...s,
      [lang]: val.split(',').map(x => x.trim()).filter(Boolean),
    }));
  }

  async function save() {
    if (!code.trim()) {
      setError('Issue code is required');
      return;
    }
    setSaving(true);
    setError('');

    const payload = {
      category_code: categoryCode,
      code: code.trim(),
      urgency,
      synonyms,
    };

    let err;
    if (isNew) {
      ({ error: err } = await supabase.from('issues').insert(payload));
    } else {
      ({ error: err } = await supabase.from('issues').update(payload).eq('id', issue.id));
    }

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl border w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-base">{isNew ? 'New Issue' : `Edit: ${issue.code}`}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}

          <div>
            <Label className="text-xs font-semibold mb-1 block">Issue Code</Label>
            <Input
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="e.g. pipe_burst, short_circuit"
              className="font-mono"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold mb-1 block">Urgency Level</Label>
            <Select value={urgency} onValueChange={setUrgency}>
              <SelectTrigger>
                <SelectValue placeholder="Select urgency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ROUTINE">ROUTINE (معمول)</SelectItem>
                <SelectItem value="URGENT">URGENT (فوری / ترجیحی)</SelectItem>
                <SelectItem value="EMERGENCY">EMERGENCY (ہنگامی)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <p className="text-xs font-semibold mb-2">Synonyms / Triggers (comma-separated)</p>
            <Tabs defaultValue="en">
              <TabsList className="mb-3">
                {LANGS.map(l => (
                  <TabsTrigger key={l} value={l} className="text-xs">
                    {LANG_LABELS[l]}
                  </TabsTrigger>
                ))}
              </TabsList>
              {LANGS.map(l => (
                <TabsContent key={l} value={l}>
                  <Input
                    value={(synonyms[l] || []).join(', ')}
                    onChange={e => setSyns(l, e.target.value)}
                    dir={['ur', 'ps'].includes(l) ? 'rtl' : 'ltr'}
                    placeholder={`Comma separated words in ${LANG_LABELS[l]}`}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {(synonyms[l] || []).length} synonym(s) configured
                  </p>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Issue'}</Button>
        </div>
      </div>
    </div>
  );
}

function CategoryModal({ category, onClose, onSaved, supabase }) {
  const isNew = !category?.code;
  const [code, setCode] = useState(category?.code || '');
  const [nameEn, setNameEn] = useState(category?.name_en || '');
  const [nameUr, setNameUr] = useState(category?.name_ur || '');
  const [namePs, setNamePs] = useState(category?.name_ps || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!code.trim() || !nameEn.trim()) {
      setError('Code and English name are required');
      return;
    }
    setSaving(true);
    setError('');

    const payload = {
      code: code.trim(),
      name_en: nameEn.trim(),
      name_ur: nameUr.trim(),
      name_ps: namePs.trim(),
    };

    let err;
    if (isNew) {
      ({ error: err } = await supabase.from('categories').insert(payload));
    } else {
      ({ error: err } = await supabase.from('categories').update(payload).eq('code', category.code));
    }

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }
    onSaved(payload.code);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-4 border-b">
          <h2 className="font-bold text-base">{isNew ? 'New Category' : `Edit Category: ${category.code}`}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">×</button>
        </div>

        <div className="py-4 space-y-4">
          {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
          <div>
            <Label className="text-xs font-semibold mb-1 block">Category Code</Label>
            <Input
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="e.g. electrician"
              className="font-mono"
              disabled={!isNew}
            />
          </div>
          <div>
            <Label className="text-xs font-semibold mb-1 block">Name (English)</Label>
            <Input value={nameEn} onChange={e => setNameEn(e.target.value)} placeholder="Electrician" />
          </div>
          <div>
            <Label className="text-xs font-semibold mb-1 block">Name (Urdu - اردو)</Label>
            <Input value={nameUr} onChange={e => setNameUr(e.target.value)} placeholder="الیکٹریشن" dir="rtl" />
          </div>
          <div>
            <Label className="text-xs font-semibold mb-1 block">Name (Pashto - پښتو)</Label>
            <Input value={namePs} onChange={e => setNamePs(e.target.value)} placeholder="برقی / الیکٹریشن" dir="rtl" />
          </div>
        </div>

        <div className="pt-4 border-t flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Category'}</Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [selectedCat, setSelectedCat] = useState(null);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingIssues, setLoadingIssues] = useState(false);

  const [catModal, setCatModal] = useState(null);
  const [issueModal, setIssueModal] = useState(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const DEFAULT_CATEGORIES = [
    { code: 'electrician', name_en: 'Electrician', name_ur: 'الیکٹریشن', name_ps: 'برقی / الیکٹریشن' },
    { code: 'ups_solar', name_en: 'UPS & Solar', name_ur: 'یو پی ایس اور سولر', name_ps: 'سولر او یو پی ایس' },
    { code: 'ac_fridge', name_en: 'AC & Refrigeration', name_ur: 'اے سی اور فریج', name_ps: 'ای سی او یخچالان' },
    { code: 'plumber_gas', name_en: 'Plumber & Gas Fitting', name_ur: 'پلمبر اور گیس فٹنگ', name_ps: 'نل دوان او ګاز' },
  ];

  const DEFAULT_ISSUES = {
    electrician: [
      { id: 'iss-1', category_code: 'electrician', code: 'short_circuit', urgency: 'EMERGENCY', synonyms: { en: ['short circuit', 'spark', 'breaker trip'], ur: ['شارٹ سرکٹ', 'چنگاریاں'], ur_roman: ['short circuit', 'trip ho gaya'], ps: ['برېښنا شارټ شوې'] } },
      { id: 'iss-2', category_code: 'electrician', code: 'fan_fitting', urgency: 'ROUTINE', synonyms: { en: ['fan repair', 'ceiling fan installation'], ur: ['پنکھا لگانا', 'پنکھا خراب'], ur_roman: ['pankha fitting'], ps: ['پککی لګول'] } },
      { id: 'iss-3', category_code: 'electrician', code: 'wiring_inspection', urgency: 'ROUTINE', synonyms: { en: ['home wiring', 'switchboard repair'], ur: ['وائرنگ چیک کروانی', 'سوئچ بورڈ'], ur_roman: ['wiring check'], ps: ['تارونه کتل'] } },
    ],
    ups_solar: [
      { id: 'iss-4', category_code: 'ups_solar', code: 'inverter_fault', urgency: 'URGENT', synonyms: { en: ['inverter red light', 'ups overload'], ur: ['انورٹر خراب ہے', 'یو پی ایس بند'], ur_roman: ['inverter kharab'], ps: ['انورټر ستونزه'] } },
      { id: 'iss-5', category_code: 'ups_solar', code: 'battery_backup', urgency: 'ROUTINE', synonyms: { en: ['battery backup low', 'acid check'], ur: ['بیٹری بیک اپ نہیں دے رہی'], ur_roman: ['battery backup'], ps: ['بیټرۍ ټیټه شوې'] } },
    ],
    ac_fridge: [
      { id: 'iss-6', category_code: 'ac_fridge', code: 'gas_leak_ac', urgency: 'URGENT', synonyms: { en: ['ac not cooling', 'gas refill'], ur: ['اے سی ٹھنڈا نہیں کر رہا', 'گیس چارجنگ'], ur_roman: ['ac cooling nahi kar raha'], ps: ['یخ نه کوي'] } },
    ],
    plumber_gas: [
      { id: 'iss-7', category_code: 'plumber_gas', code: 'pipe_burst', urgency: 'EMERGENCY', synonyms: { en: ['pipe burst', 'flooding'], ur: ['پائپ پھٹ گیا', 'سیلاب'], ur_roman: ['pipe phat gaya'], ps: ['پایپ شلیدلی'] } },
      { id: 'iss-8', category_code: 'plumber_gas', code: 'tap_leakage', urgency: 'ROUTINE', synonyms: { en: ['leaking tap', 'mixer valve'], ur: ['نلکا ٹپک رہا ہے', 'لیکج'], ur_roman: ['nalka leak'], ps: ['نلکه لیکیږي'] } },
    ],
  };

  const loadCategories = useCallback(async (selectCode) => {
    setLoading(true);
    try {
      const { data } = await supabase.from('categories').select('*').order('code');
      if (data && data.length > 0) {
        setCategories(data);
        setSelectedCat(selectCode || data[0].code);
      } else {
        setCategories(DEFAULT_CATEGORIES);
        setSelectedCat(selectCode || 'electrician');
      }
    } catch {
      setCategories(DEFAULT_CATEGORIES);
      setSelectedCat(selectCode || 'electrician');
    }
    setLoading(false);
  }, []);

  const loadIssues = useCallback(async (catCode) => {
    if (!catCode) {
      setIssues([]);
      return;
    }
    setLoadingIssues(true);
    try {
      const { data } = await supabase.from('issues').select('*').eq('category_code', catCode).order('code');
      if (data && data.length > 0) {
        setIssues(data);
      } else {
        setIssues(DEFAULT_ISSUES[catCode] || []);
      }
    } catch {
      setIssues(DEFAULT_ISSUES[catCode] || []);
    }
    setLoadingIssues(false);
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (selectedCat) loadIssues(selectedCat);
  }, [selectedCat, loadIssues]);

  async function deleteCategory(code) {
    if (!confirm(`Delete category "${code}" and all associated issues?`)) return;
    await supabase.from('categories').delete().eq('code', code);
    loadCategories();
  }

  async function deleteIssue(id) {
    if (!confirm('Delete this issue?')) return;
    await supabase.from('issues').delete().eq('id', id);
    loadIssues(selectedCat);
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">Categories & Issues (شعبے اور مسائل)</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage trade ontology, canonical issues, urgency, and bilingual synonyms
          </p>
        </div>
        <Button onClick={() => setCatModal({})}>+ New Category</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Categories Column */}
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between mb-3 border-b pb-2">
            <h2 className="font-bold text-sm">Trades / Categories</h2>
            <span className="text-xs text-muted-foreground">{categories.length} total</span>
          </div>

          {loading ? (
            <p className="text-xs text-muted-foreground py-4">Loading categories…</p>
          ) : (
            <div className="space-y-2">
              {categories.map(c => {
                const isSelected = selectedCat === c.code;
                return (
                  <div
                    key={c.code}
                    onClick={() => setSelectedCat(c.code)}
                    className={`p-3 rounded-lg border text-sm cursor-pointer transition-colors flex items-center justify-between ${
                      isSelected ? 'border-primary bg-primary/5 font-semibold' : 'hover:bg-muted/50'
                    }`}
                  >
                    <div>
                      <p>{c.name_en}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {c.code} · <span dir="rtl">{c.name_ur}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-xs"
                        onClick={() => setCatModal(c)}
                      >
                        ✎
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-xs text-destructive"
                        onClick={() => deleteCategory(c.code)}
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Issues Column */}
        <div className="md:col-span-2 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between mb-3 border-b pb-2">
            <div>
              <h2 className="font-bold text-sm">
                Issues for <span className="font-mono text-primary">{selectedCat || 'None'}</span>
              </h2>
              <span className="text-xs text-muted-foreground">{issues.length} standard issues</span>
            </div>
            {selectedCat && (
              <Button size="sm" onClick={() => setIssueModal({})}>
                + Add Issue
              </Button>
            )}
          </div>

          {loadingIssues ? (
            <p className="text-xs text-muted-foreground py-8">Loading issues…</p>
          ) : issues.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-3xl mb-2">📂</p>
              <p className="text-sm font-medium">No issues defined for this category</p>
              <p className="text-xs">Click &quot;+ Add Issue&quot; to create one.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {issues.map(iss => (
                <div key={iss.id} className="p-4 rounded-xl border bg-background hover:bg-muted/20 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm">{iss.code}</span>
                        <Badge variant={URGENCY_COLORS[iss.urgency] || 'outline'} className="text-[10px]">
                          {iss.urgency}
                        </Badge>
                      </div>

                      {/* Synonyms display */}
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {LANGS.map(l => {
                          const syns = iss.synonyms?.[l] || [];
                          return (
                            <div key={l} className="bg-muted/40 p-2 rounded-md">
                              <span className="font-semibold text-[10px] text-muted-foreground uppercase block mb-1">
                                {LANG_LABELS[l]} ({syns.length})
                              </span>
                              <p
                                className="text-xs truncate font-mono text-foreground"
                                dir={['ur', 'ps'].includes(l) ? 'rtl' : 'ltr'}
                              >
                                {syns.length > 0 ? syns.join(', ') : '—'}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setIssueModal(iss)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs"
                        onClick={() => deleteIssue(iss.id)}
                      >
                        Del
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {catModal && (
        <CategoryModal
          category={catModal}
          supabase={supabase}
          onClose={() => setCatModal(null)}
          onSaved={(newCode) => loadCategories(newCode)}
        />
      )}

      {issueModal && (
        <IssueModal
          issue={issueModal}
          categoryCode={selectedCat}
          supabase={supabase}
          onClose={() => setIssueModal(null)}
          onSaved={() => loadIssues(selectedCat)}
        />
      )}
    </div>
  );
}
