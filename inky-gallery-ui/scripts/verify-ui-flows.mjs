import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { disableMotion, seedDocsState, wait } from './docs-screenshot-helpers.mjs';

const baseUrl = process.env.SCREENSHOT_URL ?? 'http://127.0.0.1:8090';
const viewport = { width: 430, height: 932 };

async function verifySystemTheme(browser) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'light',
  });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('#bottom-nav');

  const themeState = await page.evaluate(() => ({
    preference: document.documentElement.dataset.themePreference,
    hasDarkClass: document.documentElement.classList.contains('dark'),
    themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
  }));

  assert.equal(themeState.preference, 'system');
  assert.equal(themeState.hasDarkClass, false);
  assert.equal(themeState.themeColor, '#f6efe5');

  await context.close();
}

async function verifyThemePersistence(browser) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'light',
  });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('#bottom-nav');
  await page.locator('#tab-settings').click();
  await page.waitForSelector('#select-theme');
  await page.locator('#select-theme').click();
  await page.getByRole('option', { name: 'Dark' }).click();
  await wait(150);

  let themeState = await page.evaluate(() => ({
    hasDarkClass: document.documentElement.classList.contains('dark'),
    themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
  }));
  assert.equal(themeState.hasDarkClass, true);
  assert.equal(themeState.themeColor, '#141417');

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#bottom-nav');

  themeState = await page.evaluate(() => ({
    preference: document.documentElement.dataset.themePreference,
    hasDarkClass: document.documentElement.classList.contains('dark'),
  }));
  assert.equal(themeState.preference, 'dark');
  assert.equal(themeState.hasDarkClass, true);

  await page.locator('#tab-settings').click();
  await page.waitForSelector('#select-theme');
  await page.locator('#select-theme').click();
  await page.getByRole('option', { name: 'System' }).click();
  await context.close();
}

async function verifyCriticalFlows(browser) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'light',
  });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('#bottom-nav');
  await disableMotion(page);

  const seeded = await seedDocsState(page);
  const [, secondQueueItem] = seeded.queue;
  const [firstAsset] = seeded.assets;

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#bottom-nav');

  await page
    .locator('button')
    .filter({ hasText: secondQueueItem.asset.filename_original })
    .first()
    .click();
  await page.getByText('Preview — not yet live').waitFor();
  await page.getByRole('button', { name: /^Apply$/ }).click();
  await page.getByText('Rendering to device…').waitFor();

  await page.locator('#tab-library').click();
  await page.waitForSelector('#library-search');
  await page.locator(`#asset-${firstAsset.id}`).click();
  await page.waitForSelector('#detail-apply-now');
  await page.getByRole('button', { name: /Edit crop/i }).click();
  const cropDialogTitle = page.getByRole('heading', { name: 'Edit crop' });
  await cropDialogTitle.waitFor();
  await page.getByRole('button', { name: 'Save crop' }).waitFor();
  await page.locator('[role="dialog"]').last().getByRole('button', { name: /close/i }).click();
  await cropDialogTitle.waitFor({ state: 'hidden' });

  await context.close();
}

const browser = await chromium.launch({ headless: true });

try {
  await verifySystemTheme(browser);
  await verifyThemePersistence(browser);
  await verifyCriticalFlows(browser);
  console.log('UI verification passed');
} finally {
  await browser.close();
}
