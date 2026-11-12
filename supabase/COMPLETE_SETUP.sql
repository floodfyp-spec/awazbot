-- =============================================================================
-- AwazBot KP — COMPLETE ALL-IN-ONE SETUP SCRIPT
-- Paste and Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/mhervthlsxezerasjddg/sql/new
-- =============================================================================

-- Enable pgcrypto for UUID generation
create extension if not exists "pgcrypto";

-- =============================================================================
-- 1. TABLES
-- =============================================================================

-- Profiles table (linked to auth.users)
create table if not exists public.profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    role text not null check (role in ('admin', 'provider', 'customer')) default 'provider',
    full_name text,
    phone text,
    created_at timestamptz not null default now()
);

-- Categories table (trades)
create table if not exists public.categories (
    code text primary key,
    name_en text not null,
    name_ur text not null,
    name_ps text not null,
    created_at timestamptz not null default now()
);

-- Issues table (standard trade issues, urgency, synonyms)
create table if not exists public.issues (
    id uuid primary key default gen_random_uuid(),
    category_code text not null references public.categories(code) on delete cascade,
    code text unique not null,
    urgency text not null check (urgency in ('EMERGENCY', 'URGENT', 'ROUTINE')),
    synonyms jsonb not null default '{"en":[],"ur":[],"ur_roman":[],"ps":[]}'::jsonb,
    created_at timestamptz not null default now()
);

-- Providers table
create table if not exists public.providers (
    id uuid primary key default gen_random_uuid(),
    owner_user_id uuid references auth.users(id) on delete set null,
    business_name text not null,
    slug text unique not null,
    provider_code text unique not null,
    status text not null check (status in ('pending', 'approved', 'suspended')) default 'pending',
    whatsapp text,
    notify_email text not null check (notify_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    email_notifications boolean not null default true,
    languages text[] not null default array['ps', 'ur'],
    trades text[] not null,
    rating numeric not null default 0,
    about text,
    created_at timestamptz not null default now()
);

-- Provider services and price ranges (PKR)
create table if not exists public.provider_services (
    id uuid primary key default gen_random_uuid(),
    provider_id uuid not null references public.providers(id) on delete cascade,
    name text not null,
    price_from integer not null,
    price_to integer not null,
    created_at timestamptz not null default now()
);

-- Provider service areas
create table if not exists public.provider_areas (
    id uuid primary key default gen_random_uuid(),
    provider_id uuid not null references public.providers(id) on delete cascade,
    area text not null,
    created_at timestamptz not null default now()
);

-- Working hours per weekday (0 = Sunday ... 6 = Saturday)
create table if not exists public.working_hours (
    id uuid primary key default gen_random_uuid(),
    provider_id uuid not null references public.providers(id) on delete cascade,
    weekday integer not null check (weekday between 0 and 6),
    opens time not null,
    closes time not null,
    created_at timestamptz not null default now()
);

-- Agent configurations (versioned, unique active version per provider)
create table if not exists public.agent_configs (
    id uuid primary key default gen_random_uuid(),
    provider_id uuid not null references public.providers(id) on delete cascade,
    version integer not null default 1,
    config jsonb not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

create unique index if not exists uq_agent_configs_active_provider
    on public.agent_configs (provider_id)
    where (is_active = true);

-- Customers table (optional accounts / guest callers)
create table if not exists public.customers (
    id uuid primary key default gen_random_uuid(),
    phone text unique,
    wa_id text unique,
    name text,
    preferred_lang text not null default 'ur',
    created_at timestamptz not null default now()
);

-- Voice / WhatsApp calls table
create table if not exists public.calls (
    id uuid primary key default gen_random_uuid(),
    channel text not null check (channel in ('web', 'wa_voice_note', 'wa_call')),
    mode text not null check (mode in ('directory', 'provider')),
    provider_id uuid references public.providers(id) on delete set null,
    customer_id uuid references public.customers(id) on delete set null,
    room_name text not null,
    started_at timestamptz not null default now(),
    ended_at timestamptz,
    duration_s integer,
    language text not null default 'ur',
    outcome text check (outcome in ('booked', 'info', 'emergency', 'dropped', 'test')),
    is_test boolean not null default false,
    avg_latency_ms integer,
    created_at timestamptz not null default now()
);

-- Call transcript turns
create table if not exists public.call_turns (
    id uuid primary key default gen_random_uuid(),
    call_id uuid not null references public.calls(id) on delete cascade,
    speaker text not null check (speaker in ('customer', 'agent', 'system')),
    text text not null,
    lang text not null,
    stt_engine text,
    confidence real,
    latency_ms integer,
    ts timestamptz not null default now(),
    created_at timestamptz not null default now()
);

-- Customer bookings table
create table if not exists public.bookings (
    id uuid primary key default gen_random_uuid(),
    provider_id uuid not null references public.providers(id) on delete cascade,
    customer_id uuid references public.customers(id) on delete set null,
    call_id uuid references public.calls(id) on delete set null,
    issue_code text not null,
    urgency text not null check (urgency in ('EMERGENCY', 'URGENT', 'ROUTINE')),
    problem_text text not null,
    area text not null,
    slot_start timestamptz not null,
    status text not null check (status in ('pending', 'confirmed', 'rejected', 'done')) default 'pending',
    customer_name text not null,
    customer_phone text not null,
    created_at timestamptz not null default now()
);

-- Notifications table (email and WhatsApp alert logs)
create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    booking_id uuid references public.bookings(id) on delete set null,
    call_id uuid references public.calls(id) on delete set null,
    provider_id uuid not null references public.providers(id) on delete cascade,
    channel text not null check (channel in ('email', 'whatsapp')),
    kind text not null check (kind in ('new_booking', 'emergency', 'test', 'status_change')),
    recipient text not null,
    status text not null check (status in ('sent', 'failed', 'skipped')),
    error text,
    ts timestamptz not null default now(),
    created_at timestamptz not null default now()
);

-- Safety rules (emergency keywords and spoken safety text)
create table if not exists public.safety_rules (
    id uuid primary key default gen_random_uuid(),
    code text unique not null,
    keywords jsonb not null,
    message jsonb not null,
    active boolean not null default true,
    created_at timestamptz not null default now()
);

-- Safety events (triggered emergency rule instances)
create table if not exists public.safety_events (
    id uuid primary key default gen_random_uuid(),
    call_id uuid not null references public.calls(id) on delete cascade,
    rule_code text not null references public.safety_rules(code) on delete cascade,
    matched_text text not null,
    actions text[] not null default array[]::text[],
    ts timestamptz not null default now(),
    created_at timestamptz not null default now()
);

-- Evaluation runs
create table if not exists public.eval_runs (
    id uuid primary key default gen_random_uuid(),
    kind text not null,
    engine text not null,
    lang text not null,
    slice text,
    metric text not null,
    value real not null,
    n integer not null,
    details jsonb,
    created_at timestamptz not null default now()
);

-- Audit log
create table if not exists public.audit_log (
    id uuid primary key default gen_random_uuid(),
    actor uuid references auth.users(id) on delete set null,
    action text not null,
    target text,
    ts timestamptz not null default now(),
    created_at timestamptz not null default now()
);

-- =============================================================================
-- 2. INDEXES
-- =============================================================================
create index if not exists idx_providers_status on public.providers(status);
create index if not exists idx_providers_slug on public.providers(slug);
create index if not exists idx_providers_owner on public.providers(owner_user_id);
create index if not exists idx_provider_services_provider on public.provider_services(provider_id);
create index if not exists idx_provider_areas_provider on public.provider_areas(provider_id);
create index if not exists idx_working_hours_provider on public.working_hours(provider_id);
create index if not exists idx_agent_configs_provider on public.agent_configs(provider_id);
create index if not exists idx_calls_provider on public.calls(provider_id);
create index if not exists idx_call_turns_call on public.call_turns(call_id);
create index if not exists idx_bookings_provider on public.bookings(provider_id);
create index if not exists idx_bookings_call on public.bookings(call_id);
create index if not exists idx_notifications_provider on public.notifications(provider_id);
create index if not exists idx_safety_events_call on public.safety_events(call_id);

-- =============================================================================
-- 3. HELPER FUNCTIONS & TRIGGERS
-- =============================================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
    select exists (
        select 1 from public.profiles
        where user_id = auth.uid()
          and role = 'admin'
    );
$$;

create or replace function public.owns_provider(pid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
    select exists (
        select 1 from public.providers
        where id = pid
          and owner_user_id = auth.uid()
    );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    user_role text;
    user_name text;
begin
    user_role := coalesce(new.raw_user_meta_data->>'role', 'provider');
    if user_role not in ('admin', 'provider', 'customer') then
        user_role := 'provider';
    end if;

    user_name := coalesce(new.raw_user_meta_data->>'full_name', new.email);

    insert into public.profiles (user_id, role, full_name, phone)
    values (
        new.id,
        user_role,
        user_name,
        new.raw_user_meta_data->>'phone'
    )
    on conflict (user_id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- =============================================================================
-- 4. ROW-LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.issues enable row level security;
alter table public.providers enable row level security;
alter table public.provider_services enable row level security;
alter table public.provider_areas enable row level security;
alter table public.working_hours enable row level security;
alter table public.agent_configs enable row level security;
alter table public.customers enable row level security;
alter table public.calls enable row level security;
alter table public.call_turns enable row level security;
alter table public.bookings enable row level security;
alter table public.notifications enable row level security;
alter table public.safety_rules enable row level security;
alter table public.safety_events enable row level security;
alter table public.eval_runs enable row level security;
alter table public.audit_log enable row level security;

-- PROFILES
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update using (user_id = auth.uid() or public.is_admin());
drop policy if exists "Admin can manage profiles" on public.profiles;
create policy "Admin can manage profiles" on public.profiles for all using (public.is_admin()) with check (public.is_admin());

-- CATEGORIES
drop policy if exists "Anyone can read categories" on public.categories;
create policy "Anyone can read categories" on public.categories for select using (true);
drop policy if exists "Admin can manage categories" on public.categories;
create policy "Admin can manage categories" on public.categories for all using (public.is_admin()) with check (public.is_admin());

-- ISSUES
drop policy if exists "Anyone can read issues" on public.issues;
create policy "Anyone can read issues" on public.issues for select using (true);
drop policy if exists "Admin can manage issues" on public.issues;
create policy "Admin can manage issues" on public.issues for all using (public.is_admin()) with check (public.is_admin());

-- PROVIDERS
drop policy if exists "Public can read approved providers" on public.providers;
create policy "Public can read approved providers" on public.providers for select using (status = 'approved' or owner_user_id = auth.uid() or public.is_admin());
drop policy if exists "Providers can insert own profile" on public.providers;
create policy "Providers can insert own profile" on public.providers for insert with check (owner_user_id = auth.uid() or public.is_admin());
drop policy if exists "Providers can update own profile" on public.providers;
create policy "Providers can update own profile" on public.providers for update using (owner_user_id = auth.uid() or public.is_admin());
drop policy if exists "Admin can manage providers" on public.providers;
create policy "Admin can manage providers" on public.providers for all using (public.is_admin()) with check (public.is_admin());

-- PROVIDER SERVICES, AREAS, WORKING HOURS
drop policy if exists "Public can read approved provider services" on public.provider_services;
create policy "Public can read approved provider services" on public.provider_services for select using (exists (select 1 from public.providers p where p.id = provider_id and p.status = 'approved') or public.owns_provider(provider_id) or public.is_admin());
drop policy if exists "Providers can manage own services" on public.provider_services;
create policy "Providers can manage own services" on public.provider_services for all using (public.owns_provider(provider_id) or public.is_admin()) with check (public.owns_provider(provider_id) or public.is_admin());

drop policy if exists "Public can read approved provider areas" on public.provider_areas;
create policy "Public can read approved provider areas" on public.provider_areas for select using (exists (select 1 from public.providers p where p.id = provider_id and p.status = 'approved') or public.owns_provider(provider_id) or public.is_admin());
drop policy if exists "Providers can manage own areas" on public.provider_areas;
create policy "Providers can manage own areas" on public.provider_areas for all using (public.owns_provider(provider_id) or public.is_admin()) with check (public.owns_provider(provider_id) or public.is_admin());

drop policy if exists "Public can read approved provider working hours" on public.working_hours;
create policy "Public can read approved provider working hours" on public.working_hours for select using (exists (select 1 from public.providers p where p.id = provider_id and p.status = 'approved') or public.owns_provider(provider_id) or public.is_admin());
drop policy if exists "Providers can manage own working hours" on public.working_hours;
create policy "Providers can manage own working hours" on public.working_hours for all using (public.owns_provider(provider_id) or public.is_admin()) with check (public.owns_provider(provider_id) or public.is_admin());

-- AGENT CONFIGS
drop policy if exists "Providers can read own agent configs" on public.agent_configs;
create policy "Providers can read own agent configs" on public.agent_configs for select using (public.owns_provider(provider_id) or public.is_admin());
drop policy if exists "Providers can insert own agent configs" on public.agent_configs;
create policy "Providers can insert own agent configs" on public.agent_configs for insert with check (public.owns_provider(provider_id) or public.is_admin());
drop policy if exists "Providers can update own agent configs" on public.agent_configs;
create policy "Providers can update own agent configs" on public.agent_configs for update using (public.owns_provider(provider_id) or public.is_admin());

-- BOOKINGS
drop policy if exists "Providers can view own bookings" on public.bookings;
create policy "Providers can view own bookings" on public.bookings for select using (public.owns_provider(provider_id) or public.is_admin());
drop policy if exists "Providers can update own bookings" on public.bookings;
create policy "Providers can update own bookings" on public.bookings for update using (public.owns_provider(provider_id) or public.is_admin());
drop policy if exists "Admin can manage bookings" on public.bookings;
create policy "Admin can manage bookings" on public.bookings for all using (public.is_admin()) with check (public.is_admin());

-- CALLS & CALL TURNS
drop policy if exists "Providers can read own calls" on public.calls;
create policy "Providers can read own calls" on public.calls for select using (public.owns_provider(provider_id) or public.is_admin());
drop policy if exists "Admin can manage calls" on public.calls;
create policy "Admin can manage calls" on public.calls for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Providers can read own call turns" on public.call_turns;
create policy "Providers can read own call turns" on public.call_turns for select using (exists (select 1 from public.calls c where c.id = call_id and (public.owns_provider(c.provider_id) or public.is_admin())));
drop policy if exists "Admin can manage call turns" on public.call_turns;
create policy "Admin can manage call turns" on public.call_turns for all using (public.is_admin()) with check (public.is_admin());

-- NOTIFICATIONS
drop policy if exists "Providers can read own notifications" on public.notifications;
create policy "Providers can read own notifications" on public.notifications for select using (public.owns_provider(provider_id) or public.is_admin());

-- SAFETY RULES
drop policy if exists "Anyone can read safety rules" on public.safety_rules;
create policy "Anyone can read safety rules" on public.safety_rules for select using (true);
drop policy if exists "Admin can manage safety rules" on public.safety_rules;
create policy "Admin can manage safety rules" on public.safety_rules for all using (public.is_admin()) with check (public.is_admin());

-- SAFETY EVENTS
drop policy if exists "Providers can read own safety events" on public.safety_events;
create policy "Providers can read own safety events" on public.safety_events for select using (exists (select 1 from public.calls c where c.id = call_id and (public.owns_provider(c.provider_id) or public.is_admin())));

-- EVAL RUNS
drop policy if exists "Admin can manage eval runs" on public.eval_runs;
create policy "Admin can manage eval runs" on public.eval_runs for all using (public.is_admin()) with check (public.is_admin());

-- AUDIT LOG
drop policy if exists "Users and admin can insert audit log" on public.audit_log;
create policy "Users and admin can insert audit log" on public.audit_log for insert with check (auth.uid() is not null);
drop policy if exists "Admin can manage audit log" on public.audit_log;
create policy "Admin can manage audit log" on public.audit_log for all using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- 5. SEED DATA (Peshawar Trades, Categories & Issues)
-- =============================================================================

INSERT INTO public.categories (code, name_en, name_ur, name_ps)
VALUES
    ('electrician', 'Electrician', 'الیکٹریشن', 'برقی / الیکٹریشن'),
    ('ups_solar', 'UPS & Solar', 'یو پی ایس اور سولر', 'سولر او یو پی ایس'),
    ('ac_fridge', 'AC & Refrigeration', 'اے سی اور فریج', 'ای سی او یخچالان'),
    ('plumber_gas', 'Plumber & Gas Fitting', 'پلمبر اور گیس فٹنگ', 'نل دوان او ګاز')
ON CONFLICT (code) DO UPDATE SET
    name_en = EXCLUDED.name_en,
    name_ur = EXCLUDED.name_ur,
    name_ps = EXCLUDED.name_ps;

INSERT INTO public.issues (category_code, code, urgency, synonyms)
VALUES
    ('electrician', 'short_circuit', 'EMERGENCY', '{"en":["spark","short circuit","breaker trip"],"ur":["شارٹ سرکٹ","چنگاریاں","دھواں"],"ps":["برېښنا شارټ شوې"],"ur_roman":["short circuit","sparks"]}'::jsonb),
    ('electrician', 'complete_blackout', 'URGENT', '{"en":["blackout","no light","power out"],"ur":["بجلی چلی گئی","لائٹ بند"],"ps":["برېښنا بنده ده"],"ur_roman":["light chali gayi"]}'::jsonb),
    ('electrician', 'fan_repair', 'ROUTINE', '{"en":["ceiling fan","fan fitting"],"ur":["پنکھا لگانا","پنکھا خراب"],"ps":["پککی لګول"],"ur_roman":["pankha kharab"]}'::jsonb),
    ('ups_solar', 'inverter_fault', 'URGENT', '{"en":["inverter fault","red light"],"ur":["انورٹر خراب ہے","یو پی ایس ٹرپ"],"ps":["انورټر ستونزه"],"ur_roman":["inverter kharab"]}'::jsonb),
    ('ups_solar', 'battery_check', 'ROUTINE', '{"en":["battery low","acid check"],"ur":["بیٹری بیک اپ نہیں دے رہی"],"ps":["بیټرۍ ټیټه شوې"],"ur_roman":["battery backup"]}'::jsonb),
    ('ac_fridge', 'ac_gas_leak', 'URGENT', '{"en":["ac not cooling","gas refill"],"ur":["اے سی ٹھنڈا نہیں کر رہا","گیس چارجنگ"],"ps":["یخ نه کوي"],"ur_roman":["ac cooling nahi kar raha"]}'::jsonb),
    ('plumber_gas', 'pipe_burst', 'EMERGENCY', '{"en":["pipe burst","flooding"],"ur":["پائپ پھٹ گیا","سیلاب آ گیا"],"ps":["پایپ شلیدلی"],"ur_roman":["pipe phat gaya"]}'::jsonb),
    ('plumber_gas', 'water_motor', 'URGENT', '{"en":["water pump not working"],"ur":["پانی کی موٹر خراب ہے"],"ps":["د اوبو پمپ کار نه کوي"],"ur_roman":["pani ki motor"]}'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- Safety Rules
INSERT INTO public.safety_rules (code, keywords, message, active)
VALUES
    ('gas_leak', '{"en":["gas leak","gas smell","cylinder leak"],"ur":["گیس لیک","سلنڈر لیک","گیس کی بو"],"ps":["د ګاز بوی","ګاز شلیدلی"],"ur_roman":["gas leak","gas ki boo"]}'::jsonb, '{"en":"Leave the area immediately. Do not switch on any electrical appliances. Call Rescue 1122.","ur":"فوری طور پر علاقہ خالی کریں اور کسی برقی سوئچ کو مت چھوئیں۔ ریسکیو 1122 پر کال کریں۔","ps":"سمدستي سیمه خالي کړئ او برېښنايي سویچونه مه چالان کوئ. ۱۱۲۲ ته زنګ ووهئ."}'::jsonb, true),
    ('electric_spark', '{"en":["electric fire","sparks","burning smell"],"ur":["بجلی کی آگ","چنگاریاں","دھواں"],"ps":["د برېښنا اور","څنګښونه"],"ur_roman":["bijli ki aag","changariyan"]}'::jsonb, '{"en":"DANGER: Do not throw water on electrical fires! Switch off main breaker if safe. Call 1122.","ur":"خطرہ: بجلی کی آگ پر پانی ہرگز نہ پھینکیں! اگر ممکن ہو تو مین بریکر بند کریں اور 1122 کو کال کریں۔","ps":"خطر: په برېښنايي اور هېڅکله اوبه مه اچوئ! ۱۱۲۲ ته زنګ ووهئ."}'::jsonb, true),
    ('pipe_burst', '{"en":["pipe burst","flooding near wiring"],"ur":["پائپ پھٹ گیا","سوئچ بورڈ میں پانی"],"ps":["پایپ شلیدلی"],"ur_roman":["pipe phat gaya"]}'::jsonb, '{"en":"Turn off main water supply valve. Stay away from flooded electrical wiring.","ur":"فوری طور پر مین پانی کا والو بند کریں۔ پانی میں ڈوبی تاروں سے دور رہیں۔","ps":"د اوبو مین والو بند کړئ."}'::jsonb, true),
    ('injury_shock', '{"en":["electric shock","electrocuted","unconscious"],"ur":["کرنٹ لگ گیا","برقی جھٹکا"],"ps":["برېښنا ونیوه"],"ur_roman":["current lag gaya"]}'::jsonb, '{"en":"EMERGENCY: Do not touch victim with bare hands! Disconnect power immediately. Call 1122.","ur":"ایمرجنسی: کرنٹ لگے شخص کو ننگے ہاتھوں سے نہ چھوئیں! فوراً بجلی کا سوئچ بند کریں اور 1122 پر کال کریں۔","ps":"بېړنی حالت: هغه کس په لوڅو لاسونو مه لمس کوئ! ۱۱۲۲ ته زنګ ووهئ."}'::jsonb, true)
ON CONFLICT (code) DO NOTHING;

-- Assign Admin Role to Mubasir Anwar
INSERT INTO public.profiles (user_id, role, full_name, phone)
VALUES ('6e97c381-2642-42b9-bb79-4b9910424d5a', 'admin', 'Mubasir Anwar', '03349256238')
ON CONFLICT (user_id) DO UPDATE SET role = 'admin', full_name = 'Mubasir Anwar';
