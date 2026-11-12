'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function Header({ currentLang = 'en' }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const isUrdu = currentLang === 'ur';

  useEffect(() => {
    const supabase = createClient();

    async function checkUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, full_name')
            .eq('user_id', user.id)
            .single();
          const determinedRole =
            profile?.role ||
            user.user_metadata?.role ||
            (user.email === 'mubasiranwar70@gmail.com' ? 'admin' : 'provider');
          setRole(determinedRole);
        } else {
          setRole(null);
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
      } finally {
        setLoading(false);
      }
    }

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      if (currentUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', currentUser.id)
          .single();
        const determinedRole =
          profile?.role ||
          currentUser.user_metadata?.role ||
          (currentUser.email === 'mubasiranwar70@gmail.com' ? 'admin' : 'provider');
        setRole(determinedRole);
      } else {
        setRole(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    router.push('/');
    router.refresh();
  };

  const toggleLanguage = () => {
    const nextLang = isUrdu ? 'en' : 'ur';
    document.cookie = `awaz_lang=${nextLang}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  };

  const isAdmin =
    role === 'admin' ||
    user?.email === 'mubasiranwar70@gmail.com' ||
    user?.email?.startsWith('admin@');

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight text-foreground">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-black text-lg shadow-sm">
              آ
            </span>
            <span>{isUrdu ? 'آواز بوٹ کے پی' : 'AwazBot KP'}</span>
          </Link>
          {role && (
            <Badge variant="outline" className="hidden sm:inline-flex capitalize text-xs">
              {role}
            </Badge>
          )}
        </div>

        {/* Navigation & Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Services Link */}
          <Link href="/services">
            <Button variant="ghost" size="sm" className="h-10 px-3 text-sm font-medium">
              {isUrdu ? 'سروسز' : 'Services'}
            </Button>
          </Link>

          {/* Language Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleLanguage}
            className="h-10 min-w-[72px] px-3 font-medium text-sm border-input hover:bg-accent"
            aria-label="Toggle language between English and Urdu"
          >
            {isUrdu ? 'English' : 'اردو'}
          </Button>

          {/* Auth State Actions */}
          {loading ? (
            <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
          ) : user ? (
            <div className="flex items-center gap-2">
              <Link href="/provider">
                <Button variant="ghost" size="sm" className="h-10 px-3 text-sm font-medium">
                  {isUrdu ? 'میرا پورٹل' : 'My Portal'}
                </Button>
              </Link>

              {isAdmin && (
                <Link href="/admin">
                  <Button
                    variant="default"
                    size="sm"
                    className="h-10 px-3 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white shadow-sm flex items-center gap-1.5"
                  >
                    <span>⚙️</span>
                    <span>{isUrdu ? 'ایڈمن کنٹرول' : 'Admin Portal'}</span>
                  </Button>
                </Link>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="h-10 px-3 text-sm font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                {isUrdu ? 'لاگ آؤٹ' : 'Logout'}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" size="sm" className="h-10 px-3 text-sm font-medium">
                  {isUrdu ? 'لاگ ان' : 'Login'}
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm" className="h-10 px-4 text-sm font-medium shadow-sm">
                  {isUrdu ? 'رجسٹر کریں' : 'Sign Up'}
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
