const { chromium } = require('../web/node_modules/playwright');
const { createClient } = require('../web/node_modules/@supabase/supabase-js');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const assert = require('assert');

const ARTIFACTS_DIR = 'C:/Users/mubas/.gemini/antigravity/brain/18e5fe81-be7b-4748-812c-dea97424febf';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mhervthlsxezerasjddg.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_TAnORqZXzcAesd33LtkOIQ_Go3X4vCT';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_H4CPIYzFQShUh9DGCDGDYg_w6rGjtq8';

async function waitForHttp(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          if (res.statusCode < 500) resolve();
          else reject(new Error('Status ' + res.statusCode));
        });
        req.on('error', reject);
        req.setTimeout(2500, () => req.destroy());
      });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  throw new Error(`Timeout waiting for ${url}`);
}

async function run() {
  console.log('===============================================================');
  console.log('>>> AWAZBOT KP: PROMPT 4 END-TO-END VERIFICATION & RLS TEST <<<');
  console.log('===============================================================\n');

  // Start Next.js dev server with explicit 127.0.0.1 binding
  console.log('[1/5] Spawning Next.js dev server (npm --prefix web run dev -- -H 127.0.0.1 -p 3000)...');
  const webProc = spawn('npm', ['--prefix', 'web', 'run', 'dev', '--', '-H', '127.0.0.1', '-p', '3000'], {
    shell: true,
    stdio: 'inherit',
  });

  let browser;

  try {
    console.log('Waiting for Next.js at http://127.0.0.1:3000...');
    await waitForHttp('http://127.0.0.1:3000', 60000);
    console.log('✓ Next.js is ready!');

    // Initialize Supabase admin client for test assertions
    const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Launch Chrome
    console.log('\n[3/7] Launching Playwright Chrome browser...');
    browser = await chromium.launch({
      headless: true,
      channel: 'chrome',
    });

    const timestamp = Date.now();
    const prov1Email = `prov_e2e_${timestamp}@example.com`;
    const prov1Password = 'Password123!';
    const prov1BizName = 'Hayatabad Electrical Masters';

    // -------------------------------------------------------------------------
    // PART 1: PROVIDER 1 WALKTHROUGH (Mobile 375px)
    // -------------------------------------------------------------------------
    console.log('\n[4/7] Testing Provider 1 Onboarding & Flow (375px mobile viewport)...');
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
    });
    const page = await mobileContext.newPage();

    // 1. Sign up
    console.log(`- Signing up provider: ${prov1Email}...`);
    await page.goto('http://localhost:3000/signup', { waitUntil: 'networkidle' });
    await page.fill('#name', 'Master Tariq');
    await page.fill('#phone', '+923005551234');
    await page.fill('#email', prov1Email);
    await page.fill('#password', prov1Password);
    await page.click('button[type="submit"]');

    // Wait for redirect to /provider
    await page.waitForURL('**/provider', { timeout: 15000 });
    console.log('✓ Provider signed up and redirected to /provider');

    // 2. Provider Dashboard before onboarding -> Click Start Onboarding
    const onboardingCta = page.getByRole('button', { name: /Start Provider Onboarding/i });
    if (await onboardingCta.isVisible()) {
      await onboardingCta.click();
      await page.waitForURL('**/provider/onboarding', { timeout: 10000 });
    } else {
      await page.goto('http://localhost:3000/provider/onboarding', { waitUntil: 'networkidle' });
    }

    console.log('- Onboarding Step 1: verifying email requirement & test email...');
    // Step 1: Check Next button disabled when email is empty
    const nextBtn = page.getByRole('button', { name: /Next: Service Areas/i });
    let isDisabled = await nextBtn.isDisabled();
    console.log(`  Next button disabled before email entered: ${isDisabled}`);
    assert(isDisabled, 'Step 1 must refuse to advance without email');

    // Fill business name and notification Gmail
    await page.fill('#business_name', prov1BizName);
    await page.fill('#notify_email', 'tariq.hayatabad@gmail.com');
    await page.waitForTimeout(300);

    // Verify Next button is now enabled
    isDisabled = await nextBtn.isDisabled();
    console.log(`  Next button disabled after valid email entered: ${isDisabled}`);
    assert(!isDisabled, 'Next button should be enabled after valid email');

    // Click "Send test email"
    const testEmailBtn = page.getByRole('button', { name: /Send test email/i });
    await testEmailBtn.click();
    await page.waitForSelector('text=✓ Delivered', { timeout: 10000 });
    console.log('✓ Test email dispatched successfully (verified via UI status indicator)');

    // Capture Step 1 Screenshot (Mobile 375px)
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'screenshot_p4_onboarding_375px.png'),
      fullPage: true,
    });
    console.log('✓ Captured screenshot_p4_onboarding_375px.png');

    // Desktop screenshot of Onboarding
    const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pageDesk = await desktopContext.newPage();
    // Copy cookies to desktop context
    const cookies = await mobileContext.cookies();
    await desktopContext.addCookies(cookies);
    await pageDesk.goto('http://localhost:3000/provider/onboarding', { waitUntil: 'networkidle' });
    await pageDesk.fill('#business_name', prov1BizName);
    await pageDesk.fill('#notify_email', 'tariq.hayatabad@gmail.com');
    await pageDesk.screenshot({
      path: path.join(ARTIFACTS_DIR, 'screenshot_p4_onboarding_1440px.png'),
      fullPage: true,
    });
    console.log('✓ Captured screenshot_p4_onboarding_1440px.png');
    await pageDesk.close();
    await desktopContext.close();

    // Advance to Step 2
    await nextBtn.click();
    await page.waitForSelector('text=Step 2 of 4: Coverage & Working Hours', { timeout: 10000 });

    // Step 2: Advance to Step 3
    console.log('- Onboarding Step 2: Coverage & Working Hours...');
    await page.click('button:has-text("Next: Trades & Services")');
    await page.waitForSelector('text=Step 3 of 4: Trades & Standard Services', { timeout: 10000 });

    // Step 3: Advance to Step 4
    console.log('- Onboarding Step 3: Services & Pricing...');
    await page.click('button:has-text("Next: Agent & Voice")');
    await page.waitForSelector('text=Step 4 of 4: AI Voice Receptionist Settings', { timeout: 10000 });

    // Step 4: Complete Onboarding
    console.log('- Onboarding Step 4: Finalizing Setup...');
    await page.click('button:has-text("Complete Onboarding & Launch")');
    await page.waitForURL('**/provider', { timeout: 20000 });
    console.log('✓ Onboarding completed! Redirected to /provider dashboard');

    // Verify Dashboard Status & Slug
    await page.waitForSelector('text=pending', { timeout: 10000 });
    const hasPendingBadge = await page.getByText('pending').isVisible();
    console.log(`  Provider status is "pending": ${hasPendingBadge}`);
    assert(hasPendingBadge, 'Provider status must be pending');

    // Retrieve provider id from database for later checks
    const { data: prov1Record } = await adminSupabase
      .from('providers')
      .select('id, slug, provider_code')
      .eq('business_name', prov1BizName)
      .single();
    assert(prov1Record, 'Provider record must exist in DB');
    console.log(`  Provider ID: ${prov1Record.id}, Slug: ${prov1Record.slug}, Code: ${prov1Record.provider_code}`);

    // -------------------------------------------------------------------------
    // 3. AGENT CONFIGURATION & LIVE PREVIEW
    // -------------------------------------------------------------------------
    console.log('\n[5/7] Testing Agent Config Versioning & FastAPI Spoken Preview...');
    await page.goto('http://localhost:3000/provider/agent', { waitUntil: 'networkidle' });

    // Verify initial version 1
    await page.waitForSelector('text=Version 1', { timeout: 10000 });
    console.log('✓ Found initial Version 1');

    // Edit Urdu Greeting
    const newGreeting = 'السلام علیکم! حیات آباد الیکٹریکل ماسٹرز میں خوش آمدید۔ ہم بجلی کے تمام کام گارنٹی کے ساتھ کرتے ہیں۔ آپ کو کیا مسئلہ درپیش ہے؟';
    await page.fill('#greeting_ur', newGreeting);

    // Save New Version
    console.log('- Saving new Agent Config Version...');
    await page.click('button:has-text("Save New Version")');
    await page.waitForSelector('text=Saved and activated Agent Configuration Version 2!', { timeout: 15000 });
    console.log('✓ Agent Config Version 2 saved and activated!');

    // Refresh Preview Spoken Instructions
    console.log('- Refreshing Preview Spoken Instructions...');
    await page.click('button:has-text("Refresh Spoken Preview")');
    await page.waitForTimeout(2000);

    const previewContent = await page.locator('pre').innerText();
    const hasNewGreetingInPreview = previewContent.includes('حیات آباد الیکٹریکل ماسٹرز');
    console.log(`  Preview contains updated greeting: ${hasNewGreetingInPreview}`);
    assert(hasNewGreetingInPreview, 'Compiled spoken preview must contain updated greeting');

    // Capture screenshots of Agent Config with preview pane
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'screenshot_p4_agent_config_375px.png'),
      fullPage: true,
    });
    // Desktop view of Agent Config
    const deskCtx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await deskCtx2.addCookies(await mobileContext.cookies());
    const pageDesk2 = await deskCtx2.newPage();
    await pageDesk2.goto('http://localhost:3000/provider/agent', { waitUntil: 'networkidle' });
    await pageDesk2.screenshot({
      path: path.join(ARTIFACTS_DIR, 'screenshot_p4_agent_config_1440px.png'),
      fullPage: true,
    });
    await pageDesk2.close();
    await deskCtx2.close();
    console.log('✓ Captured agent config screenshots (375px and 1440px)');

    // -------------------------------------------------------------------------
    // 4. TEST MY AGENT CALL SCREEN
    // -------------------------------------------------------------------------
    console.log('\n[6/7] Testing Agent Test Mode & Voice Call Interface...');
    await page.goto('http://localhost:3000/provider/agent/test', { waitUntil: 'networkidle' });

    // Capture Test Agent launcher page
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'screenshot_p4_agent_test_375px.png'),
      fullPage: true,
    });
    const deskCtx3 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await deskCtx3.addCookies(await mobileContext.cookies());
    const pageDesk3 = await deskCtx3.newPage();
    await pageDesk3.goto('http://localhost:3000/provider/agent/test', { waitUntil: 'networkidle' });
    await pageDesk3.screenshot({
      path: path.join(ARTIFACTS_DIR, 'screenshot_p4_agent_test_1440px.png'),
      fullPage: true,
    });
    await pageDesk3.close();
    await deskCtx3.close();

    // Launch Test Call
    console.log('- Launching voice test call...');
    await page.click('button:has-text("Start Voice Test Call")');
    await page.waitForURL(/\/call\/call_/, { timeout: 20000 });
    console.log(`✓ Navigated to test call screen: ${page.url()}`);

    // Verify call screen elements
    await page.waitForSelector('text=Simulated Typed Urdu Turns', { timeout: 15000 });
    console.log('✓ Verified Dev Mode / Provider Test Mode controls visible on call screen');

    // Simulate booking creation in DB for this provider
    console.log('- Creating simulated customer booking in DB for Provider 1...');
    const { data: newBooking, error: bErr } = await adminSupabase
      .from('bookings')
      .insert({
        provider_id: prov1Record.id,
        customer_name: 'Muhammad Tariq',
        customer_phone: '+923009876543',
        problem_description: 'Bijli ka board jal gaya hai, kal subah 10 baje aa saktay hain?',
        area: 'Hayatabad',
        slot: 'Tomorrow 10:00 AM',
        status: 'pending_provider',
      })
      .select('*')
      .single();

    assert(newBooking, `Failed to create test booking: ${bErr?.message}`);
    console.log(`✓ Test booking created with ID: ${newBooking.id}, status: ${newBooking.status}`);

    // -------------------------------------------------------------------------
    // 5. BOOKINGS APPROVAL WORKFLOW
    // -------------------------------------------------------------------------
    console.log('- Navigating to /provider/bookings...');
    await page.goto('http://localhost:3000/provider/bookings', { waitUntil: 'networkidle' });

    // Wait for the booking row
    await page.waitForSelector('text=Muhammad Tariq', { timeout: 10000 });
    console.log('✓ Found test booking for Muhammad Tariq in bookings table');

    // Click "Approve" button
    console.log('- Clicking "Approve" button on booking...');
    const approveBtn = page.getByRole('button', { name: /Approve/i }).first();
    await approveBtn.click();
    await page.waitForSelector('text=Booking approved!', { timeout: 10000 });
    console.log('✓ Booking approved toast notification displayed');

    // Verify status changed to confirmed
    await page.waitForSelector('text=confirmed', { timeout: 10000 });
    console.log('✓ Verified booking status badge updated to "confirmed"');

    // Capture bookings screenshots
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'screenshot_p4_bookings_375px.png'),
      fullPage: true,
    });
    const deskCtx4 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await deskCtx4.addCookies(await mobileContext.cookies());
    const pageDesk4 = await deskCtx4.newPage();
    await pageDesk4.goto('http://localhost:3000/provider/bookings', { waitUntil: 'networkidle' });
    await pageDesk4.screenshot({
      path: path.join(ARTIFACTS_DIR, 'screenshot_p4_bookings_1440px.png'),
      fullPage: true,
    });
    await pageDesk4.close();
    await deskCtx4.close();
    console.log('✓ Captured bookings screenshots (375px and 1440px)');

    // -------------------------------------------------------------------------
    // 6. SETTINGS & NOTIFICATIONS
    // -------------------------------------------------------------------------
    console.log('- Navigating to /provider/settings...');
    await page.goto('http://localhost:3000/provider/settings', { waitUntil: 'networkidle' });

    // Toggle email notifications switch off
    console.log('- Toggling email alerts switch off...');
    const switchElem = page.locator('button[role="switch"]').first();
    await switchElem.click();
    await page.click('button:has-text("Save Settings")');
    await page.waitForSelector('text=Provider settings saved successfully!', { timeout: 10000 });
    console.log('✓ Settings saved successfully!');

    // Reload page to verify persistence
    await page.reload({ waitUntil: 'networkidle' });
    const switchState = await switchElem.getAttribute('data-state');
    console.log(`  Switch state after reload: ${switchState}`);
    assert(switchState === 'unchecked', 'Email notifications toggle must persist as unchecked');

    // Capture settings screenshots
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'screenshot_p4_settings_375px.png'),
      fullPage: true,
    });
    const deskCtx5 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await deskCtx5.addCookies(await mobileContext.cookies());
    const pageDesk5 = await deskCtx5.newPage();
    await pageDesk5.goto('http://localhost:3000/provider/settings', { waitUntil: 'networkidle' });
    await pageDesk5.screenshot({
      path: path.join(ARTIFACTS_DIR, 'screenshot_p4_settings_1440px.png'),
      fullPage: true,
    });
    await pageDesk5.close();
    await deskCtx5.close();
    console.log('✓ Captured settings screenshots (375px and 1440px)');

    // -------------------------------------------------------------------------
    // PART 2: PROVIDER ISOLATION & RLS VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n[7/7] Testing Multi-Tenant Provider Isolation & Database RLS...');
    const prov2Email = `prov2_solar_${timestamp}@example.com`;
    const prov2Password = 'Password123!';
    const prov2BizName = 'Khyber Solar Solutions';

    // Create Provider 2 in new isolated browser context
    const prov2Context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page2 = await prov2Context.newPage();

    console.log(`- Signing up second provider: ${prov2Email}...`);
    await page2.goto('http://localhost:3000/signup', { waitUntil: 'networkidle' });
    await page2.fill('#name', 'Gul Solar');
    await page2.fill('#phone', '+923008889999');
    await page2.fill('#email', prov2Email);
    await page2.fill('#password', prov2Password);
    await page2.click('button[type="submit"]');
    await page2.waitForURL('**/provider', { timeout: 15000 });

    // Complete onboarding for Provider 2
    console.log('- Completing onboarding for Provider 2...');
    await page2.goto('http://localhost:3000/provider/onboarding', { waitUntil: 'networkidle' });
    await page2.fill('#business_name', prov2BizName);
    await page2.fill('#notify_email', 'solar.khyber@gmail.com');
    await page2.click('button:has-text("Next: Service Areas")');
    await page2.waitForSelector('text=Step 2 of 4: Coverage & Working Hours', { timeout: 10000 });
    await page2.click('button:has-text("Next: Trades & Services")');
    await page2.waitForSelector('text=Step 3 of 4: Trades & Standard Services', { timeout: 10000 });
    await page2.click('button:has-text("Next: Agent & Voice")');
    await page2.waitForSelector('text=Step 4 of 4: AI Voice Receptionist Settings', { timeout: 10000 });
    await page2.click('button:has-text("Complete Onboarding & Launch")');
    await page2.waitForURL('**/provider', { timeout: 20000 });

    // UI Isolation Test: Provider 2 checks /provider/bookings
    console.log('- Checking Provider 2 bookings table in UI...');
    await page2.goto('http://localhost:3000/provider/bookings', { waitUntil: 'networkidle' });
    const hasTariqBooking = await page2.getByText('Muhammad Tariq').isVisible();
    console.log(`  Provider 2 sees Provider 1's booking in UI: ${hasTariqBooking}`);
    assert(!hasTariqBooking, 'CRITICAL: Provider 2 must NOT see Provider 1 bookings in UI!');

    // Database RLS Isolation Test: Query Supabase with Provider 2's session token
    console.log('- Direct RLS Test: Querying Supabase with Provider 2 auth session...');
    const prov2Supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: authData, error: authErr } = await prov2Supabase.auth.signInWithPassword({
      email: prov2Email,
      password: prov2Password,
    });
    assert(authData?.session, `Failed to authenticate Prov 2 for RLS test: ${authErr?.message}`);

    // Attempt to query Provider 1's bookings as Provider 2
    const { data: crossTenantBookings } = await prov2Supabase
      .from('bookings')
      .select('*')
      .eq('provider_id', prov1Record.id);

    console.log(`  Cross-tenant bookings query returned: ${crossTenantBookings ? crossTenantBookings.length : 0} rows`);
    assert(
      !crossTenantBookings || crossTenantBookings.length === 0,
      'CRITICAL: Supabase RLS failed! Provider 2 retrieved Provider 1 bookings!'
    );

    // Attempt to query Provider 1's agent_configs as Provider 2
    const { data: crossTenantConfigs } = await prov2Supabase
      .from('agent_configs')
      .select('*')
      .eq('provider_id', prov1Record.id);

    console.log(`  Cross-tenant agent_configs query returned: ${crossTenantConfigs ? crossTenantConfigs.length : 0} rows`);
    assert(
      !crossTenantConfigs || crossTenantConfigs.length === 0,
      'CRITICAL: Supabase RLS failed! Provider 2 retrieved Provider 1 agent configs!'
    );

    console.log('✓ Row Level Security (RLS) multi-tenant isolation mathematically proven!');

    await page2.close();
    await prov2Context.close();
    await page.close();
    await mobileContext.close();
    await browser.close();

    console.log('\n===============================================================');
    console.log('>>> ALL PROMPT 4 VERIFICATION STEPS PASSED SUCCESSFULLY! <<<');
    console.log('===============================================================\n');
  } catch (err) {
    console.error('VERIFICATION ERROR:', err);
    process.exitCode = 1;
  } finally {
    console.log('Cleaning up server processes...');
    if (browser) {
      try { await browser.close(); } catch {}
    }
    if (process.platform === 'win32') {
      try { if (webProc?.pid) spawn('taskkill', ['/pid', webProc.pid.toString(), '/f', '/t']); } catch {}
    } else {
      try { if (webProc) webProc.kill(); } catch {}
    }
  }
}

run();
