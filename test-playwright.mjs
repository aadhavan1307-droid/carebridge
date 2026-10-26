import { chromium } from 'playwright';

async function main() {
  console.log('Testing Playwright Chromium launch...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('http://localhost:3001/api/health');
  const text = await page.textContent('body');
  console.log('Health response via Playwright:', text);
  await browser.close();
  console.log('SUCCESS: Playwright Chromium works cleanly!');
}

main().catch(err => {
  console.error('Playwright launch error:', err);
  process.exit(1);
});
