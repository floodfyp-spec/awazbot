'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get('next') || '/provider';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        toast.error(error.message || 'Login failed. Please check your credentials.');
        return;
      }

      toast.success('Signed in successfully!');
      router.push(nextUrl);
      router.refresh();
    } catch (err) {
      toast.error('An unexpected error occurred during login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-md border-border">
      <CardHeader className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black text-2xl shadow-sm">
          آ
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight">
          Sign In / لاگ ان
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Enter your credentials to access your AwazBot portal
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleLogin}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Email Address / ای میل
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="provider@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 px-3 text-base"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm font-medium">
                Password / پاس ورڈ
              </Label>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 px-3 text-base"
              disabled={loading}
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <Button
            type="submit"
            className="w-full h-11 text-base font-medium shadow-sm"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In / لاگ ان کریں'}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-semibold text-primary underline underline-offset-4 hover:text-primary/80">
              Register as Provider
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4 sm:p-6 md:p-8">
      <Suspense fallback={<div className="h-96 w-full max-w-md animate-pulse rounded-lg bg-muted" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
