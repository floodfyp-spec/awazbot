import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function ProviderLayout({ children }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/provider');
  }

  // Fetch provider record owned by current user
  const { data: provider } = await supabase
    .from('providers')
    .select('id, business_name, slug, provider_code, status')
    .eq('owner_user_id', user.id)
    .maybeSingle();

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-muted/20">
      {/* Provider Sub-Navigation Header */}
      {provider && (
        <div className="border-b bg-card sticky top-16 z-30 shadow-xs">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-3">
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-foreground tracking-tight">
                      {provider.business_name}
                    </span>
                    <Badge variant="outline" className="font-mono text-[11px] px-1.5 py-0">
                      {provider.provider_code}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Public slug:{' '}
                    <Link
                      href={`/p/${provider.slug}`}
                      target="_blank"
                      className="underline hover:text-primary"
                    >
                      /p/{provider.slug}
                    </Link>
                  </p>
                </div>
                <Badge
                  variant={provider.status === 'approved' ? 'default' : 'secondary'}
                  className="capitalize text-xs font-semibold"
                >
                  {provider.status}
                </Badge>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Link href="/provider/agent/test">
                  <Button size="sm" className="h-9 px-4 text-xs font-semibold shadow-sm gap-1.5">
                    <span>🎙️</span>
                    <span>Test My Agent</span>
                  </Button>
                </Link>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex space-x-1 sm:space-x-4 overflow-x-auto pb-2 pt-1 text-xs font-medium border-t border-border/50">
              <Link
                href="/provider"
                className="px-3 py-1.5 rounded-md hover:bg-muted text-foreground transition-colors shrink-0"
              >
                Dashboard
              </Link>
              <Link
                href="/provider/bookings"
                className="px-3 py-1.5 rounded-md hover:bg-muted text-foreground transition-colors shrink-0"
              >
                Bookings Inbox
              </Link>
              <Link
                href="/provider/agent"
                className="px-3 py-1.5 rounded-md hover:bg-muted text-foreground transition-colors shrink-0"
              >
                AI Voice Agent
              </Link>
              <Link
                href="/provider/services"
                className="px-3 py-1.5 rounded-md hover:bg-muted text-foreground transition-colors shrink-0"
              >
                Services & Hours
              </Link>
              <Link
                href="/provider/calls"
                className="px-3 py-1.5 rounded-md hover:bg-muted text-foreground transition-colors shrink-0"
              >
                Call Logs & Transcripts
              </Link>
              <Link
                href="/provider/settings"
                className="px-3 py-1.5 rounded-md hover:bg-muted text-foreground transition-colors shrink-0"
              >
                Alert Settings
              </Link>
            </nav>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 py-6">{children}</main>
    </div>
  );
}
