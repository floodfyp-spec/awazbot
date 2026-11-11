'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
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
import {
  sendTestNotificationEmail,
  createProviderOnboarding,
} from '@/lib/actions/provider';
import { TRADE_TEMPLATES, PESHAWAR_AREAS } from '@/lib/trade-templates';

const WEEKDAYS = [
  { id: 1, name: 'Monday' },
  { id: 2, name: 'Tuesday' },
  { id: 3, name: 'Wednesday' },
  { id: 4, name: 'Thursday' },
  { id: 5, name: 'Friday' },
  { id: 6, name: 'Saturday' },
  { id: 0, name: 'Sunday' },
];

const AZURE_VOICES = {
  ur: [
    { id: 'ur-PK-UzmaNeural', name: 'Uzma (Female)', gender: 'Female' },
    { id: 'ur-PK-AsadNeural', name: 'Asad (Male)', gender: 'Male' },
  ],
  ps: [
    { id: 'ps-AF-LatifaNeural', name: 'Latifa (Female)', gender: 'Female' },
    { id: 'ps-AF-GulNawazNeural', name: 'Gul Nawaz (Male)', gender: 'Male' },
  ],
  en: [
    { id: 'en-US-JennyNeural', name: 'Jenny (Female)', gender: 'Female' },
    { id: 'en-US-GuyNeural', name: 'Guy (Male)', gender: 'Male' },
  ],
};

export default function OnboardingWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    business_name: '',
    about: '',
    whatsapp: '+923001234567',
    notify_email: '',
    trades: ['electrician'],
    areas: ['Hayatabad', 'University Town'],
    working_days: [1, 2, 3, 4, 5, 6], // Mon - Sat
    opens: '08:00',
    closes: '20:00',
    languages: ['ur', 'ps'],
    voice_ur: 'ur-PK-UzmaNeural',
    voice_ps: 'ps-AF-LatifaNeural',
    voice_en: 'en-US-GuyNeural',
    agent_name: '',
  });

  // Step 1 Validation helper
  const isEmailValid = z.string().email().safeParse(formData.notify_email).success;

  // Handle Send Test Email
  const handleSendTestEmail = async () => {
    if (!isEmailValid) {
      toast.error('Please enter a valid email address first.');
      return;
    }
    setTestEmailLoading(true);
    setTestEmailStatus(null);
    try {
      const res = await sendTestNotificationEmail(formData.notify_email);
      if (res.ok) {
        setTestEmailStatus('success');
        toast.success(res.message || 'Test email sent successfully!');
      } else {
        setTestEmailStatus('error');
        toast.error(res.error || 'Failed to send test email.');
      }
    } catch (err) {
      setTestEmailStatus('error');
      toast.error(err.message);
    } finally {
      setTestEmailLoading(false);
    }
  };

  // Toggle Trade selection
  const toggleTrade = (tradeId) => {
    setFormData((prev) => {
      const exists = prev.trades.includes(tradeId);
      if (exists) {
        if (prev.trades.length === 1) {
          toast.info('You must select at least one trade.');
          return prev;
        }
        return { ...prev, trades: prev.trades.filter((t) => t !== tradeId) };
      }
      return { ...prev, trades: [...prev.trades, tradeId] };
    });
  };

  // Toggle Area selection
  const toggleArea = (areaName) => {
    setFormData((prev) => {
      const exists = prev.areas.includes(areaName);
      if (exists) {
        if (prev.areas.length === 1) {
          toast.info('Please select at least one service area.');
          return prev;
        }
        return { ...prev, areas: prev.areas.filter((a) => a !== areaName) };
      }
      return { ...prev, areas: [...prev.areas, areaName] };
    });
  };

  // Toggle Working Day
  const toggleDay = (dayId) => {
    setFormData((prev) => {
      const exists = prev.working_days.includes(dayId);
      if (exists) {
        if (prev.working_days.length === 1) {
          toast.info('Please select at least one active day.');
          return prev;
        }
        return { ...prev, working_days: prev.working_days.filter((d) => d !== dayId) };
      }
      return { ...prev, working_days: [...prev.working_days, dayId].sort() };
    });
  };

  // Final Form Submission
  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await createProviderOnboarding(formData);
      if (!res.ok) {
        toast.error(res.error || 'Failed to complete onboarding.');
        return;
      }
      toast.success('Onboarding complete! Welcome to your provider dashboard.');
      router.push('/provider');
    } catch (err) {
      toast.error('Unexpected error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8 sm:px-6">
      {/* Wizard Progress Stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          <span>Step {step} of 4</span>
          <span>
            {step === 1 && 'Business Profile'}
            {step === 2 && 'Service Areas'}
            {step === 3 && 'Working Hours'}
            {step === 4 && 'Voice & Personality'}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-colors ${
                i <= step ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </div>

      <Card className="shadow-md border-primary/20">
        {/* STEP 1: BUSINESS PROFILE & NOTIFICATION EMAIL */}
        {step === 1 && (
          <>
            <CardHeader>
              <CardTitle className="text-xl">1. Business Profile & Alert Channel</CardTitle>
              <CardDescription>
                Provide your core business details and your required notification Gmail address.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="business_name">Business / Contractor Name *</Label>
                <Input
                  id="business_name"
                  placeholder="e.g. Peshawar Solar & Electric"
                  value={formData.business_name}
                  onChange={(e) =>
                    setFormData({ ...formData, business_name: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Primary Trades (Select all that apply) *</Label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {Object.entries(TRADE_TEMPLATES).map(([key, tpl]) => {
                    const selected = formData.trades.includes(key);
                    return (
                      <Badge
                        key={key}
                        variant={selected ? 'default' : 'outline'}
                        className="cursor-pointer px-3 py-1.5 text-xs font-medium transition-colors"
                        onClick={() => toggleTrade(key)}
                      >
                        {tpl.name_en} ({tpl.name_ur})
                      </Badge>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp Contact Phone *</Label>
                <Input
                  id="whatsapp"
                  placeholder="+92 300 1234567"
                  value={formData.whatsapp}
                  onChange={(e) =>
                    setFormData({ ...formData, whatsapp: e.target.value })
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  Used for urgent customer escalation and booking transfers.
                </p>
              </div>

              {/* Notification Gmail Address with Send Test Email button */}
              <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="notify_email" className="font-semibold text-sm">
                    Notification Gmail Address *
                  </Label>
                  <span className="text-[10px] uppercase font-bold text-primary">
                    Required
                  </span>
                </div>
                <div className="flex gap-2">
                  <Input
                    id="notify_email"
                    type="email"
                    placeholder="your.business@gmail.com"
                    value={formData.notify_email}
                    onChange={(e) => {
                      setFormData({ ...formData, notify_email: e.target.value });
                      setTestEmailStatus(null);
                    }}
                    className="bg-white dark:bg-background text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendTestEmail}
                    disabled={!isEmailValid || testEmailLoading}
                    className="shrink-0 text-xs font-semibold h-10 border-primary/40 text-primary hover:bg-primary/10"
                  >
                    {testEmailLoading ? 'Sending...' : 'Send test email'}
                  </Button>
                </div>
                <div className="flex items-center justify-between text-xs pt-1">
                  <p className="text-muted-foreground">
                    Booking alerts will be sent here (Customer name, masked phone, issue).
                  </p>
                  {testEmailStatus === 'success' && (
                    <span className="text-emerald-600 font-semibold text-xs">
                      ✓ Delivered
                    </span>
                  )}
                  {testEmailStatus === 'error' && (
                    <span className="text-destructive font-semibold text-xs">
                      ✗ Send failed
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="about">About Business (Optional)</Label>
                <Textarea
                  id="about"
                  rows={2}
                  placeholder="Tell customers about your experience, certifications, and service warranty..."
                  value={formData.about}
                  onChange={(e) =>
                    setFormData({ ...formData, about: e.target.value })
                  }
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-3 border-t pt-4">
              <Button
                disabled={!formData.business_name.trim() || !isEmailValid}
                onClick={() => setStep(2)}
              >
                Next: Service Areas &rarr;
              </Button>
            </CardFooter>
          </>
        )}

        {/* STEP 2: SERVICE AREAS */}
        {step === 2 && (
          <>
            <CardHeader>
              <CardTitle className="text-xl">2. Coverage Areas in Peshawar & KP</CardTitle>
              <CardDescription>
                Select which areas in Peshawar you actively dispatch technicians to.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {PESHAWAR_AREAS.map((area) => {
                  const selected = formData.areas.includes(area);
                  return (
                    <button
                      key={area}
                      type="button"
                      onClick={() => toggleArea(area)}
                      className={`flex items-center justify-between rounded-lg border p-3 text-left text-xs font-medium transition-all ${
                        selected
                          ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                          : 'border-border bg-card text-muted-foreground hover:border-primary/50'
                      }`}
                    >
                      <span>{area}</span>
                      {selected && <span className="text-primary font-black">✓</span>}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Selected areas: <span className="font-semibold text-foreground">{formData.areas.join(', ')}</span>
              </p>
            </CardContent>
            <CardFooter className="flex justify-between border-t pt-4">
              <Button variant="outline" onClick={() => setStep(1)}>
                &larr; Back
              </Button>
              <Button disabled={formData.areas.length === 0} onClick={() => setStep(3)}>
                Next: Working Hours &rarr;
              </Button>
            </CardFooter>
          </>
        )}

        {/* STEP 3: WORKING HOURS */}
        {step === 3 && (
          <>
            <CardHeader>
              <CardTitle className="text-xl">3. Working Hours & Availability</CardTitle>
              <CardDescription>
                Your AI receptionist only offers slots when your technicians are active.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Active Working Days</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {WEEKDAYS.map((day) => {
                    const active = formData.working_days.includes(day.id);
                    return (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => toggleDay(day.id)}
                        className={`rounded-lg border p-2.5 text-center text-xs font-medium transition-all ${
                          active
                            ? 'border-primary bg-primary text-primary-foreground font-bold shadow-sm'
                            : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {day.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="opens">Opening Time</Label>
                  <Input
                    id="opens"
                    type="time"
                    value={formData.opens}
                    onChange={(e) => setFormData({ ...formData, opens: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="closes">Closing Time</Label>
                  <Input
                    id="closes"
                    type="time"
                    value={formData.closes}
                    onChange={(e) => setFormData({ ...formData, closes: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t pt-4">
              <Button variant="outline" onClick={() => setStep(2)}>
                &larr; Back
              </Button>
              <Button disabled={formData.working_days.length === 0} onClick={() => setStep(4)}>
                Next: Voice & AI Agent &rarr;
              </Button>
            </CardFooter>
          </>
        )}

        {/* STEP 4: VOICE & AGENT PERSONALITY */}
        {step === 4 && (
          <>
            <CardHeader>
              <CardTitle className="text-xl">4. AI Voice Receptionist Setup</CardTitle>
              <CardDescription>
                Choose voices and greetings for your automated receptionist.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="agent_name">Agent Name</Label>
                <Input
                  id="agent_name"
                  placeholder={`${formData.business_name || 'Business'} Receptionist`}
                  value={formData.agent_name}
                  onChange={(e) => setFormData({ ...formData, agent_name: e.target.value })}
                />
              </div>

              <div className="space-y-3">
                <Label>Urdu Neural Voice</Label>
                <div className="grid grid-cols-2 gap-3">
                  {AZURE_VOICES.ur.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, voice_ur: v.id })}
                      className={`rounded-lg border p-3 text-left text-xs transition-all ${
                        formData.voice_ur === v.id
                          ? 'border-primary bg-primary/10 font-bold text-primary shadow-sm'
                          : 'border-border bg-card text-muted-foreground'
                      }`}
                    >
                      <p className="font-semibold text-foreground">{v.name}</p>
                      <p className="text-[10px] text-muted-foreground">Azure Neural PK</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Pashto Neural Voice</Label>
                <div className="grid grid-cols-2 gap-3">
                  {AZURE_VOICES.ps.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, voice_ps: v.id })}
                      className={`rounded-lg border p-3 text-left text-xs transition-all ${
                        formData.voice_ps === v.id
                          ? 'border-primary bg-primary/10 font-bold text-primary shadow-sm'
                          : 'border-border bg-card text-muted-foreground'
                      }`}
                    >
                      <p className="font-semibold text-foreground">{v.name}</p>
                      <p className="text-[10px] text-muted-foreground">Azure Neural AF/PK</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg bg-muted/60 p-3.5 text-xs text-muted-foreground space-y-1 border">
                <p className="font-semibold text-foreground">Initial Trade Template:</p>
                <p>
                  Your agent will be pre-configured with 4 standard {formData.trades[0]} service packages and Urdu greetings.
                  You can edit custom greetings, prices, and FAQs anytime in your portal.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t pt-4">
              <Button variant="outline" onClick={() => setStep(3)}>
                &larr; Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="font-semibold px-6 shadow-md"
              >
                {loading ? 'Initializing Agent...' : 'Launch Provider Portal 🚀'}
              </Button>
            </CardFooter>
          </>
        )}
      </Card>
    </div>
  );
}
