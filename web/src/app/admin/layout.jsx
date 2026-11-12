import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Admin — AwazBot KP' };
export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/admin', label: 'Overview', icon: '🏠' },
  { href: '/admin/providers', label: 'Providers', icon: '🏪' },
  { href: '/admin/calls', label: 'Calls', icon: '📞' },
  { href: '/admin/safety', label: 'Safety', icon: '🚨' },
  { href: '/admin/categories', label: 'Categories', icon: '📂' },
  { href: '/admin/evaluation', label: 'Evaluation', icon: '📊' },
];

export default async function AdminLayout({ children }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/admin');

  let role = null;
  let fullName = null;
  let profile = null;

  try {
    const { data } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('user_id', user.id)
      .single();
    profile = data;
    role = profile?.role;
    fullName = profile?.full_name;
  } catch (err) {
    console.warn('Could not read profile for admin layout:', err);
  }

  const isAdminEmail = user?.email === 'mubasiranwar70@gmail.com' || user?.email?.startsWith('admin@');
  if (role !== 'admin' && !isAdminEmail) {
    redirect('/');
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-56 border-r bg-card shrink-0">
        <div className="px-4 py-4 border-b">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Admin</p>
          <p className="text-sm font-bold mt-0.5 truncate">{fullName || user.email}</p>
          <Badge variant="destructive" className="mt-1 text-[10px] px-1.5">Admin Access</Badge>
        </div>
        <nav className="flex-1 py-3 space-y-0.5 px-2">
          {NAV.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors"
            >
              <span>{icon}</span>
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t">
          <Link href="/" className="text-xs text-muted-foreground hover:underline">← Back to Site</Link>
        </div>
      </aside>

      {/* Mobile nav */}
      <div className="md:hidden w-full border-b bg-card">
        <div className="flex overflow-x-auto px-4 py-2 gap-1">
          {NAV.map(({ href, label, icon }) => (
            <Link key={href} href={href} className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-muted whitespace-nowrap shrink-0">
              <span>{icon}</span><span>{label}</span>
            </Link>
          ))}
        </div>
      </div>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
