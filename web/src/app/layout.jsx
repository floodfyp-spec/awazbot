import { cookies } from 'next/headers';
import './globals.css';
import { Header } from '@/components/header';
import { Toaster } from '@/components/ui/sonner';

export const metadata = {
  title: 'AwazBot KP — AI Voice Receptionist for Local Services',
  description: 'AI Voice Platform for Local Service Providers in Khyber Pakhtunkhwa (Pashto & Urdu voice receptionists)',
};

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const lang = cookieStore.get('awaz_lang')?.value || 'en';
  const isUrdu = lang === 'ur';

  return (
    <html lang={lang} dir={isUrdu ? 'rtl' : 'ltr'}>
      <body className="min-h-screen flex flex-col bg-background font-sans antialiased text-foreground">
        <Header currentLang={lang} />
        <main className="flex-1">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  );
}
