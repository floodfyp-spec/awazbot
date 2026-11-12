-- AwazBot KP Migration 0002: Admin RLS Write Policies
-- Ensures admins can write to eval_runs, audit_log, and execute full management across all entities.

-- Eval Runs: allow admins and backend scripts to insert and manage evaluation results
create policy "Admin can manage eval runs"
    on public.eval_runs for all
    using (public.is_admin())
    with check (public.is_admin());

-- Audit Log: allow authenticated users and admins to insert audit events
create policy "Users and admin can insert audit log"
    on public.audit_log for insert
    with check (auth.uid() is not null);

create policy "Admin can manage audit log"
    on public.audit_log for all
    using (public.is_admin())
    with check (public.is_admin());

-- Calls & Call Turns: ensure admin can insert/update/delete
create policy "Admin can manage calls"
    on public.calls for all
    using (public.is_admin())
    with check (public.is_admin());

create policy "Admin can manage call turns"
    on public.call_turns for all
    using (public.is_admin())
    with check (public.is_admin());

-- Bookings: ensure admin can manage all bookings
create policy "Admin can manage bookings"
    on public.bookings for all
    using (public.is_admin())
    with check (public.is_admin());
