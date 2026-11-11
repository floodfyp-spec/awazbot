'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { createClient } from '@/lib/supabase/client';
import {
  sendTestNotificationEmail,
  updateProviderSettings,
} from '@/lib/actions/provider';

export default function ProviderSettingsPage() {
  const [provider, setProvider] = useState(null);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [whatsapp, setWhatsapp] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testEmailLoading, setTestEmailLoading] = useState(false);

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
      setNotifyEmail(prov.notify_email || '');
      setEmailNotifications(prov.email_notifications !== false);
      setWhatsapp(prov.whatsapp || '');

      // Load last 20 notifications
      const { data: notifData } = await supabase
        .from('notifications')
        .select('*')
        .eq('provider_id', prov.id)
        .order('ts', { ascending: false })
        .limit(20);

      if (notifData) {
        setNotifications(notifData);
      }
      setLoading(false);
    }

    loadData();
  }, []);

  const handleSendTest = async () => {
    if (!notifyEmail || !notifyEmail.includes('@')) {
      toast.error('Please enter a valid email address.');
      return;
    }
    setTestEmailLoading(true);
    try {
      const res = await sendTestNotificationEmail(notifyEmail);
      if (res.ok) {
        toast.success(res.message || 'Test email dispatched successfully!');
      } else {
        toast.error(res.error || 'Failed to dispatch test email.');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setTestEmailLoading(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!provider) return;
    setSaving(true);
    try {
      const res = await updateProviderSettings(provider.id, {
        notify_email: notifyEmail,
        email_notifications: emailNotifications,
        whatsapp,
      });

      if (res.ok) {
        toast.success('Notification settings saved!');
      } else {
        toast.error(res.error || 'Failed to save settings.');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-12 text-center text-sm text-muted-foreground">
        Loading settings...
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 sm:px-6 space-y-6">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Alert & Notification Settings
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Configure where and how you receive urgent customer booking notices and safety alerts.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Settings Form */}
        <div className="space-y-6">
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">Email Notifications</CardTitle>
              <CardDescription className="text-xs">
                Booking alerts and emergency notifications sent via Gmail SMTP.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSaveSettings}>
              <CardContent className="space-y-4 text-xs">
                <div className="flex items-center justify-between border-b pb-3">
                  <div className="space-y-0.5">
                    <Label className="font-semibold text-xs">Email Alerts Enabled</Label>
                    <p className="text-[11px] text-muted-foreground">
                      Receive an alert email on every new reservation across Web and WhatsApp.
                    </p>
                  </div>
                  <Switch
                    checked={emailNotifications}
                    onCheckedChange={setEmailNotifications}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notify_email" className="font-semibold text-xs">
                    Notification Gmail Address
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="notify_email"
                      type="email"
                      value={notifyEmail}
                      onChange={(e) => setNotifyEmail(e.target.value)}
                      className="text-xs"
                      placeholder="business@gmail.com"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSendTest}
                      disabled={testEmailLoading || !notifyEmail}
                      className="shrink-0 text-xs font-semibold h-9"
                    >
                      {testEmailLoading ? 'Sending...' : 'Send Test'}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Phone numbers in emails are masked (0300-***-4567) to maintain customer privacy.
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <Label htmlFor="whatsapp" className="font-semibold text-xs">
                    Escalation WhatsApp Number
                  </Label>
                  <Input
                    id="whatsapp"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="text-xs font-mono"
                    placeholder="+923001234567"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Provided to callers when an inquiry requires human transfer.
                  </p>
                </div>
              </CardContent>

              <CardFooter className="border-t pt-3">
                <Button type="submit" disabled={saving} className="h-9 px-5 text-xs font-semibold">
                  {saving ? 'Saving...' : 'Save Settings'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>

        {/* Right: Last 20 Notifications Table */}
        <div className="space-y-6">
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">Recent Notifications Log</CardTitle>
              <CardDescription className="text-xs">
                Audit history of sent, failed, or skipped dispatch events.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 max-h-[420px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No notifications recorded yet.
                </div>
              ) : (
                <div className="divide-y text-xs">
                  {notifications.map((n) => (
                    <div key={n.id} className="p-3 space-y-1 hover:bg-muted/30">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold capitalize text-foreground">
                          {n.kind?.replace('_', ' ')}
                        </span>
                        <Badge
                          variant={
                            n.status === 'sent'
                              ? 'default'
                              : n.status === 'failed'
                              ? 'destructive'
                              : 'secondary'
                          }
                          className="capitalize text-[10px] py-0 px-1.5"
                        >
                          {n.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="font-mono truncate max-w-[180px]">{n.recipient}</span>
                        <span>{new Date(n.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {n.error && (
                        <p className="text-[10px] text-destructive italic">{n.error}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
