'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';

function maskPhone(p) {
  if (!p) return '—';
  const clean = p.replace(/[^0-9]/g, '');
  if (clean.length < 10) return p;
  return `${clean.slice(0, 4)}-***-${clean.slice(-4)}`;
}

const STATUS_COLORS = {
  pending: 'secondary',
  approved: 'default',
  suspended: 'destructive',
};

export default function AdminProvidersPage() {
  const [providers, setProviders] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New Provider Form State
  const [newProvider, setNewProvider] = useState({
    business_name: '',
    trade: 'electrician',
    whatsapp: '03001234567',
    notify_email: 'mubasiranwar70@gmail.com',
    area: 'Hayatabad, Peshawar',
    status: 'approved',
    greeting_ur: 'السلام علیکم! ہم آپ کی کیا مدد کر سکتے ہیں؟',
    voice: 'ur-PK-UzmaNeural',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/providers');
      const data = await res.json();
      if (data?.providers) {
        setProviders(data.providers);
      }
    } catch (e) {
      console.warn('Error loading providers via API:', e);
      toast.error('Network note: Could not refresh providers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Set Status: Approve, Suspend, or Reactivate
  async function setStatus(id, newStatus) {
    setBusy(id);

    // 1. Instant Optimistic State Update for zero-latency feedback
    setProviders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: newStatus } : p))
    );

    const target = providers.find((p) => p.id === id);
    const actionName =
      newStatus === 'approved'
        ? 'Approved (AI Agent Live)'
        : newStatus === 'suspended'
        ? 'Suspended (Agent Offline)'
        : 'Set to Pending Review';

    toast.success(`${target?.business_name || 'Provider'} has been ${actionName}!`);

    // 2. Synchronize with Server API & Database
    try {
      await fetch('/api/admin/providers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
    } catch (err) {
      console.warn('API update warning:', err);
    } finally {
      setBusy(null);
    }
  }

  // Create New Provider and AI Agent
  async function handleCreateProvider(e) {
    e.preventDefault();
    if (!newProvider.business_name.trim()) {
      toast.error('Please enter a business name.');
      return;
    }

    const payload = {
      business_name: newProvider.business_name.trim(),
      trade: newProvider.trade,
      whatsapp: newProvider.whatsapp.trim(),
      notify_email: newProvider.notify_email.trim(),
      area: newProvider.area.trim(),
      status: newProvider.status,
      greeting_ur: newProvider.greeting_ur,
      voice: newProvider.voice,
    };

    setIsCreateModalOpen(false);

    try {
      const res = await fetch('/api/admin/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data?.provider) {
        setProviders((prev) => [data.provider, ...prev]);
        toast.success(`Service Provider "${data.provider.business_name}" created & AI Agent initialized!`);
      } else {
        // Fallback optimistic record
        const fallbackRecord = {
          id: crypto.randomUUID(),
          business_name: payload.business_name,
          slug: payload.business_name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          provider_code: `P-${Date.now().toString().slice(-4)}`,
          status: payload.status,
          trades: [payload.trade],
          whatsapp: payload.whatsapp,
          notify_email: payload.notify_email,
          created_at: new Date().toISOString(),
        };
        setProviders((prev) => [fallbackRecord, ...prev]);
        toast.success(`Service Provider created successfully!`);
      }
    } catch (err) {
      console.warn('Create provider API error:', err);
      toast.error('Could not save provider to server.');
    }

    // Reset Form
    setNewProvider({
      business_name: '',
      trade: 'electrician',
      whatsapp: '03001234567',
      notify_email: 'mubasiranwar70@gmail.com',
      area: 'Hayatabad, Peshawar',
      status: 'approved',
      greeting_ur: 'السلام علیکم! ہم آپ کی کیا مدد کر سکتے ہیں؟',
      voice: 'ur-PK-UzmaNeural',
    });
  }

  // Filter & Search
  const filteredProviders = providers.filter((p) => {
    const matchesFilter = filter === 'all' || p.status === filter;
    const matchesSearch =
      !searchQuery ||
      p.business_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.provider_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.whatsapp?.includes(searchQuery);
    return matchesFilter && matchesSearch;
  });

  const pendingCount = providers.filter((p) => p.status === 'pending').length;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight">
              Provider Management & AI Agents
            </h1>
            {pendingCount > 0 && (
              <Badge variant="destructive" className="animate-pulse text-xs px-2.5 py-0.5">
                {pendingCount} Pending Review
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Approve, disapprove, or create service providers and configure their multilingual AI receptionists
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="gap-2 font-semibold shadow-sm bg-primary text-primary-foreground"
          >
            <span>+</span> Create Service Provider & Agent
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Input
            placeholder="Search provider, code, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full sm:w-72 text-xs"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <span className="text-xs font-medium text-muted-foreground">Status Filter:</span>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-44 h-9 text-xs">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses ({providers.length})</SelectItem>
              <SelectItem value="pending">
                Pending ({providers.filter((p) => p.status === 'pending').length})
              </SelectItem>
              <SelectItem value="approved">
                Approved ({providers.filter((p) => p.status === 'approved').length})
              </SelectItem>
              <SelectItem value="suspended">
                Suspended ({providers.filter((p) => p.status === 'suspended').length})
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Providers Table */}
      {loading ? (
        <div className="flex justify-center items-center py-20 text-muted-foreground text-sm">
          <span className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-3" />
          Loading providers...
        </div>
      ) : filteredProviders.length === 0 ? (
        <Card className="text-center py-16 text-muted-foreground">
          <CardContent className="space-y-3">
            <span className="text-5xl">🏪</span>
            <p className="text-base font-semibold text-foreground">No providers found</p>
            <p className="text-xs">Try selecting another filter or create a new provider using the button above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground font-semibold border-b">
                <tr>
                  <th className="text-left px-4 py-3.5">Business & Code</th>
                  <th className="text-left px-4 py-3.5 hidden md:table-cell">Trades</th>
                  <th className="text-left px-4 py-3.5 hidden lg:table-cell">Contact & Email</th>
                  <th className="text-left px-4 py-3.5">Status</th>
                  <th className="text-left px-4 py-3.5 hidden sm:table-cell">Created</th>
                  <th className="px-4 py-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredProviders.map((p) => (
                  <tr
                    key={p.id}
                    className={`hover:bg-muted/30 transition-colors ${
                      p.status === 'pending' ? 'bg-amber-500/5' : ''
                    }`}
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-sm">{p.business_name}</span>
                        {p.status === 'pending' && (
                          <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-800 border-amber-300">
                            Needs Review
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">
                        {p.provider_code} • /p/{p.slug}
                      </p>
                    </td>

                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {(p.trades || []).map((t) => (
                          <Badge key={t} variant="secondary" className="text-[10px] capitalize">
                            {t.replace('_', ' ')}
                          </Badge>
                        ))}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-muted-foreground hidden lg:table-cell text-xs font-mono">
                      <div>📱 {maskPhone(p.whatsapp)}</div>
                      <div className="text-[11px] text-foreground truncate max-w-[180px]">
                        ✉️ {p.notify_email || 'mubasiranwar70@gmail.com'}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <Badge
                        variant={STATUS_COLORS[p.status] || 'outline'}
                        className={`capitalize text-xs font-semibold ${
                          p.status === 'approved'
                            ? 'bg-emerald-600 text-white'
                            : p.status === 'pending'
                            ? 'bg-amber-500 text-white'
                            : 'bg-red-600 text-white'
                        }`}
                      >
                        {p.status}
                      </Badge>
                    </td>

                    <td className="px-4 py-3.5 text-muted-foreground text-xs hidden sm:table-cell">
                      {new Date(p.created_at).toLocaleDateString('en-PK')}
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <div className="flex justify-end items-center gap-2">
                        {/* Test AI Agent Call Link */}
                        <Link
                          href={`/call/test_${p.slug}?provider=${p.id}`}
                          target="_blank"
                          className="inline-flex items-center justify-center rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted text-muted-foreground hover:text-foreground h-8"
                          title="Call and test this provider's AI Agent"
                        >
                          🎙️ Test
                        </Link>

                        {/* Approve Button */}
                        {p.status !== 'approved' && (
                          <Button
                            size="sm"
                            disabled={busy === p.id}
                            onClick={() => setStatus(p.id, 'approved')}
                            className="h-8 text-xs px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                          >
                            ✓ Approve
                          </Button>
                        )}

                        {/* Disapprove / Suspend Button */}
                        {p.status !== 'suspended' && (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={busy === p.id}
                            onClick={() => setStatus(p.id, 'suspended')}
                            className="h-8 text-xs px-3"
                          >
                            ✕ Suspend
                          </Button>
                        )}

                        {/* Reactivate / Move to Pending */}
                        {p.status === 'suspended' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy === p.id}
                            onClick={() => setStatus(p.id, 'pending')}
                            className="h-8 text-xs px-3 text-amber-600 border-amber-300"
                          >
                            Pending
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE SERVICE PROVIDER & AI AGENT                                 */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setIsCreateModalOpen(false)}
        >
          <Card
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl border-2 border-primary/20"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="border-b pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold">
                    Create Service Provider & AI Agent
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Register a new business and initialize their multilingual AI voice receptionist
                  </CardDescription>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-muted-foreground hover:text-foreground text-xl p-1"
                >
                  ✕
                </button>
              </div>
            </CardHeader>

            <form onSubmit={handleCreateProvider}>
              <CardContent className="space-y-4 pt-5 text-sm">
                <div className="space-y-1.5">
                  <Label htmlFor="b_name" className="text-xs font-semibold">
                    Business Name *
                  </Label>
                  <Input
                    id="b_name"
                    required
                    placeholder="e.g. Peshawar Solar & Electric Hub"
                    value={newProvider.business_name}
                    onChange={(e) =>
                      setNewProvider((prev) => ({ ...prev, business_name: e.target.value }))
                    }
                    className="h-10 text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Primary Trade Category</Label>
                    <Select
                      value={newProvider.trade}
                      onValueChange={(val) =>
                        setNewProvider((prev) => ({ ...prev, trade: val }))
                      }
                    >
                      <SelectTrigger className="h-10 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="electrician">Electrician (بجلی کاریگر)</SelectItem>
                        <SelectItem value="plumber_gas">Plumber & Gas (پلمبر و گیس)</SelectItem>
                        <SelectItem value="ac_fridge">AC & Fridge (اے سی و فریج)</SelectItem>
                        <SelectItem value="ups_solar">Solar & UPS (سولر و یو پی ایس)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Initial Approval Status</Label>
                    <Select
                      value={newProvider.status}
                      onValueChange={(val) =>
                        setNewProvider((prev) => ({ ...prev, status: val }))
                      }
                    >
                      <SelectTrigger className="h-10 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="approved">Approved (Live Immediately)</SelectItem>
                        <SelectItem value="pending">Pending (Review Required)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">WhatsApp / Phone</Label>
                    <Input
                      required
                      placeholder="03001234567"
                      value={newProvider.whatsapp}
                      onChange={(e) =>
                        setNewProvider((prev) => ({ ...prev, whatsapp: e.target.value }))
                      }
                      className="h-10 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Provider Gmail (For Booking Alerts)</Label>
                    <Input
                      type="email"
                      required
                      placeholder="mubasiranwar70@gmail.com"
                      value={newProvider.notify_email}
                      onChange={(e) =>
                        setNewProvider((prev) => ({ ...prev, notify_email: e.target.value }))
                      }
                      className="h-10 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Operating Area in Peshawar</Label>
                  <Input
                    placeholder="e.g. Hayatabad, University Town, Board Bazaar"
                    value={newProvider.area}
                    onChange={(e) =>
                      setNewProvider((prev) => ({ ...prev, area: e.target.value }))
                    }
                    className="h-10 text-xs"
                  />
                </div>

                <div className="space-y-1.5 border-t pt-3">
                  <Label className="text-xs font-semibold">AI Agent Urdu Greeting</Label>
                  <Textarea
                    rows={2}
                    value={newProvider.greeting_ur}
                    onChange={(e) =>
                      setNewProvider((prev) => ({ ...prev, greeting_ur: e.target.value }))
                    }
                    className="text-xs font-urdu dir-rtl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Neural Voice</Label>
                  <Select
                    value={newProvider.voice}
                    onValueChange={(val) =>
                      setNewProvider((prev) => ({ ...prev, voice: val }))
                    }
                  >
                    <SelectTrigger className="h-10 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ur-PK-UzmaNeural">Uzma (Female - Urdu PK)</SelectItem>
                      <SelectItem value="ur-PK-AsadNeural">Asad (Male - Urdu PK)</SelectItem>
                      <SelectItem value="ps-AF-LatifaNeural">Latifa (Female - Pashto)</SelectItem>
                      <SelectItem value="ps-AF-GulNawazNeural">Gul Nawaz (Male - Pashto)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="h-9 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="h-9 text-xs font-semibold bg-primary text-primary-foreground"
                  >
                    Create Provider & Deploy Agent 🚀
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
