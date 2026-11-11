import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

/**
 * Updates and refreshes the Supabase user session in Next.js middleware.
 * Also checks role access for /provider/* and /admin/* routes.
 *
 * @param {import('next/server').NextRequest} request
 */
export async function updateSession(request) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: Avoid using supabase.auth.getSession() in middleware as it
  // doesn't guarantee token freshness; use getUser() instead.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Protect /provider and /admin routes
  if (path.startsWith('/provider') || path.startsWith('/admin')) {
    if (!user) {
      // Unauthenticated -> redirect to /login with return URL
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/login';
      redirectUrl.searchParams.set('next', path);
      return NextResponse.redirect(redirectUrl);
    }

    // Fetch user profile role from profiles table (primary key is user_id)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const role = profile?.role || user?.user_metadata?.role || 'customer';

    // /admin/* requires admin role
    if (path.startsWith('/admin') && role !== 'admin') {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/';
      redirectUrl.searchParams.delete('next');
      return NextResponse.redirect(redirectUrl);
    }

    // /provider/* requires provider or admin role
    if (path.startsWith('/provider') && role !== 'provider' && role !== 'admin') {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/';
      redirectUrl.searchParams.delete('next');
      return NextResponse.redirect(redirectUrl);
    }
  }

  return supabaseResponse;
}
