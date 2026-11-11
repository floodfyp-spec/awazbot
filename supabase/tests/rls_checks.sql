-- =============================================================================
-- AwazBot KP — RLS Policies Verification Tests
-- =============================================================================
-- Run this test suite in the Supabase SQL Editor to verify RLS enforcement.
-- =============================================================================

BEGIN;

-- Setup temporary mock test users in auth.users
-- Note: Replace with real UIDs if running outside a test transaction.
DO $$
DECLARE
    v_admin_id UUID := 'a0000000-0000-0000-0000-000000000001';
    v_prov1_id UUID := 'a0000000-0000-0000-0000-000000000002';
    v_prov2_id UUID := 'a0000000-0000-0000-0000-000000000003';
    v_provider_a_id UUID := 'b0000000-0000-0000-0000-000000000001';
    v_provider_b_id UUID := 'b0000000-0000-0000-0000-000000000002';
    v_booking_a_id UUID := 'b1111111-0000-0000-0000-000000000001';
    v_booking_b_id UUID := 'b1111111-0000-0000-0000-000000000002';
    v_count INT;
BEGIN
    RAISE NOTICE '>>> STARTING RLS VERIFICATION TESTS <<<';

    -- 1. Create mock profiles
    INSERT INTO profiles (id, role, full_name, phone)
    VALUES
        (v_admin_id, 'admin', 'Super Admin', '03000000001'),
        (v_prov1_id, 'provider', 'Provider One Owner', '03000000002'),
        (v_prov2_id, 'provider', 'Provider Two Owner', '03000000003')
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

    -- 2. Create mock providers
    INSERT INTO providers (id, owner_user_id, name, slug, provider_code, trades, primary_phone, notify_email, areas, status)
    VALUES
        (v_provider_a_id, v_prov1_id, 'Provider Alpha', 'provider-alpha', 'ALPH-01', ARRAY['electrician'], '03001111111', 'alpha@example.com', ARRAY['Hayatabad'], 'approved'),
        (v_provider_b_id, v_prov2_id, 'Provider Beta', 'provider-beta', 'BETA-02', ARRAY['plumber_gas'], '03002222222', 'beta@example.com', ARRAY['Saddar'], 'approved')
    ON CONFLICT (id) DO UPDATE SET owner_user_id = EXCLUDED.owner_user_id;

    -- 3. Create mock bookings
    INSERT INTO bookings (id, provider_id, customer_name, customer_phone, category_id, problem_description, area, urgency, status)
    VALUES
        (v_booking_a_id, v_provider_a_id, 'Customer A', '03001230001', 'electrician', 'Alpha repair issue', 'Hayatabad', 'ROUTINE', 'pending'),
        (v_booking_b_id, v_provider_b_id, 'Customer B', '03001230002', 'plumber_gas', 'Beta pipe burst', 'Saddar', 'EMERGENCY', 'pending')
    ON CONFLICT (id) DO NOTHING;

    -- -------------------------------------------------------------------------
    -- TEST 1: Anonymous User Permissions
    -- -------------------------------------------------------------------------
    -- Set role to anon (unauthenticated)
    PERFORM set_config('role', 'anon', true);
    PERFORM set_config('request.jwt.claims', '{}', true);

    -- Anon can read approved providers
    SELECT COUNT(*) INTO v_count FROM providers WHERE status = 'approved';
    IF v_count >= 2 THEN
        RAISE NOTICE 'PASS [Anon Providers]: Anon can view approved providers (found %)', v_count;
    ELSE
        RAISE EXCEPTION 'FAIL [Anon Providers]: Anon could not view approved providers';
    END IF;

    -- Anon CANNOT read bookings (RLS returns 0 rows)
    SELECT COUNT(*) INTO v_count FROM bookings;
    IF v_count = 0 THEN
        RAISE NOTICE 'PASS [Anon Bookings]: Anon cannot read bookings (found 0 rows)';
    ELSE
        RAISE EXCEPTION 'FAIL [Anon Bookings]: Anon read % bookings!', v_count;
    END IF;

    -- Anon CANNOT read calls
    SELECT COUNT(*) INTO v_count FROM calls;
    IF v_count = 0 THEN
        RAISE NOTICE 'PASS [Anon Calls]: Anon cannot read calls (found 0 rows)';
    ELSE
        RAISE EXCEPTION 'FAIL [Anon Calls]: Anon read % calls!', v_count;
    END IF;

    -- -------------------------------------------------------------------------
    -- TEST 2: Provider One Permissions & Isolation
    -- -------------------------------------------------------------------------
    -- Set role to authenticated as Provider One
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_prov1_id::text, 'role', 'authenticated')::text, true);

    -- Provider One can read their own bookings
    SELECT COUNT(*) INTO v_count FROM bookings WHERE provider_id = v_provider_a_id;
    IF v_count = 1 THEN
        RAISE NOTICE 'PASS [Provider Isolation]: Provider One can view their own booking';
    ELSE
        RAISE EXCEPTION 'FAIL [Provider Isolation]: Provider One cannot view their booking';
    END IF;

    -- Provider One CANNOT read Provider Two's bookings
    SELECT COUNT(*) INTO v_count FROM bookings WHERE provider_id = v_provider_b_id;
    IF v_count = 0 THEN
        RAISE NOTICE 'PASS [Provider Isolation]: Provider One CANNOT view Provider Two bookings (found 0 rows)';
    ELSE
        RAISE EXCEPTION 'FAIL [Provider Isolation]: Provider One accessed Provider Two booking!';
    END IF;

    -- -------------------------------------------------------------------------
    -- TEST 3: Admin Permissions
    -- -------------------------------------------------------------------------
    -- Set role to authenticated as Admin
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_id::text, 'role', 'authenticated')::text, true);

    -- Admin can read all bookings across all providers
    SELECT COUNT(*) INTO v_count FROM bookings WHERE id IN (v_booking_a_id, v_booking_b_id);
    IF v_count = 2 THEN
        RAISE NOTICE 'PASS [Admin Access]: Admin can read all bookings across providers (found %)', v_count;
    ELSE
        RAISE EXCEPTION 'FAIL [Admin Access]: Admin was blocked from reading all bookings (found %)', v_count;
    END IF;

    RAISE NOTICE '>>> ALL RLS CHECKS PASSED SUCCESSFULLY <<<';
END $$;

ROLLBACK; -- Always rollback test state cleanly
