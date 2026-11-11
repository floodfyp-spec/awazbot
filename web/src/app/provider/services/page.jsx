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
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { updateProviderServicesAndHours } from '@/lib/actions/provider';
import { PESHAWAR_AREAS } from '@/lib/trade-templates';

const WEEKDAYS = [
  { id: 1, name: 'Monday' },
  { id: 2, name: 'Tuesday' },
  { id: 3, name: 'Wednesday' },
  { id: 4, name: 'Thursday' },
  { id: 5, name: 'Friday' },
  { id: 6, name: 'Saturday' },
  { id: 0, name: 'Sunday' },
];

export default function ProviderServicesPage() {
  const [provider, setProvider] = useState(null);
  const [services, setServices] = useState([]);
  const [areas, setAreas] = useState([]);
  const [workingDays, setWorkingDays] = useState([1, 2, 3, 4, 5, 6]);
  const [opens, setOpens] = useState('08:00');
  const [closes, setCloses] = useState('20:00');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New service modal/inputs
  const [newServiceName, setNewServiceName] = useState('');
  const [newPriceFrom, setNewPriceFrom] = useState(1000);
  const [newPriceTo, setNewPriceTo] = useState(3000);

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

      const [servicesRes, areasRes, hoursRes] = await Promise.all([
        supabase.from('provider_services').select('*').eq('provider_id', prov.id),
        supabase.from('provider_areas').select('*').eq('provider_id', prov.id),
        supabase.from('working_hours').select('*').eq('provider_id', prov.id),
      ]);

      if (servicesRes.data && servicesRes.data.length > 0) {
        setServices(servicesRes.data);
      }
      if (areasRes.data && areasRes.data.length > 0) {
        setAreas(areasRes.data.map((a) => a.area));
      } else {
        setAreas(['Hayatabad', 'University Town']);
      }
      if (hoursRes.data && hoursRes.data.length > 0) {
        setWorkingDays(hoursRes.data.map((h) => h.weekday));
        setOpens(hoursRes.data[0].opens?.slice(0, 5) || '08:00');
        setCloses(hoursRes.data[0].closes?.slice(0, 5) || '20:00');
      }

      setLoading(false);
    }

    loadData();
  }, []);

  const handleAddService = (e) => {
    e.preventDefault();
    if (!newServiceName.trim()) return;
    setServices([
      ...services,
      {
        id: `temp_${Date.now()}`,
        name: newServiceName.trim(),
        price_from: Number(newPriceFrom) || 500,
        price_to: Number(newPriceTo) || 2000,
      },
    ]);
    setNewServiceName('');
    setNewPriceFrom(1000);
    setNewPriceTo(3000);
    toast.success('Service added to list.');
  };

  const handleRemoveService = (index) => {
    setServices(services.filter((_, i) => i !== index));
  };

  const toggleArea = (areaName) => {
    if (areas.includes(areaName)) {
      if (areas.length === 1) {
        toast.info('You must keep at least one area.');
        return;
      }
      setAreas(areas.filter((a) => a !== areaName));
    } else {
      setAreas([...areas, areaName]);
    }
  };

  const toggleDay = (dayId) => {
    if (workingDays.includes(dayId)) {
      if (workingDays.length === 1) {
        toast.info('You must keep at least one active day.');
        return;
      }
      setWorkingDays(workingDays.filter((d) => d !== dayId));
    } else {
      setWorkingDays([...workingDays, dayId].sort());
    }
  };

  const handleSaveAll = async () => {
    if (!provider) return;
    setSaving(true);
    try {
      const hoursPayload = workingDays.map((w) => ({
        weekday: w,
        opens,
        closes,
      }));

      const res = await updateProviderServicesAndHours(provider.id, {
        services,
        areas,
        workingHours: hoursPayload,
      });

      if (res.ok) {
        toast.success('Services, coverage areas, and hours updated successfully!');
      } else {
        toast.error(res.error || 'Failed to update services.');
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
        Loading services & hours...
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 sm:px-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Services & Working Hours
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your service catalog, price ranges quoted by your voice agent, and active working schedules.
          </p>
        </div>
        <Button
          onClick={handleSaveAll}
          disabled={saving}
          className="h-9 px-5 text-xs font-semibold shadow-sm"
        >
          {saving ? 'Saving...' : 'Save All Changes'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Services & Pricing */}
        <div className="space-y-6">
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">Services & Price Ranges</CardTitle>
              <CardDescription className="text-xs">
                Your AI agent uses these price boundaries when answering customer questions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Service Mini-Form */}
              <form onSubmit={handleAddService} className="rounded-lg border bg-muted/30 p-3 space-y-3">
                <Label className="text-xs font-semibold">Add New Service</Label>
                <Input
                  placeholder="Service Name (e.g. Solar Inverter Tuning)"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  className="text-xs bg-white dark:bg-background"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-muted-foreground">Price From (PKR)</span>
                    <Input
                      type="number"
                      value={newPriceFrom}
                      onChange={(e) => setNewPriceFrom(e.target.value)}
                      className="text-xs bg-white dark:bg-background"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground">Price To (PKR)</span>
                    <Input
                      type="number"
                      value={newPriceTo}
                      onChange={(e) => setNewPriceTo(e.target.value)}
                      className="text-xs bg-white dark:bg-background"
                    />
                  </div>
                </div>
                <Button type="submit" size="sm" variant="outline" className="w-full text-xs h-8 font-semibold">
                  + Add to Catalog
                </Button>
              </form>

              {/* Current Services List */}
              <div className="divide-y text-xs border rounded-lg overflow-hidden">
                {services.map((svc, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between hover:bg-muted/30">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-foreground">{svc.name}</p>
                      <p className="text-muted-foreground text-[11px]">
                        PKR {svc.price_from?.toLocaleString()} – {svc.price_to?.toLocaleString()}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveService(idx)}
                      className="h-7 px-2 text-destructive hover:bg-destructive/10 text-xs"
                    >
                      Delete
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Areas & Hours */}
        <div className="space-y-6">
          {/* Areas */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">Coverage Areas in Peshawar</CardTitle>
              <CardDescription className="text-xs">
                Areas where your business accepts voice and online bookings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {PESHAWAR_AREAS.map((area) => {
                  const selected = areas.includes(area);
                  return (
                    <Badge
                      key={area}
                      variant={selected ? 'default' : 'outline'}
                      className="cursor-pointer px-3 py-1.5 text-xs font-medium transition-colors"
                      onClick={() => toggleArea(area)}
                    >
                      {area} {selected && '✓'}
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Working Hours */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">Working Hours</CardTitle>
              <CardDescription className="text-xs">
                Available slots are generated within these hours.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="space-y-2">
                <Label>Active Days</Label>
                <div className="grid grid-cols-4 gap-1.5">
                  {WEEKDAYS.map((day) => {
                    const active = workingDays.includes(day.id);
                    return (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => toggleDay(day.id)}
                        className={`rounded-md border p-2 text-center text-xs font-medium transition-colors ${
                          active
                            ? 'border-primary bg-primary text-primary-foreground font-bold shadow-xs'
                            : 'border-border bg-card text-muted-foreground'
                        }`}
                      >
                        {day.name.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-1">
                  <Label htmlFor="opens">Opens At</Label>
                  <Input
                    id="opens"
                    type="time"
                    value={opens}
                    onChange={(e) => setOpens(e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="closes">Closes At</Label>
                  <Input
                    id="closes"
                    type="time"
                    value={closes}
                    onChange={(e) => setCloses(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
