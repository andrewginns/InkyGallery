import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { capture, disableMotion, seedDocsState, wait } from './docs-screenshot-helpers.mjs';

const baseUrl = process.env.SCREENSHOT_URL ?? 'http://127.0.0.1:8090';
const outputDir = new URL('../docs/screenshots/mobile-430x932/', import.meta.url);

await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();

await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.waitForSelector('#bottom-nav');
await disableMotion(page);

const seeded = await seedDocsState(page);
const [liveQueueItem, secondQueueItem] = seeded.queue;
const [firstAsset, secondAsset] = seeded.assets;

await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('#bottom-nav');

await capture(page, outputDir, '01-now-playing-live.png');

await page.locator('#tab-library').click();
await page.waitForSelector('#library-search');
await capture(page, outputDir, '02-library-grid.png');

await page.locator(`#asset-${firstAsset.id}`).click();
await page.waitForSelector('#detail-apply-now');
await capture(page, outputDir, '03-library-detail.png');

await page.getByRole('button', { name: /close/i }).click();
await page.locator('#tab-now-playing').click();
await page.waitForSelector('#bottom-nav');
await page
  .locator('button')
  .filter({ hasText: secondQueueItem.asset.filename_original })
  .first()
  .click();
await page.waitForSelector('text=Preview — not yet live');
await capture(page, outputDir, '04-now-playing-preview.png');

await page.locator('#tab-library').click();
await page.waitForSelector('#btn-upload');
await page.locator('#btn-upload').click();
await page.waitForSelector('#btn-upload-submit');
await capture(page, outputDir, '05-library-upload-dialog.png');

await page.getByRole('button', { name: /close/i }).click();
await page.locator('#tab-queue').click();
await page.waitForSelector(`#queue-item-${liveQueueItem.id}`);
await capture(page, outputDir, '06-queue-list.png');

await page.locator(`#queue-item-${secondQueueItem.id}-settings`).click();
await page.waitForSelector('text=Queue item settings');
await capture(page, outputDir, '07-queue-item-settings.png');

await page.getByRole('button', { name: /close/i }).click();
await page.locator('#tab-settings').click();
await page.waitForSelector('#toggle-invert');
await capture(page, outputDir, '08-settings-top.png');

await page.getByText('Image Enhancement').scrollIntoViewIfNeeded();
await wait(100);
await capture(page, outputDir, '09-settings-image-enhancement.png');

await browser.close();

console.log(`Saved screenshots to ${fileURLToPath(outputDir)}`);
