const { chromium } = require('../web/node_modules/playwright');
const path = require('path');
const assert = require('assert');

const ROOT_DIR = path.resolve(__dirname, '..');

async function run() {
  console.log('>>> Starting Automated Browser Walkthrough for Prompt 2 <<<');

  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  // ---------------------------------------------------------------------------
  // 1. MOBILE 375px ENGLISH WALKTHROUGH
  // ---------------------------------------------------------------------------
  console.log('\n[1/4] Running Mobile (375px) English Walkthrough...');
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
  });
  const page = await mobileContext.newPage();

  // Step 1: Home
  console.log('Visiting Home (http://localhost:3000)...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(ROOT_DIR, 'screenshot_p2_home_375px_en.png') });

  // Step 2: /services filtered to "electrician, Hayatabad"
  console.log('Visiting /services?trade=electrician&area=Hayatabad...');
  await page.goto('http://localhost:3000/services?trade=electrician&area=Hayatabad', { waitUntil: 'networkidle' });
  const hasKhanElectric = await page.getByText('Khan Electric').isVisible();
  console.log(`Khan Electric card visible in filtered directory: ${hasKhanElectric}`);
  assert(hasKhanElectric, 'Khan Electric should be visible in filtered services list');
  await page.screenshot({ path: path.join(ROOT_DIR, 'screenshot_p2_services_375px_en.png') });

  // Step 3: Khan Electric Profile
  console.log('Visiting /p/khan-electric...');
  await page.goto('http://localhost:3000/p/khan-electric', { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(ROOT_DIR, 'screenshot_p2_profile_375px_en.png') });

  // Verify WhatsApp Link contains text=KHAN-01
  const waLink = await page.locator('a[href*="wa.me"]').getAttribute('href');
  console.log(`WhatsApp Link: ${waLink}`);
  assert(waLink && waLink.includes('text=KHAN-01'), 'WhatsApp link must include text=KHAN-01');

  // Step 4: Click "Call AI Agent" button and intercept response
  console.log('Clicking "Call AI Agent" button on profile...');
  let interceptedCallResponse = null;
  page.on('response', async (response) => {
    if (response.url().includes('/api/calls/web') && response.request().method() === 'POST') {
      interceptedCallResponse = {
        status: response.status(),
        data: await response.json(),
      };
    }
  });

  const callBtn = page.getByRole('button', { name: /Call AI Agent/i }).first();
  await callBtn.click();

  // Wait for navigation to /call/call_...
  await page.waitForURL(/\/call\/call_/, { timeout: 15000 });
  console.log(`Successfully navigated to: ${page.url()}`);
  assert(interceptedCallResponse, 'Network response for POST /api/calls/web was not intercepted');
  assert.strictEqual(interceptedCallResponse.status, 200, 'POST /api/calls/web should return 200');
  assert(interceptedCallResponse.data.token, 'LiveKit token must be present');
  assert(interceptedCallResponse.data.roomName, 'Room name must be present');
  console.log(`Verified LiveKit token generation for room: ${interceptedCallResponse.data.roomName} (Token Length: ${interceptedCallResponse.data.token.length} chars)`);

  await page.screenshot({ path: path.join(ROOT_DIR, 'screenshot_p2_call_375px_en.png') });

  // Step 5: Booking Status Page check
  console.log('Checking /booking/b1111111-0000-0000-0000-000000000001...');
  await page.goto('http://localhost:3000/booking/b1111111-0000-0000-0000-000000000001', { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(ROOT_DIR, 'screenshot_p2_booking_375px.png') });

  await mobileContext.close();

  // ---------------------------------------------------------------------------
  // 2. DESKTOP 1440px ENGLISH WALKTHROUGH
  // ---------------------------------------------------------------------------
  console.log('\n[2/4] Running Desktop (1440px) English Walkthrough...');
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const desktopPage = await desktopContext.newPage();

  await desktopPage.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await desktopPage.screenshot({ path: path.join(ROOT_DIR, 'screenshot_p2_home_1440px_en.png') });

  await desktopPage.goto('http://localhost:3000/services?trade=electrician&area=Hayatabad', { waitUntil: 'networkidle' });
  await desktopPage.screenshot({ path: path.join(ROOT_DIR, 'screenshot_p2_services_1440px_en.png') });

  await desktopPage.goto('http://localhost:3000/p/khan-electric', { waitUntil: 'networkidle' });
  await desktopPage.screenshot({ path: path.join(ROOT_DIR, 'screenshot_p2_profile_1440px_en.png') });

  await desktopContext.close();

  // ---------------------------------------------------------------------------
  // 3. URDU (RTL) WALKTHROUGH
  // ---------------------------------------------------------------------------
  console.log('\n[3/4] Running Urdu (RTL) Walkthrough...');
  const urduContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    extraHTTPHeaders: {
      Cookie: 'awaz_lang=ur',
    },
  });
  const urduPage = await urduContext.newPage();

  await urduPage.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await urduPage.screenshot({ path: path.join(ROOT_DIR, 'screenshot_p2_home_375px_ur.png') });

  await urduPage.goto('http://localhost:3000/services?trade=electrician&area=Hayatabad', { waitUntil: 'networkidle' });
  await urduPage.screenshot({ path: path.join(ROOT_DIR, 'screenshot_p2_services_375px_ur.png') });

  await urduPage.goto('http://localhost:3000/p/khan-electric', { waitUntil: 'networkidle' });
  await urduPage.screenshot({ path: path.join(ROOT_DIR, 'screenshot_p2_profile_375px_ur.png') });

  await urduContext.close();

  // Desktop Urdu
  const urduDesktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    extraHTTPHeaders: {
      Cookie: 'awaz_lang=ur',
    },
  });
  const urduDesktopPage = await urduDesktopContext.newPage();
  await urduDesktopPage.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await urduDesktopPage.screenshot({ path: path.join(ROOT_DIR, 'screenshot_p2_home_1440px_ur.png') });
  await urduDesktopContext.close();

  await browser.close();
  console.log('\n>>> ALL WALKTHROUGH TESTS PASSED WITH 100% SUCCESS <<<');
}

run().catch((err) => {
  console.error('Walkthrough failed:', err);
  process.exit(1);
});
