# AwazBot KP — Database Setup & Administration Guide

This guide walks you through applying the schema migration and initial seed data to your Supabase project, plus promoting an account to platform administrator.

---

## 1. Apply Migration & Seed Data

### Option A: Via Supabase Web Dashboard (Recommended)

1. Open your Supabase Project Dashboard: [https://supabase.com/dashboard/project/mhervthlsxezerasjddg](https://supabase.com/dashboard/project/mhervthlsxezerasjddg)
2. Go to the **SQL Editor** tab from the left navigation bar.
3. Click **New Query**.
4. Open the migration file [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) in your code editor, copy all its contents, paste them into the SQL Editor, and click **Run**.
   - This creates all 17 tables, triggers (`on_auth_user_created`), helper functions (`is_admin()`, `owns_provider()`), indexes, and RLS security policies.
5. In [`supabase/seed.sql`](../supabase/seed.sql), update the placeholder email `demo.notify@example.com` on line 12 and in the provider inserts to your team's test Gmail address if you wish to receive real notification emails.
6. Open a new query in the SQL Editor, paste the contents of [`supabase/seed.sql`](../supabase/seed.sql), and click **Run**.
   - This populates categories, 14 issues with urgencies and synonyms, 4 safety rules, and 10 Peshawar service providers (including flagship Khan Electric `KHAN-01`) with active agent configs.

---

### Option B: Via Supabase CLI (Local / CI)

If you have the Supabase CLI linked to your project:

```bash
# Link to remote project
supabase link --project-ref mhervthlsxezerasjddg

# Apply migration
supabase db push

# Apply seed data
supabase db execute --file supabase/seed.sql
```

---

## 2. Promote an Account to Admin

When a user signs up via `/signup`, their account is automatically assigned the `provider` role in the `profiles` table.

To elevate your account to **`admin`**, run this single SQL statement in the Supabase SQL Editor:

```sql
UPDATE profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'your-email@example.com'
);
```

*(Replace `'your-email@example.com'` with the actual email you registered with).*

After running this query, refreshing the web application or re-logging in will give you access to the `/admin` portal and display the **Admin** button in the header.

---

## 3. Verify Row Level Security (RLS)

To confirm that row level security constraints are properly enforced:
1. Open the SQL Editor in Supabase.
2. Paste the contents of [`supabase/tests/rls_checks.sql`](../supabase/tests/rls_checks.sql).
3. Click **Run**.
4. The output will verify:
   - Anonymous visitors can browse approved providers, but cannot access bookings or calls.
   - Providers can only access their own bookings and data.
   - Admins can inspect all platform records.
