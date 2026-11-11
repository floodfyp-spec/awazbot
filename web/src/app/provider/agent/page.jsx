'use client';

import { useState, useEffect } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { createClient } from '@/lib/supabase/client';
import {
  saveAgentConfigVersion,
  restoreAgentConfigVersion,
  previewAgentInstructions,
} from '@/lib/actions/provider';

const AZURE_VOICES = {
  ur: [
    { id: 'ur-PK-UzmaNeural', name: 'Uzma (Female)', gender: 'Female' },
    { id: 'ur-PK-AsadNeural', name: 'Asad (Male)', gender: 'Male' },
  ],
  ps: [
    { id: 'ps-AF-LatifaNeural', name: 'Latifa (Female)', gender: 'Female' },
    { id: 'ps-AF-GulNawazNeural', name: 'Gul Nawaz (Male)', gender: 'Male' },
  ],
};

export default function ProviderAgentConfigPage() {
  const [provider, setProvider] = useState(null);
  const [activeConfig, setActiveConfig] = useState(null);
  const [versionHistory, setVersionHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form State
  const [agentName, setAgentName] = useState('');
  const [greetingUr, setGreetingUr] = useState('');
  const [greetingPs, setGreetingPs] = useState('TODO_PS');
  const [greetingEn, setGreetingEn] = useState('');
  const [voiceUr, setVoiceUr] = useState('ur-PK-UzmaNeural');
  const [voicePs, setVoicePs] = useState('ps-AF-LatifaNeural');
  const [tone, setTone] = useState('respectful, concise, friendly');
  const [autoConfirm, setAutoConfirm] = useState(false);
  const [minNoticeHours, setMinNoticeHours] = useState(2);
  const [maxJobsPerDay, setMaxJobsPerDay] = useState(6);
  const [emergencyAvailable, setEmergencyAvailable] = useState(true);
  const [faqs, setFaqs] = useState([]);

  // Preview State
  const [previewLang, setPreviewLang] = useState('ur');
  const [previewText, setPreviewText] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  // Load provider details and active agent config
  useEffect(() => {
    async function initData() {
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

      // Fetch all versions of agent_configs
      const { data: configs } = await supabase
        .from('agent_configs')
        .select('*')
        .eq('provider_id', prov.id)
        .order('version', { ascending: false });

      if (configs && configs.length > 0) {
        setVersionHistory(configs);
        const active = configs.find((c) => c.is_active) || configs[0];
        setActiveConfig(active);

        const c = active.config || {};
        setAgentName(c.agent_name || `${prov.business_name} Voice Receptionist`);
        setGreetingUr(c.greeting_ur || '');
        setGreetingPs(c.greeting_ps || 'TODO_PS');
        setGreetingEn(c.greeting_en || '');
        setVoiceUr(c.voice_ur || 'ur-PK-UzmaNeural');
        setVoicePs(c.voice_ps || 'ps-AF-LatifaNeural');
        setTone(c.tone || 'respectful, concise, friendly');
        setAutoConfirm(!!c.booking?.auto_confirm);
        setMinNoticeHours(c.booking?.min_notice_hours || 2);
        setMaxJobsPerDay(c.booking?.max_jobs_per_day || 6);
        setEmergencyAvailable(c.emergency_available !== false);
        setFaqs(c.faqs || []);
      }
      setLoading(false);
    }

    initData();
  }, []);

  // Fetch compiled prompt preview from Python backend
  const handleRefreshPreview = async (langToUse = previewLang) => {
    setPreviewLoading(true);
    const payload = {
      provider_name: provider?.business_name || 'Business',
      agent_name: agentName,
      greeting_ur: greetingUr,
      greeting_ps: greetingPs,
      greeting_en: greetingEn,
      voice_ur: voiceUr,
      voice_ps: voicePs,
      tone,
      trades: provider?.trades || ['electrician'],
      areas: provider?.areas || ['Hayatabad'],
      emergency_available: emergencyAvailable,
      booking: {
        auto_confirm: autoConfirm,
        min_notice_hours: Number(minNoticeHours) || 2,
        max_jobs_per_day: Number(maxJobsPerDay) || 6,
      },
      faqs,
      primary_phone: provider?.whatsapp || '03001234567',
    };

    const res = await previewAgentInstructions(payload, langToUse);
    if (res.ok) {
      setPreviewText(res.instructions);
    } else {
      setPreviewText(`Error generating preview: ${res.error}`);
    }
    setPreviewLoading(false);
  };

  // Trigger preview on initial load once provider is ready
  useEffect(() => {
    if (provider && !previewText) {
      handleRefreshPreview('ur');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  // Add FAQ entry
  const handleAddFaq = () => {
    setFaqs([...faqs, { q_ur: '', a_ur: '' }]);
  };

  // Remove FAQ entry
  const handleRemoveFaq = (index) => {
    setFaqs(faqs.filter((_, i) => i !== index));
  };

  // Save new version
  const handleSaveVersion = async () => {
    if (!provider) return;
    setSaving(true);
    const configPayload = {
      provider_id: provider.id,
      provider_name: provider.business_name,
      agent_name: agentName,
      greeting_ur: greetingUr,
      greeting_ps: greetingPs,
      greeting_en: greetingEn,
      voice_ur: voiceUr,
      voice_ps: voicePs,
      tone,
      trades: provider.trades || ['electrician'],
      areas: provider.areas || ['Hayatabad'],
      emergency_available: emergencyAvailable,
      booking: {
        auto_confirm: autoConfirm,
        min_notice_hours: Number(minNoticeHours) || 2,
        max_jobs_per_day: Number(maxJobsPerDay) || 6,
      },
      faqs,
      escalation_whatsapp: provider.whatsapp,
    };

    try {
      const res = await saveAgentConfigVersion(provider.id, configPayload);
      if (res.ok) {
        toast.success(`Saved and activated Agent Configuration Version ${res.version}!`);
        // Refresh local version history list
        setVersionHistory((prev) => [res.record, ...prev.map((c) => ({ ...c, is_active: false }))]);
        setActiveConfig(res.record);
        handleRefreshPreview();
      } else {
        toast.error(res.error || 'Failed to save configuration.');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Restore past version
  const handleRestoreVersion = async (targetId) => {
    if (!provider) return;
    try {
      const res = await restoreAgentConfigVersion(provider.id, targetId);
      if (res.ok) {
        toast.success(`Restored Version ${res.record.version} as active!`);
        setActiveConfig(res.record);
        setVersionHistory((prev) =>
          prev.map((c) => ({ ...c, is_active: c.id === targetId }))
        );
        const c = res.record.config || {};
        setAgentName(c.agent_name || '');
        setGreetingUr(c.greeting_ur || '');
        setGreetingPs(c.greeting_ps || 'TODO_PS');
        setGreetingEn(c.greeting_en || '');
        setVoiceUr(c.voice_ur || 'ur-PK-UzmaNeural');
        setVoicePs(c.voice_ps || 'ps-AF-LatifaNeural');
        setTone(c.tone || 'respectful, concise, friendly');
        setAutoConfirm(!!c.booking?.auto_confirm);
        setMinNoticeHours(c.booking?.min_notice_hours || 2);
        setMaxJobsPerDay(c.booking?.max_jobs_per_day || 6);
        setEmergencyAvailable(c.emergency_available !== false);
        setFaqs(c.faqs || []);
        handleRefreshPreview();
      } else {
        toast.error(res.error || 'Failed to restore version.');
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-12 text-center text-sm text-muted-foreground">
        Loading agent configuration...
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            AI Voice Agent Configuration
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure how your automated receptionist speaks, handles emergency calls, and books slots.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="px-2.5 py-1 text-xs">
            Active: Version {activeConfig?.version || 1}
          </Badge>
          <Button
            onClick={handleSaveVersion}
            disabled={saving}
            className="h-9 px-4 text-xs font-semibold shadow-sm"
          >
            {saving ? 'Saving...' : 'Save New Version'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form & Settings (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* General & Voices */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">Personality & Voices</CardTitle>
              <CardDescription className="text-xs">
                Select your assistant identity and Azure Neural voices.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="agent_name">Agent Name</Label>
                <Input
                  id="agent_name"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="e.g. Khan Electric Assistant"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Urdu Neural Voice</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {AZURE_VOICES.ur.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setVoiceUr(v.id)}
                        className={`rounded-lg border p-2.5 text-left text-xs transition-colors ${
                          voiceUr === v.id
                            ? 'border-primary bg-primary/10 text-primary font-bold'
                            : 'border-border bg-card text-muted-foreground'
                        }`}
                      >
                        <p>{v.name}</p>
                        <p className="text-[10px] text-muted-foreground">{v.gender}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Pashto Neural Voice</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {AZURE_VOICES.ps.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setVoicePs(v.id)}
                        className={`rounded-lg border p-2.5 text-left text-xs transition-colors ${
                          voicePs === v.id
                            ? 'border-primary bg-primary/10 text-primary font-bold'
                            : 'border-border bg-card text-muted-foreground'
                        }`}
                      >
                        <p>{v.name}</p>
                        <p className="text-[10px] text-muted-foreground">{v.gender}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tone">Conversational Tone</Label>
                <Input
                  id="tone"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  placeholder="respectful, concise, friendly"
                />
              </div>
            </CardContent>
          </Card>

          {/* Spoken Greetings */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">Spoken Greetings</CardTitle>
              <CardDescription className="text-xs">
                First sentence spoken when a customer connects to your voice receptionist.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="greeting_ur">Urdu Greeting (اردو)</Label>
                  <Badge variant="outline" className="text-[10px]">Urdu RTL</Badge>
                </div>
                <Textarea
                  id="greeting_ur"
                  dir="rtl"
                  rows={2}
                  value={greetingUr}
                  onChange={(e) => setGreetingUr(e.target.value)}
                  className="font-sans text-sm"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="greeting_ps">Pashto Greeting (پښتو)</Label>
                  <Badge variant="outline" className="text-[10px]">Pashto RTL</Badge>
                </div>
                <Textarea
                  id="greeting_ps"
                  dir="rtl"
                  rows={2}
                  value={greetingPs}
                  onChange={(e) => setGreetingPs(e.target.value)}
                  className="font-sans text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="greeting_en">English Greeting</Label>
                <Textarea
                  id="greeting_en"
                  rows={2}
                  value={greetingEn}
                  onChange={(e) => setGreetingEn(e.target.value)}
                  className="text-xs"
                />
              </div>
            </CardContent>
          </Card>

          {/* Booking Rules & Capacity */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">Booking Rules & Safeguards</CardTitle>
              <CardDescription className="text-xs">
                Guard rails for automated dispatching and capacity limits.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="space-y-0.5">
                  <Label className="font-semibold text-xs">Auto-Confirm Bookings</Label>
                  <p className="text-[11px] text-muted-foreground">
                    When enabled, bookings are directly confirmed. When disabled, they stay pending provider review.
                  </p>
                </div>
                <Switch
                  checked={autoConfirm}
                  onCheckedChange={setAutoConfirm}
                />
              </div>

              <div className="flex items-center justify-between border-b pb-3">
                <div className="space-y-0.5">
                  <Label className="font-semibold text-xs">Emergency Same-Day Dispatch</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Offer 45-60 min urgent callouts for severe electrical/water safety hazards.
                  </p>
                </div>
                <Switch
                  checked={emergencyAvailable}
                  onCheckedChange={setEmergencyAvailable}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="min_notice">Minimum Notice (Hours)</Label>
                  <Input
                    id="min_notice"
                    type="number"
                    min={1}
                    max={24}
                    value={minNoticeHours}
                    onChange={(e) => setMinNoticeHours(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="max_jobs">Max Jobs / Day</Label>
                  <Input
                    id="max_jobs"
                    type="number"
                    min={1}
                    max={50}
                    value={maxJobsPerDay}
                    onChange={(e) => setMaxJobsPerDay(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Custom FAQ Manager */}
          <Card className="shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-bold">Frequently Asked Questions (FAQ)</CardTitle>
                <CardDescription className="text-xs">
                  Your AI assistant references these Q&As during natural conversation.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddFaq}
                className="h-8 text-xs font-semibold"
              >
                + Add FAQ
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {faqs.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No custom FAQs added yet.</p>
              ) : (
                faqs.map((faq, idx) => (
                  <div key={idx} className="rounded-lg border p-3 bg-muted/30 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        FAQ #{idx + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveFaq(idx)}
                        className="h-6 px-2 text-destructive hover:bg-destructive/10 text-xs"
                      >
                        Remove
                      </Button>
                    </div>
                    <Input
                      dir="rtl"
                      placeholder="سوال (e.g. وزٹ چارجز کتنے ہیں؟)"
                      value={faq.q_ur}
                      onChange={(e) => {
                        const next = [...faqs];
                        next[idx].q_ur = e.target.value;
                        setFaqs(next);
                      }}
                      className="text-xs bg-white dark:bg-background"
                    />
                    <Textarea
                      dir="rtl"
                      rows={2}
                      placeholder="جواب (e.g. عام وزٹ کی فیس 500 روپے ہے...)"
                      value={faq.a_ur}
                      onChange={(e) => {
                        const next = [...faqs];
                        next[idx].a_ur = e.target.value;
                        setFaqs(next);
                      }}
                      className="text-xs bg-white dark:bg-background"
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Instructions Preview & Version History (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Live Instructions Preview Panel */}
          <Card className="shadow-xs border-primary/30">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-foreground">
                  Compiled Prompt Preview
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Badge
                    variant={previewLang === 'ur' ? 'default' : 'outline'}
                    className="cursor-pointer text-[10px] px-1.5 py-0"
                    onClick={() => {
                      setPreviewLang('ur');
                      handleRefreshPreview('ur');
                    }}
                  >
                    Urdu
                  </Badge>
                  <Badge
                    variant={previewLang === 'ps' ? 'default' : 'outline'}
                    className="cursor-pointer text-[10px] px-1.5 py-0"
                    onClick={() => {
                      setPreviewLang('ps');
                      handleRefreshPreview('ps');
                    }}
                  >
                    Pashto
                  </Badge>
                  <Badge
                    variant={previewLang === 'en' ? 'default' : 'outline'}
                    className="cursor-pointer text-[10px] px-1.5 py-0"
                    onClick={() => {
                      setPreviewLang('en');
                      handleRefreshPreview('en');
                    }}
                  >
                    English
                  </Badge>
                </div>
              </div>
              <CardDescription className="text-[11px]">
                Generated by Python <code className="font-mono">compile_instructions</code> via FastAPI.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[420px] overflow-y-auto p-3.5 bg-muted/40 font-mono text-[11px] leading-relaxed whitespace-pre-wrap select-text">
                {previewLoading ? (
                  <p className="text-muted-foreground italic">Compiling instructions from backend...</p>
                ) : (
                  previewText || <p className="text-muted-foreground italic">No preview loaded.</p>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t py-2.5 px-3.5 bg-card">
              <span className="text-[10px] text-muted-foreground">
                9 Platform Rules + Provider Facts Embedded
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRefreshPreview()}
                disabled={previewLoading}
                className="h-7 text-xs"
              >
                Refresh Preview
              </Button>
            </CardFooter>
          </Card>

          {/* Version History Drawer / Card */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">Version History</CardTitle>
              <CardDescription className="text-xs">
                Audit trail of saved configurations with one-click restore.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-0 max-h-[300px] overflow-y-auto divide-y">
              {versionHistory.map((ver) => (
                <div
                  key={ver.id}
                  className={`p-3 flex items-center justify-between text-xs hover:bg-muted/30 transition-colors ${
                    ver.is_active ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">Version {ver.version}</span>
                      {ver.is_active && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-emerald-600">Active</Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(ver.created_at).toLocaleString([], {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>
                  {!ver.is_active && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestoreVersion(ver.id)}
                      className="h-7 text-[11px] px-2.5 font-semibold"
                    >
                      Restore
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
