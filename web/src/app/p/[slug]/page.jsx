import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/lib/i18n';
import { DEMO_PROVIDERS } from '@/lib/demo-data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CallAgentButton } from '@/components/call-agent-button';

export const dynamic = 'force-dynamic';

function checkIsOpen(workingHours) {
  if (!workingHours || !workingHours.days || !workingHours.open || !workingHours.close) {
    return true; // Default open if not specified
  }

  // Pakistan Standard Time is UTC+5
  const now = new Date();
  const utcOffsetHours = 5;
  const localTime = new Date(now.getTime() + utcOffsetHours * 3600 * 1000);

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const currentDay = daysOfWeek[localTime.getUTCDay()];

  if (!workingHours.days.includes(currentDay)) {
    return false;
  }

  const currentMinutes = localTime.getUTCHours() * 60 + localTime.getUTCMinutes();
  const [openH, openM] = workingHours.open.split(':').map(Number);
  const [closeH, closeM] = workingHours.close.split(':').map(Number);

  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: provider } = await supabase
    .from('providers')
    .select('name, trades')
    .eq('slug', slug)
    .single();

  if (!provider) {
    return { title: 'Provider Not Found — AwazBot KP' };
  }

  return {
    title: `${provider.name} — AwazBot KP`,
    description: `Book ${provider.name} for ${provider.trades?.join(', ')} services in Peshawar via voice assistant or WhatsApp.`,
  };
}

export default async function ProviderProfilePage({ params }) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const lang = cookieStore.get('awaz_lang')?.value || 'en';
  const t = getDictionary(lang);

  const supabase = await createClient();
  let { data: provider } = await supabase
    .from('providers')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'approved')
    .single();

  if (!provider) {
    provider = DEMO_PROVIDERS.find((p) => p.slug === slug) || null;
  }

  if (!provider) {
    notFound();
  }

  const isOpen = checkIsOpen(provider.working_hours);
  const waNumber = process.env.NEXT_PUBLIC_WA_PLATFORM_NUMBER || '923000000000';
  const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(provider.provider_code)}`;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Back button */}
      <div className="mb-6">
        <Link href="/services">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
            &larr; {lang === 'ur' ? 'ڈائریکٹری پر واپس جائیں' : 'Back to Directory'}
          </Button>
        </Link>
      </div>

      {/* Main Profile Header Card */}
      <Card className="border-border shadow-sm">
        <CardHeader className="space-y-4 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                  {provider.name}
                </h1>
                <Badge variant={isOpen ? 'default' : 'secondary'} className="px-3 py-1 font-medium text-xs">
                  {isOpen ? t.openNow : t.closed}
                </Badge>
              </div>
              <p className="font-mono text-sm text-muted-foreground mt-1">
                ID: {provider.provider_code}
              </p>
            </div>

            {/* Badges for trades */}
            <div className="flex flex-wrap gap-2">
              {provider.trades?.map((trade) => (
                <Badge key={trade} variant="outline" className="text-xs uppercase tracking-wide px-3 py-1 bg-muted/50">
                  {trade.replace('_', ' ')}
                </Badge>
              ))}
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <CallAgentButton
              mode="provider"
              providerId={provider.id}
              label={t.callAgent}
              className="h-12 text-base font-semibold shadow-md sm:flex-1"
            />
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="sm:flex-1"
            >
              <Button
                variant="outline"
                className="w-full h-12 text-base font-semibold border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              >
                {t.messageWhatsApp}
              </Button>
            </a>
          </div>
        </CardHeader>

        <CardContent className="space-y-8 border-t pt-6">
          {/* Services & Price Tiers */}
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground mb-4">
              {t.servicesAndPricing}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {provider.services?.map((svc, idx) => (
                <div key={idx} className="flex justify-between items-center rounded-lg border p-4 bg-card shadow-sm hover:border-primary/50 transition-colors">
                  <span className="font-medium text-foreground text-sm pr-2">
                    {svc.name}
                  </span>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-primary text-base">
                      {svc.price_min?.toLocaleString()} – {svc.price_max?.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground block">
                      PKR {svc.unit || 'visit'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Areas Covered */}
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground mb-3">
              {t.serviceAreas}
            </h2>
            <div className="flex flex-wrap gap-2">
              {provider.areas?.map((area) => (
                <Badge key={area} variant="secondary" className="px-3 py-1.5 text-sm font-medium">
                  📍 {area}
                </Badge>
              ))}
            </div>
          </div>

          {/* Working Hours & Languages */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 rounded-xl bg-muted/40 p-4 sm:p-6 border">
            <div>
              <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider mb-2">
                {t.workingHours}
              </h3>
              <p className="text-sm text-foreground font-medium">
                {provider.working_hours?.days?.join(', ') || 'Mon - Sat'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {provider.working_hours?.open || '08:00'} — {provider.working_hours?.close || '20:00'} (PKT)
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider mb-2">
                {t.languagesSpoken}
              </h3>
              <div className="flex gap-2">
                <Badge variant="outline" className="bg-background">پشتو (Pashto)</Badge>
                <Badge variant="outline" className="bg-background">اردو (Urdu)</Badge>
                <Badge variant="outline" className="bg-background">English</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
