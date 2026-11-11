const { chromium } = require('playwright');
const path = require('path');

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
  });

  const page = await context.newPage();

  // 1. Login page
  console.log('Capturing /login at 375px...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(__dirname, '..', 'screenshot_login_375px.png'), fullPage: false });

  // 2. Signup page
  console.log('Capturing /signup at 375px...');
  await page.goto('http://localhost:3000/signup', { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(__dirname, '..', 'screenshot_signup_375px.png'), fullPage: false });

  // 3. Header English
  console.log('Capturing English header at 375px...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(__dirname, '..', 'screenshot_header_en_375px.png'), fullPage: false });

  // 4. Header Urdu (RTL)
  console.log('Capturing Urdu RTL header at 375px...');
  await context.addCookies([
    {
      name: 'awaz_lang',
      value: 'ur',
      domain: 'localhost',
      path: '/',
    },
  ]);
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(__dirname, '..', 'screenshot_header_ur_375px.png'), fullPage: false });

  await browser.close();
  console.log('All screenshots captured successfully!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
