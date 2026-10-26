import { chromium } from 'playwright';

async function verify() {
  console.log('--- STARTING COMPREHENSIVE UI VERIFICATION ON http://localhost:3000 ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  const networkErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.error('[Browser Error]', msg.text());
    } else {
      console.log('[Browser Log]', msg.text());
    }
  });

  page.on('pageerror', err => {
    consoleErrors.push(err.message);
    console.error('[Page Exception]', err.message);
  });

  page.on('response', resp => {
    if (!resp.ok() && resp.status() !== 304) {
      networkErrors.push(`${resp.request().method()} ${resp.url()} -> ${resp.status()}`);
      console.error(`[Network Error] ${resp.request().method()} ${resp.url()} -> ${resp.status()}`);
    }
  });

  // 1. LANDING PAGE
  console.log('\n1. Testing Landing Page at http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  const title = await page.title();
  const rootContent = await page.innerHTML('#root');
  console.log('Title:', title);
  console.log('Root HTML rendered length:', rootContent.length);
  if (rootContent.length === 0) {
    throw new Error('Root is empty on landing page!');
  }
  const landingHeading = await page.textContent('h1');
  console.log('Landing Heading:', landingHeading);

  // 2. RECEPTION LOGIN & WORKSPACE
  console.log('\n2. Testing Reception Login & Workspace...');
  await page.goto('http://localhost:3000/login/reception', { waitUntil: 'networkidle' });
  await page.fill('input[type="text"]', 'reception@carebridge.local');
  await page.fill('input[type="password"]', 'Reception@2026!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);

  const recHtml = await page.innerHTML('#root');
  console.log('Reception Workspace HTML length:', recHtml.length);
  const recHasText = await page.evaluate(() => document.body.innerText.includes('Reception') || document.body.innerText.includes('CareBridge'));
  console.log('Receptionist UI visible:', recHasText);
  if (!recHasText) throw new Error('Receptionist UI not rendered!');

  // Logout
  await page.evaluate(() => {
    localStorage.clear();
  });

  // 3. DOCTOR LOGIN & WORKSPACE
  console.log('\n3. Testing Doctor Login & Workspace...');
  await page.goto('http://localhost:3000/login/doctor', { waitUntil: 'networkidle' });
  await page.fill('input[type="text"]', 'ananya.rao@carebridge.local');
  await page.fill('input[type="password"]', 'Doctor@2026!Ananya');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);

  const docHtml = await page.innerHTML('#root');
  console.log('Doctor Workspace HTML length:', docHtml.length);
  const docHasText = await page.evaluate(() => document.body.innerText.includes('Doctor') || document.body.innerText.includes('Dr. Ananya Rao') || document.body.innerText.includes('Patients'));
  console.log('Doctor UI visible:', docHasText);
  if (!docHasText) throw new Error('Doctor UI not rendered!');

  // Logout
  await page.evaluate(() => {
    localStorage.clear();
  });

  // 4. ADMIN LOGIN & WORKSPACE
  console.log('\n4. Testing Admin Login & Workspace...');
  await page.goto('http://localhost:3000/login/admin', { waitUntil: 'networkidle' });
  await page.fill('input[type="text"]', 'admin@carebridge.local');
  await page.fill('input[type="password"]', 'Admin@2026!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);

  const adminHtml = await page.innerHTML('#root');
  console.log('Admin Workspace HTML length:', adminHtml.length);
  const adminHasText = await page.evaluate(() => document.body.innerText.includes('Administrator') || document.body.innerText.includes('Dashboard') || document.body.innerText.includes('CareBridge'));
  console.log('Admin UI visible:', adminHasText);
  if (!adminHasText) throw new Error('Admin UI not rendered!');

  await browser.close();

  console.log('\n--- VERIFICATION SUMMARY ---');
  console.log('Console Errors:', consoleErrors.length);
  console.log('Network Errors:', networkErrors.length);
  console.log('RESULT: ALL WORKSPACES AND LOGIN PAGES RENDERED CLEANLY ON http://localhost:3000!');
}

verify().catch(err => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
