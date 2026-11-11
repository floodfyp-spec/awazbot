const { chromium } = require('../web/node_modules/playwright');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const ARTIFACTS_DIR = 'C:/Users/mubas/.gemini/antigravity/brain/18e5fe81-be7b-4748-812c-dea97424febf';

async function waitForServer(url, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          if (res.statusCode < 500) resolve();
          else reject(new Error('Status ' + res.statusCode));
        });
        req.on('error', reject);
        req.setTimeout(1500, () => req.destroy());
      });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 600));
    }
  }
  throw new Error(`Timeout waiting for ${url}`);
}

async function run() {
  console.log('Starting Next.js production server for provider portal verification...');
  const server = spawn('npm', ['--prefix', 'web', 'run', 'start', '--', '-p', '3000'], {
    shell: true,
    stdio: 'inherit',
  });

  try {
    await waitForServer('http://localhost:3000/provider/onboarding');
    console.log('Server is responsive! Launching Chrome...');

    const browser = await chromium.launch({
      headless: true,
      channel: 'chrome',
    });

    // 1. Desktop Context (1440px)
    const contextDesktop = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const pageDesktop = await contextDesktop.newPage();

    // Onboarding Step 1 (Desktop)
    console.log('Capturing Onboarding (1440px)...');
    await pageDesktop.goto('http://localhost:3000/provider/onboarding', { waitUntil: 'networkidle' });
    await pageDesktop.waitForTimeout(1000);
    await pageDesktop.screenshot({
      path: path.join(ARTIFACTS_DIR, 'screenshot_p4_onboarding_1440px.png'),
      fullPage: true,
    });

    // Onboarding Step 1 (Mobile 375px)
    console.log('Capturing Onboarding (375px)...');
    const contextMobile = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
    });
    const pageMobile = await contextMobile.newPage();
    await pageMobile.goto('http://localhost:3000/provider/onboarding', { waitUntil: 'networkidle' });
    await pageMobile.waitForTimeout(1000);
    await pageMobile.screenshot({
      path: path.join(ARTIFACTS_DIR, 'screenshot_p4_onboarding_375px.png'),
      fullPage: true,
    });

    // Provider Agent Config (Desktop)
    console.log('Capturing Provider Agent Config (1440px)...');
    await pageDesktop.goto('http://localhost:3000/provider/agent', { waitUntil: 'networkidle' });
    await pageDesktop.waitForTimeout(1000);
    await pageDesktop.screenshot({
      path: path.join(ARTIFACTS_DIR, 'screenshot_p4_agent_config_1440px.png'),
      fullPage: true,
    });

    // Provider Agent Test (Desktop)
    console.log('Capturing Provider Agent Test (1440px)...');
    await pageDesktop.goto('http://localhost:3000/provider/agent/test', { waitUntil: 'networkidle' });
    await pageDesktop.waitForTimeout(1000);
    await pageDesktop.screenshot({
      path: path.join(ARTIFACTS_DIR, 'screenshot_p4_agent_test_1440px.png'),
      fullPage: true,
    });

    // Provider Bookings (Desktop)
    console.log('Capturing Provider Bookings (1440px)...');
    await pageDesktop.goto('http://localhost:3000/provider/bookings', { waitUntil: 'networkidle' });
    await pageDesktop.waitForTimeout(1000);
    await pageDesktop.screenshot({
      path: path.join(ARTIFACTS_DIR, 'screenshot_p4_bookings_1440px.png'),
      fullPage: true,
    });

    // Provider Services (Desktop)
    console.log('Capturing Provider Services (1440px)...');
    await pageDesktop.goto('http://localhost:3000/provider/services', { waitUntil: 'networkidle' });
    await pageDesktop.waitForTimeout(1000);
    await pageDesktop.screenshot({
      path: path.join(ARTIFACTS_DIR, 'screenshot_p4_services_1440px.png'),
      fullPage: true,
    });

    // Provider Settings (Desktop)
    console.log('Capturing Provider Settings (1440px)...');
    await pageDesktop.goto('http://localhost:3000/provider/settings', { waitUntil: 'networkidle' });
    await pageDesktop.waitForTimeout(1000);
    await pageDesktop.screenshot({
      path: path.join(ARTIFACTS_DIR, 'screenshot_p4_settings_1440px.png'),
      fullPage: true,
    });

    await browser.close();
    console.log('All provider screenshots captured successfully!');
  } finally {
    console.log('Stopping Next.js server...');
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', server.pid.toString(), '/f', '/t']);
    } else {
      server.kill();
    }
  }
}

run().catch((err) => {
  console.error('Screenshot script error:', err);
  process.exit(1);
});
