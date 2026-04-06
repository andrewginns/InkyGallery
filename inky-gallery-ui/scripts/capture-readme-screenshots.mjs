import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { capture, disableMotion, seedDocsState } from './docs-screenshot-helpers.mjs';

const baseUrl = process.env.SCREENSHOT_URL ?? 'http://127.0.0.1:8090';
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outputDir = new URL('../../docs/readme/', import.meta.url);

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

await seedDocsState(page);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('#bottom-nav');

await capture(page, outputDir, 'now-playing.png');

await page.locator('#tab-library').click();
await page.waitForSelector('#library-search');
await capture(page, outputDir, 'library.png');

await page.locator('#tab-queue').click();
await page.waitForSelector('[id^="queue-item-"]');
await capture(page, outputDir, 'queue.png');

await page.locator('#tab-settings').click();
await page.waitForSelector('#toggle-invert');
await capture(page, outputDir, 'settings.png');

await browser.close();

console.log(`Saved README screenshots to ${fileURLToPath(outputDir)}`);
