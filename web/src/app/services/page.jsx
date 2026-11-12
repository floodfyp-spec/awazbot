import { Suspense } from 'react';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/lib/i18n';
import { DEMO_PROVIDERS } from '@/lib/demo-data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CallAgentButton } from '@/components/call-agent-button';

export const dynamic = 'force-dynamic';

function checkIsOpen(workingHours) {
  if (!workingHours || !workingHours.days || !workingHours.open || !workingHours.close) {
    return true;
  }
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

  return currentMinutes >= (openH * 60 + openM) && currentMinutes <= (closeH * 60 + closeM);
}

const PESHAWAR_AREAS = [
  'Hayatabad',
  'University Town',
  'Saddar',
  'Board Bazaar',
  'Gulbahar',
  'Warsak Road',
  'Ring Road',
  'Charsadda Road',
  'Tehkal',
  'Peshawar Cantt',
];

const TRADES = [
  { id: 'electrician', name_en: 'Electrician', name_ur: 'الیکٹریشن' },
  { id: 'ups_solar', name_en: 'UPS & Solar', name_ur: 'یو پی ایس اور سولر' },
  { id: 'ac_fridge', name_en: 'AC & Fridge', name_ur: 'اے سی اور فریج' },
  { id: 'plumber_gas', name_en: 'Plumber & Gas', name_ur: 'پلمبر اور گیس' },
];

export async function generateMetadata() {
  return {
    title: 'Peshawar Service Directory — AwazBot KP',
    description: 'Find verified electricians, plumbers, solar technicians, and AC mechanics in Peshawar.',
  };
}

export default async function ServicesPage({ searchParams }) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const lang = cookieStore.get('awaz_lang')?.value || 'en';
  const t = getDictionary(lang);

  const selectedTrade = params?.trade || '';
  const selectedArea = params?.area || '';
  const openOnly = params?.open === 'true';

  const supabase = await createClient();

  // Query approved providers from Supabase
  let query = supabase
    .from('providers')
    .select('*')
    .eq('status', 'approved');

  if (selectedTrade) {
    query = query.contains('trades', [selectedTrade]);
  }

  if (selectedArea) {
    query = query.contains('areas', [selectedArea]);
  }

  let dbProviders = [];
  try {
    const { data: rawProviders } = await query;
    if (rawProviders && rawProviders.length > 0) {
      dbProviders = rawProviders.map((p) => ({
        ...p,
        name: p.business_name || p.name || 'Local Service Provider',
        business_name: p.business_name || p.name || 'Local Service Provider',
      }));
    }
  } catch (err) {
    console.warn('Database query fallback:', err);
  }

  // Combine real DB approved providers + Demo providers
  const existingIds = new Set(dbProviders.map((p) => p.id));
  const filteredDemo = DEMO_PROVIDERS.filter((p) => {
    if (existingIds.has(p.id)) return false;
    if (selectedTrade && !p.trades.includes(selectedTrade)) return false;
    if (selectedArea && !p.areas.includes(selectedArea)) return false;
    return true;
  });

  let providers = [...dbProviders, ...filteredDemo];

  if (openOnly) {
    providers = providers.filter((p) => checkIsOpen(p.working_hours));
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header and Filter Bar */}
      <div className="flex flex-col gap-6 mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            {lang === 'ur' ? 'پشاور سروس ڈائریکٹری' : 'Peshawar Service Directory'}
          </h1>
          <p className="text-muted-foreground mt-1 text-base">
            {lang === 'ur'
              ? 'پشاور کے تصدیق شدہ کاریگر — صوتی اسسٹنٹ یا واٹس ایپ پر دستیاب'
              : 'Verified technicians across Peshawar available for direct voice calls & bookings'}
          </p>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
          {/* Trade Filter */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-semibold uppercase text-muted-foreground mr-1">
              {t.tradesTitle}:
            </span>
            <Link href={`/services?area=${selectedArea}&open=${openOnly}`}>
              <Badge
                variant={!selectedTrade ? 'default' : 'outline'}
                className="cursor-pointer px-3 py-1 text-xs"
              >
                {t.allTrades}
              </Badge>
            </Link>
            {TRADES.map((trade) => (
              <Link
                key={trade.id}
                href={`/services?trade=${trade.id}&area=${selectedArea}&open=${openOnly}`}
              >
                <Badge
                  variant={selectedTrade === trade.id ? 'default' : 'outline'}
                  className="cursor-pointer px-3 py-1 text-xs"
                >
                  {lang === 'ur' ? trade.name_ur : trade.name_en}
                </Badge>
              </Link>
            ))}
          </div>

          <div className="h-6 w-px bg-border hidden md:block" />

          {/* Area Filter */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-semibold uppercase text-muted-foreground mr-1">
              Area:
            </span>
            <Link href={`/services?trade=${selectedTrade}&open=${openOnly}`}>
              <Badge
                variant={!selectedArea ? 'default' : 'outline'}
                className="cursor-pointer px-3 py-1 text-xs"
              >
                {t.allAreas}
              </Badge>
            </Link>
            {PESHAWAR_AREAS.slice(0, 5).map((area) => (
              <Link
                key={area}
                href={`/services?trade=${selectedTrade}&area=${area}&open=${openOnly}`}
              >
                <Badge
                  variant={selectedArea === area ? 'default' : 'outline'}
                  className="cursor-pointer px-3 py-1 text-xs"
                >
                  {area}
                </Badge>
              </Link>
            ))}
          </div>

          <div className="h-6 w-px bg-border hidden md:block" />

          {/* Open Now Toggle */}
          <Link
            href={`/services?trade=${selectedTrade}&area=${selectedArea}&open=${!openOnly}`}
            className="ml-auto"
          >
            <Badge
              variant={openOnly ? 'default' : 'outline'}
              className="cursor-pointer px-3 py-1.5 text-xs font-medium"
            >
              🟢 {t.openNowOnly}
            </Badge>
          </Link>
        </div>
      </div>

      {/* Provider List / Grid */}
      {providers.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <CardHeader>
            <CardTitle className="text-xl font-bold">{t.noProvidersFound}</CardTitle>
            <CardDescription className="text-base mt-2">{t.noProvidersHint}</CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center pt-4">
            <Link href="/services">
              <Button variant="outline">{t.clearFilters}</Button>
            </Link>
          </CardFooter>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {providers.map((provider) => {
            const isOpen = checkIsOpen(provider.working_hours);
            const startingPrice = provider.services?.[0]?.price_min;

            return (
              <Card key={provider.id} className="flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-xl font-bold text-foreground">
                        <Link href={`/p/${provider.slug}`} className="hover:underline">
                          {provider.name}
                        </Link>
                      </CardTitle>
                      <CardDescription className="font-mono text-xs text-muted-foreground mt-0.5">
                        {provider.provider_code}
                      </CardDescription>
                    </div>
                    <Badge variant={isOpen ? 'default' : 'secondary'} className="text-[11px] font-medium shrink-0">
                      {isOpen ? t.openNow : t.closed}
                    </Badge>
                  </div>

                  {/* Trades Badges */}
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {provider.trades?.map((trade) => (
                      <Badge key={trade} variant="outline" className="text-[10px] uppercase tracking-wider bg-muted/40">
                        {trade.replace('_', ' ')}
                      </Badge>
                    ))}
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pb-4">
                  {/* Localities served */}
                  <div className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Areas: </span>
                    {provider.areas?.slice(0, 3).join(', ')}
                    {provider.areas?.length > 3 ? ` +${provider.areas.length - 3}` : ''}
                  </div>

                  {/* Starting price */}
                  {startingPrice && (
                    <div className="text-sm">
                      <span className="text-xs text-muted-foreground">Starting from </span>
                      <span className="font-bold text-foreground">PKR {startingPrice.toLocaleString()}</span>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="flex flex-col gap-2 border-t pt-3">
                  <div className="grid grid-cols-2 gap-2 w-full">
                    <CallAgentButton
                      mode="provider"
                      providerId={provider.id}
                      label={lang === 'ur' ? '🎙️ وائس ایجنٹ' : '🎙️ Voice Agent'}
                      className="w-full h-10 text-xs font-semibold shadow-sm"
                    />
                    <Link href={`/chat/${provider.id}`} className="w-full">
                      <Button
                        variant="secondary"
                        className="w-full h-10 text-xs font-semibold gap-1.5 border border-primary/20 bg-primary/10 hover:bg-primary/20 text-primary"
                      >
                        {lang === 'ur' ? '💬 چیٹ ایجنٹ' : '💬 Chat Agent'}
                      </Button>
                    </Link>
                  </div>
                  <Link href={`/p/${provider.slug}`} className="w-full">
                    <Button variant="ghost" size="sm" className="w-full h-8 text-xs text-muted-foreground hover:text-foreground">
                      {t.viewProfile} &rarr;
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
