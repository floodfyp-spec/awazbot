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
  console.log('Starting Next.js production server for call screen verification...');
  const server = spawn('npm', ['--prefix', 'web', 'run', 'start', '--', '-p', '3000'], {
    shell: true,
    stdio: 'inherit',
  });

  try {
    await waitForServer('http://localhost:3000/call/call_demo_khan_electric');
    console.log('Server is responsive! Launching headless browser...');

    const browser = await chromium.launch({
      headless: true,
      channel: 'chrome',
    });

    // 1. Desktop Viewport (1440px)
    const contextDesktop = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const pageDesktop = await contextDesktop.newPage();
    console.log('Navigating to call screen (1440px)...');
    await pageDesktop.goto('http://localhost:3000/call/call_demo_khan_electric', {
      waitUntil: 'networkidle',
    });
    await pageDesktop.waitForTimeout(1500);

    const desktopPath = path.join(ARTIFACTS_DIR, 'screenshot_p3_call_1440px.png');
    await pageDesktop.screenshot({ path: desktopPath, fullPage: true });
    console.log('Captured desktop screenshot ->', desktopPath);

    // 2. Mobile Viewport (375px)
    const contextMobile = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
    });
    const pageMobile = await contextMobile.newPage();
    console.log('Navigating to call screen (375px)...');
    await pageMobile.goto('http://localhost:3000/call/call_demo_khan_electric', {
      waitUntil: 'networkidle',
    });
    await pageMobile.waitForTimeout(1500);

    const mobilePath = path.join(ARTIFACTS_DIR, 'screenshot_p3_call_375px.png');
    await pageMobile.screenshot({ path: mobilePath, fullPage: true });
    console.log('Captured mobile screenshot ->', mobilePath);

    // 3. Test Dev Mode Simulated Urdu Turn
    console.log('Testing interactive simulated turn in UI...');
    const quickBtn = pageDesktop.locator('button:has-text("1. مسئلہ")');
    if (await quickBtn.count() > 0) {
      await quickBtn.first().click();
      await pageDesktop.waitForTimeout(800);
      const simulatedPath = path.join(ARTIFACTS_DIR, 'screenshot_p3_call_simulated_turn.png');
      await pageDesktop.screenshot({ path: simulatedPath, fullPage: true });
      console.log('Captured simulated turn screenshot ->', simulatedPath);
    }

    await browser.close();
    console.log('All screenshots captured successfully!');
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
