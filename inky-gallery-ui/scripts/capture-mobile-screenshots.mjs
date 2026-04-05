import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.SCREENSHOT_URL ?? 'http://localhost:4173';
const outputDir = path.resolve('docs/screenshots/mobile-430x932');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

// Stabilize motion for reproducible screenshots.
await page.addStyleTag({
  content: `
    *,
    *::before,
    *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
      scroll-behavior: auto !important;
      caret-color: transparent !important;
    }
  `,
});

const capture = async (filename) => {
  await wait(150);
  await page.screenshot({
    path: path.join(outputDir, filename),
    fullPage: false,
  });
};

await capture('01-now-playing-live.png');

await page.locator('#tab-library').click();
await page.waitForSelector('#library-search');
await capture('02-library-grid.png');

await page.locator('#asset-ast_01').click();
await page.waitForSelector('#detail-preview');
await capture('03-library-detail.png');

await page.locator('#detail-preview').click();
await page.waitForSelector('text=Preview — not yet live');
await capture('04-now-playing-preview.png');

await page.locator('#tab-library').click();
await page.waitForSelector('#btn-upload');
await page.locator('#btn-upload').click();
await page.waitForSelector('#btn-upload-submit');
await capture('05-library-upload-dialog.png');

await page.getByRole('button', { name: 'Close' }).click();
await page.locator('#tab-queue').click();
await page.waitForSelector('#queue-item-qi_01');
await capture('06-queue-list.png');

await page.evaluate(() => {
  const buttons = document.querySelectorAll('#queue-item-qi_01 button');
  if (buttons.length < 3) {
    throw new Error(`Expected queue item action buttons, found ${buttons.length}`);
  }
  buttons[2].click();
});
await page.waitForSelector('text=Queue item settings');
await capture('07-queue-item-settings.png');

await page.getByRole('button', { name: 'Close' }).click();
await page.locator('#tab-settings').click();
await page.waitForSelector('#select-orientation');
await capture('08-settings-top.png');

await page.getByText('Image Enhancement').scrollIntoViewIfNeeded();
await capture('09-settings-image-enhancement.png');

await browser.close();

console.log(`Saved screenshots to ${outputDir}`);
