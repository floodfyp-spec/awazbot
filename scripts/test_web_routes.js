const { spawn } = require('child_process');
const http = require('http');

function fetchUrl(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      resolve({ status: res.statusCode, error: null });
    }).on('error', (err) => {
      resolve({ status: null, error: err.message });
    });
  });
}

async function waitForServer(url, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetchUrl(url);
    if (res.status && res.status < 500) {
      return true;
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

async function run() {
  console.log('Starting Next.js dev server...');
  const dev = spawn('node', ['node_modules/next/dist/bin/next', 'dev', '-p', '3000'], {
    cwd: 'D:\\AwazBot-kp\\web',
    stdio: 'inherit',
    shell: true,
  });

  try {
    const ready = await waitForServer('http://localhost:3000');
    if (!ready) {
      console.error('Next.js server failed to respond within timeout');
      process.exit(1);
    }
    console.log('Next.js dev server is READY.');

    const routes = [
      'http://localhost:3000',
      'http://localhost:3000/services',
      'http://localhost:3000/p/khan-electric',
      'http://localhost:3000/p/khyber-solar-ups',
      'http://localhost:3000/call/call_demo_directory',
      'http://localhost:3000/login',
      'http://localhost:3000/signup',
      'http://localhost:3000/admin',
    ];

    console.log('\n--- Testing Web Routes ---');
    for (const route of routes) {
      const res = await fetchUrl(route);
      const pass = res.status >= 200 && res.status < 400;
      console.log(`[${pass ? '✓ PASS' : '✗ FAIL'}] Status ${res.status} -> ${route}`);
    }
    console.log('--------------------------\n');
  } finally {
    console.log('Stopping dev server...');
    dev.kill();
  }
}

run();
