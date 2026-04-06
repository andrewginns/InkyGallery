import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { capture, disableMotion, prepareDocsPage, seedDocsState } from './docs-screenshot-helpers.mjs';

const baseUrl = process.env.SCREENSHOT_URL ?? 'http://127.0.0.1:8090';
const outputDir = new URL('../../docs/readme/', import.meta.url);
const appIconPath = fileURLToPath(new URL('../../src/static/images/InkyGallery_icon.png', import.meta.url));

function buildReadmeShowcase() {
  const nowPlayingPath = fileURLToPath(new URL('now-playing.png', outputDir));
  const libraryPath = fileURLToPath(new URL('library.png', outputDir));
  const queuePath = fileURLToPath(new URL('queue.png', outputDir));
  const settingsPath = fileURLToPath(new URL('settings.png', outputDir));
  const showcasePath = fileURLToPath(new URL('showcase.png', outputDir));
  const fontPath = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
  const radius = 26;
  const roundedAlpha = `if(lte(pow(max(${radius}-X,0)+max(X-(W-${radius + 1}),0),2)+pow(max(${radius}-Y,0)+max(Y-(H-${radius + 1}),0),2),pow(${radius},2)),255,0)`;
  const showcaseFilter = [
    'color=c=0xf4ebdc:s=1292x520[bg]',
    'color=c=0xfffaf2:s=194x420[loading]',
    '[4:v]scale=94:-1[icon]',
    '[loading][icon]overlay=(W-w)/2:118[loading-icon]',
    `[loading-icon]drawtext=fontfile=${fontPath}:text='InkyGallery':fontcolor=0x2d2926:fontsize=24:x=(w-text_w)/2:y=266[loading-text]`,
    "[loading-text]pad=iw+18:ih+18:9:9:color=0xfffaf2[cardload-base]",
    `[cardload-base]format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='${roundedAlpha}'[cardload]`,
    "[0:v]scale=-1:420,pad=iw+18:ih+18:9:9:color=0xfffaf2[card0-base]",
    `[card0-base]format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='${roundedAlpha}'[card0]`,
    "[1:v]scale=-1:420,pad=iw+18:ih+18:9:9:color=0xfffaf2[card1-base]",
    `[card1-base]format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='${roundedAlpha}'[card1]`,
    "[2:v]scale=-1:420,pad=iw+18:ih+18:9:9:color=0xfffaf2[card2-base]",
    `[card2-base]format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='${roundedAlpha}'[card2]`,
    "[3:v]scale=-1:420,pad=iw+18:ih+18:9:9:color=0xfffaf2[card3-base]",
    `[card3-base]format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='${roundedAlpha}'[card3]`,
    '[cardload][card0][card1][card2][card3]xstack=inputs=5:layout=0_0|w0+28_0|w0+w1+56_0|w0+w1+w2+84_0|w0+w1+w2+w3+112_0[row]',
    '[bg][row]overlay=(W-w)/2:(H-h)/2,format=rgb24[out]',
  ].join(';');

  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      nowPlayingPath,
      '-i',
      libraryPath,
      '-i',
      queuePath,
      '-i',
      settingsPath,
      '-i',
      appIconPath,
      '-filter_complex',
      showcaseFilter,
      '-map',
      '[out]',
      '-frames:v',
      '1',
      showcasePath,
    ],
    { stdio: 'inherit' },
  );
}

await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
await prepareDocsPage(page);

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
buildReadmeShowcase();

console.log(`Saved README screenshots to ${fileURLToPath(outputDir)}`);
