const { chromium } = require('../web/node_modules/playwright');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const assert = require('assert');

const ARTIFACTS_DIR = 'C:/Users/mubas/.gemini/antigravity/brain/18e5fe81-be7b-4748-812c-dea97424febf';

async function run() {
  console.log('====================================================================');
  console.log('>>> AWAZBOT KP: PROMPT 5 DIRECTORY AGENT & SAFETY VERIFICATION <<<');
  console.log('====================================================================\n');

  console.log('[1/4] Spawning Next.js dev server on http://localhost:3000...');
  const webProc = spawn('npm', ['--prefix', 'web', 'run', 'dev', '--', '-p', '3000'], {
    shell: true,
    stdio: 'inherit',
  });

  console.log('Allowing Next.js dev server to initialize...');
  await new Promise((r) => setTimeout(r, 8000));

  let browser;

  try {
    console.log('[2/4] Launching Playwright Chrome browser...');
    browser = await chromium.launch({
      headless: true,
      channel: 'chrome',
    });

    // -------------------------------------------------------------------------
    // TEST FLOW A: DIRECTORY AGENT SEARCH & HAND-OFF TO KHAN ELECTRIC
    // -------------------------------------------------------------------------
    console.log('\n[3/4] Running Test Flow A: Directory Voice Agent & Provider Hand-off...');
    const contextA = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
    });
    const pageA = await contextA.newPage();

    console.log('- Navigating to Directory Call screen (http://localhost:3000/call/call_demo_directory)...');
    let loaded = false;
    for (let attempt = 1; attempt <= 8; attempt++) {
      try {
        await pageA.goto('http://localhost:3000/call/call_demo_directory', { waitUntil: 'networkidle', timeout: 12000 });
        loaded = true;
        break;
      } catch (e) {
        console.log(`  Waiting for Next.js (attempt ${attempt}/8)...`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    assert(loaded, 'Failed to connect to http://localhost:3000/call/call_demo_directory');

    // Verify Call Interface connected
    await pageA.waitForSelector('text=Dev Mode: Simulated Typed Urdu Turns', { timeout: 15000 });
    console.log('✓ Call interface mounted successfully');

    // Step 1: Send directory search query: "مجھے حیات آباد میں یو پی ایس ٹھیک کروانا ہے کل"
    console.log('- Sending search turn: "مجھے حیات آباد میں یو پی ایس ٹھیک کروانا ہے کل"...');
    const searchBtn = pageA.getByRole('button', { name: /6\. تلاش ڈائرکٹری/i });
    if (await searchBtn.isVisible()) {
      await searchBtn.click();
    } else {
      await pageA.fill('input[placeholder*="Type any message"]', 'مجھے حیات آباد میں یو پی ایس ٹھیک کروانا ہے کل');
      await pageA.click('button:has-text("Send Turn")');
    }

    // Wait for agent reply listing Khan Electric
    await pageA.waitForSelector('text=خان الیکٹرک', { timeout: 10000 });
    console.log('✓ Agent returned provider search results including Khan Electric');

    // Step 2: Send hand-off selection: "پہلا والا"
    console.log('- Sending hand-off turn: "پہلا والا"...');
    const handoffBtn = pageA.getByRole('button', { name: /7\. ہینڈ آف/i });
    if (await handoffBtn.isVisible()) {
      await handoffBtn.click();
    } else {
      await pageA.fill('input[placeholder*="Type any message"]', 'پہلا والا');
      await pageA.click('button:has-text("Send Turn")');
    }

    // Verify session handed off to Khan Electric
    await pageA.waitForSelector('text=Khan Electric', { timeout: 10000 });
    console.log('✓ Hand-off verified! Call session header transitioned to Khan Electric');

    // Complete booking draft turns
    console.log('- Completing booking: Name -> Area -> Time -> Confirmation...');
    await pageA.click('button:has-text("2. نام")');
    await pageA.waitForTimeout(500);
    await pageA.click('button:has-text("3. علاقہ")');
    await pageA.waitForTimeout(500);
    await pageA.click('button:has-text("4. وقت")');
    await pageA.waitForTimeout(500);
    await pageA.click('button:has-text("5. تصدیق")');
    await pageA.waitForTimeout(1000);

    // Capture screenshots of Directory & Hand-off flow
    await pageA.screenshot({
      path: path.join(ARTIFACTS_DIR, 'screenshot_p5_directory_handoff_375px.png'),
      fullPage: true,
    });
    console.log('✓ Captured screenshot_p5_directory_handoff_375px.png');

    // Desktop screenshot
    const deskCtxA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pageDeskA = await deskCtxA.newPage();
    await pageDeskA.goto('http://localhost:3000/call/call_demo_directory', { waitUntil: 'networkidle' });
    await pageDeskA.click('button:has-text("6. تلاش ڈائرکٹری")');
    await pageDeskA.waitForTimeout(400);
    await pageDeskA.click('button:has-text("7. ہینڈ آف")');
    await pageDeskA.waitForTimeout(600);
    await pageDeskA.screenshot({
      path: path.join(ARTIFACTS_DIR, 'screenshot_p5_directory_handoff_1440px.png'),
      fullPage: true,
    });
    console.log('✓ Captured screenshot_p5_directory_handoff_1440px.png');
    await pageDeskA.close();
    await deskCtxA.close();
    await pageA.close();
    await contextA.close();

    // -------------------------------------------------------------------------
    // TEST FLOW B: CRITICAL PRE-LLM EMERGENCY SAFETY GUARD
    // -------------------------------------------------------------------------
    console.log('\n[4/4] Running Test Flow B: Pre-LLM Emergency Safety Guard & Alert Banner...');
    const contextB = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
    });
    const pageB = await contextB.newPage();

    console.log('- Navigating to Provider Call screen (http://localhost:3000/call/call_demo_emergency)...');
    await pageB.goto('http://localhost:3000/call/call_demo_emergency', { waitUntil: 'networkidle' });
    await pageB.waitForSelector('text=Dev Mode: Simulated Typed Urdu Turns', { timeout: 15000 });

    // Trigger Emergency hazard: "میٹر سے چنگاریاں نکل رہی ہیں"
    console.log('- Triggering hazard turn: "میٹر سے چنگاریاں نکل رہی ہیں"...');
    const emergencyBtn = pageB.getByRole('button', { name: /8\. ایمرجنسی/i });
    if (await emergencyBtn.isVisible()) {
      await emergencyBtn.click();
    } else {
      await pageB.fill('input[placeholder*="Type any message"]', 'میٹر سے چنگاریاں نکل رہی ہیں');
      await pageB.click('button:has-text("Send Turn")');
    }

    // Verify Red Emergency Banner Appears
    console.log('- Verifying red emergency banner and safety instruction...');
    await pageB.waitForSelector('text=EMERGENCY HAZARD DETECTED', { timeout: 10000 });
    const hasEmergencyBanner = await pageB.getByText('EMERGENCY HAZARD DETECTED').isVisible();
    const has1122Btn = await pageB.getByRole('link', { name: /Call Rescue 1122/i }).isVisible();
    console.log(`  Emergency Banner visible: ${hasEmergencyBanner}`);
    console.log(`  Rescue 1122 button visible: ${has1122Btn}`);
    assert(hasEmergencyBanner, 'Red emergency banner must be displayed on hazard detection');
    assert(has1122Btn, 'Rescue 1122 call button must be prominent in the emergency banner');

    // Capture Emergency Screenshots
    await pageB.screenshot({
      path: path.join(ARTIFACTS_DIR, 'screenshot_p5_emergency_banner_375px.png'),
      fullPage: true,
    });
    console.log('✓ Captured screenshot_p5_emergency_banner_375px.png');

    // Desktop screenshot of Emergency Alert
    const deskCtxB = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pageDeskB = await deskCtxB.newPage();
    await pageDeskB.goto('http://localhost:3000/call/call_demo_emergency', { waitUntil: 'networkidle' });
    await pageDeskB.click('button:has-text("8. ایمرجنسی")');
    await pageDeskB.waitForTimeout(600);
    await pageDeskB.screenshot({
      path: path.join(ARTIFACTS_DIR, 'screenshot_p5_emergency_banner_1440px.png'),
      fullPage: true,
    });
    console.log('✓ Captured screenshot_p5_emergency_banner_1440px.png');
    await pageDeskB.close();
    await deskCtxB.close();
    await pageB.close();
    await contextB.close();

    await browser.close();

    console.log('\n====================================================================');
    console.log('>>> ALL PROMPT 5 VERIFICATION CHECKS PASSED SUCCESSFULLY! <<<');
    console.log('====================================================================\n');
  } catch (err) {
    console.error('PROMPT 5 VERIFICATION ERROR:', err);
    process.exitCode = 1;
  } finally {
    console.log('Cleaning up server process...');
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
