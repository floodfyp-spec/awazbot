import Link from 'next/link';
import { cookies } from 'next/headers';
import { getDictionary } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CallAgentButton } from '@/components/call-agent-button';

export const dynamic = 'force-dynamic';

const TRADE_TILES = [
  {
    id: 'electrician',
    title_en: 'Electrician',
    title_ur: 'الیکٹریشن',
    desc_en: 'Wiring, short circuits, switchboards, lighting & fan fittings',
    desc_ur: 'شارٹ سرکٹ، وائرنگ کی مرمت، پنکھا فٹنگ اور بریکر مسائل',
    icon: '⚡',
  },
  {
    id: 'ups_solar',
    title_en: 'UPS & Solar',
    title_ur: 'یو پی ایس اور سولر',
    desc_en: 'Inverters, battery backup, solar panel maintenance & net metering',
    desc_ur: 'ہائبرڈ انورٹر، بیٹری بیک اپ، سولر سروس اور سیٹ اپ',
    icon: '☀️',
  },
  {
    id: 'ac_fridge',
    title_en: 'AC & Refrigeration',
    title_ur: 'اے سی اور فریج',
    desc_en: 'Master jet wash, gas refill, compressor faults, deep freezers',
    desc_ur: 'اے سی ماسٹر واش، گیس چارجنگ اور فریزر کی مکمل سروس',
    icon: '❄️',
  },
  {
    id: 'plumber_gas',
    title_en: 'Plumber & Gas Fitting',
    title_ur: 'پلمبر اور گیس فٹنگ',
    desc_en: 'Pipe bursts, drainage blockages, geyser service, water pumps',
    desc_ur: 'پائپ لیکیج، گیزر ریپیئر، پانی کی موٹر اور ڈرین مسائل',
    icon: '🔧',
  },
];

export default async function HomePage() {
  const cookieStore = await cookies();
  const lang = cookieStore.get('awaz_lang')?.value || 'en';
  const t = getDictionary(lang);
  const isUrdu = lang === 'ur';

  return (
    <div className="flex flex-col min-h-screen">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background py-16 sm:py-24 border-b">
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 text-center space-y-8">
          {/* Challenge Badge */}
          <div className="flex justify-center">
            <Badge variant="secondary" className="px-3.5 py-1 text-xs uppercase tracking-wider font-semibold text-emerald-800 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300">
              KPITB AI Innovation Challenge 2026
            </Badge>
          </div>

          {/* Hero Headlines */}
          <div className="space-y-4 max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-foreground leading-tight">
              {t.heroTitle}
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed">
              {t.heroSubtitle}
            </p>
          </div>

          {/* Central CTA: Talk to AwazBot */}
          <div className="pt-2 flex flex-col items-center gap-3">
            <CallAgentButton
              mode="directory"
              label={`🎙️ ${t.talkToAwazBot}`}
              sublabel={t.talkToAwazBotSub}
              className="h-16 w-full max-w-md text-xl font-bold shadow-lg hover:shadow-xl transition-all rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90"
            />
          </div>

          {/* Search bar */}
          <form action="/services" method="GET" className="max-w-xl mx-auto flex items-center gap-2 pt-4">
            <Input
              name="area"
              type="text"
              placeholder={t.searchPlaceholder}
              className="h-12 text-base px-4 rounded-xl border-input shadow-sm"
            />
            <Button type="submit" className="h-12 px-6 rounded-xl text-base font-semibold shrink-0">
              {t.searchButton}
            </Button>
          </form>
        </div>
      </section>

      {/* 2. FOUR TRADE TILES */}
      <section className="py-16 sm:py-20 bg-muted/20 border-b">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
              {t.tradesTitle}
            </h2>
            <p className="text-muted-foreground mt-2">
              {isUrdu
                ? 'اپنی ضرورت کے مطابق شعبہ منتخب کریں اور پشاور کے کاریگر دیکھیں'
                : 'Select a category to connect with approved technicians across Peshawar'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {TRADE_TILES.map((tile) => (
              <Link key={tile.id} href={`/services?trade=${tile.id}`} className="group">
                <Card className="h-full border border-border shadow-sm hover:border-primary/60 hover:shadow-md transition-all rounded-2xl">
                  <CardHeader className="space-y-3 pb-3">
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                      {tile.icon}
                    </div>
                    <CardTitle className="text-xl font-bold text-foreground">
                      {isUrdu ? tile.title_ur : tile.title_en}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-snug">
                      {isUrdu ? tile.desc_ur : tile.desc_en}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS */}
      <section className="py-16 sm:py-20">
        <div className="container mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
              {t.howItWorksTitle}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-3 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black text-lg">
                1
              </div>
              <h3 className="text-lg font-bold text-foreground">{t.step1Title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t.step1Desc}</p>
            </div>

            <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-3 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black text-lg">
                2
              </div>
              <h3 className="text-lg font-bold text-foreground">{t.step2Title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t.step2Desc}</p>
            </div>

            <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-3 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black text-lg">
                3
              </div>
              <h3 className="text-lg font-bold text-foreground">{t.step3Title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t.step3Desc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. FOOTER WITH MANDATORY PRIVACY NOTICE */}
      <footer className="mt-auto border-t py-8 bg-muted/30">
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 text-center space-y-4">
          <p className="text-xs sm:text-sm text-muted-foreground font-medium max-w-2xl mx-auto">
            🛡️ {t.privacyNote}
          </p>
          <div className="text-xs text-muted-foreground/80 flex flex-wrap justify-center gap-4">
            <span>AwazBot KP © 2026</span>
            <span>•</span>
            <Link href="/services" className="hover:underline">Directory</Link>
            <span>•</span>
            <Link href="/login" className="hover:underline">Provider Portal</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
