'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function SignupPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!email || !password || !fullName) {
      toast.error('Please complete all required fields.');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            role: 'provider',
            full_name: fullName.trim(),
            phone: phone.trim(),
          },
        },
      });

      if (error) {
        toast.error(error.message || 'Signup failed.');
        return;
      }

      toast.success('Account created! Logging in...');
      router.push('/provider');
      router.refresh();
    } catch (err) {
      toast.error('An unexpected error occurred during signup.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4 sm:p-6 md:p-8">
      <Card className="w-full max-w-md shadow-md border-border">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black text-2xl shadow-sm">
            آ
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Provider Registration / نیا اکاؤنٹ
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Register your service business on AwazBot KP
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSignup}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm font-medium">
                Full Name / مکمل نام
              </Label>
              <Input
                id="fullName"
                type="text"
                required
                placeholder="Muhammad Ali"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-11 px-3 text-base"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium">
                Phone Number / فون نمبر
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="03001234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-11 px-3 text-base"
                disabled={loading}
              />
            </div>

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
              <Label htmlFor="password" className="text-sm font-medium">
                Password / پاس ورڈ
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                placeholder="At least 6 characters"
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
              {loading ? 'Creating account...' : 'Register as Provider / رجسٹر کریں'}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-primary underline underline-offset-4 hover:text-primary/80">
                Sign In
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
