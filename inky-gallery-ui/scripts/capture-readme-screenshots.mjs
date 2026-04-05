import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.SCREENSHOT_URL ?? 'http://127.0.0.1:4173';
const outputDir = path.resolve('..', 'docs', 'readme');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const assets = [
  {
    id: 'ast_01',
    filename_original: 'landscape.svg',
    width: 1200,
    height: 800,
    file_size_bytes: 128_000,
    mime_type: 'image/svg+xml',
    favorite: true,
    caption: 'Warm dusk over the lake',
    created_at: '2026-04-01T08:30:00Z',
    thumbnail_url: '/samples/landscape.svg',
    original_url: '/samples/landscape.svg',
  },
  {
    id: 'ast_02',
    filename_original: 'flower.svg',
    width: 1200,
    height: 1200,
    file_size_bytes: 96_000,
    mime_type: 'image/svg+xml',
    favorite: true,
    caption: 'Botanical study',
    created_at: '2026-04-02T14:15:00Z',
    thumbnail_url: '/samples/flower.svg',
    original_url: '/samples/flower.svg',
  },
  {
    id: 'ast_03',
    filename_original: 'interior.svg',
    width: 1200,
    height: 900,
    file_size_bytes: 101_000,
    mime_type: 'image/svg+xml',
    favorite: false,
    caption: 'Quiet reading room',
    created_at: '2026-04-03T10:00:00Z',
    thumbnail_url: '/samples/interior.svg',
    original_url: '/samples/interior.svg',
  },
];

const queue = [
  {
    id: 'qi_01',
    asset_id: 'ast_02',
    position: 0,
    enabled: true,
    timeout_seconds_override: null,
    fit_mode: 'contain',
    background_mode: 'blur',
    background_color: null,
    asset: {
      id: 'ast_02',
      filename_original: 'flower.svg',
      thumbnail_url: '/samples/flower.svg',
      original_url: '/samples/flower.svg',
    },
  },
  {
    id: 'qi_02',
    asset_id: 'ast_01',
    position: 1,
    enabled: true,
    timeout_seconds_override: 180,
    fit_mode: 'cover',
    background_mode: 'none',
    background_color: null,
    asset: {
      id: 'ast_01',
      filename_original: 'landscape.svg',
      thumbnail_url: '/samples/landscape.svg',
      original_url: '/samples/landscape.svg',
    },
  },
  {
    id: 'qi_03',
    asset_id: 'ast_03',
    position: 2,
    enabled: true,
    timeout_seconds_override: 600,
    fit_mode: 'contain',
    background_mode: 'solid',
    background_color: '#efe7da',
    asset: {
      id: 'ast_03',
      filename_original: 'interior.svg',
      thumbnail_url: '/samples/interior.svg',
      original_url: '/samples/interior.svg',
    },
  },
];

const playbackSettings = {
  default_timeout_seconds: 300,
  loop_enabled: true,
  shuffle_enabled: false,
  auto_advance_enabled: true,
  queue_sort_mode: 'manual',
};

const playbackPayload = {
  settings: playbackSettings,
  state: {
    mode: 'displaying',
    active_queue_item_id: 'qi_01',
    active_asset_id: 'ast_02',
    preview_queue_item_id: null,
    preview_asset_id: null,
    display_started_at: '2026-04-05T13:30:00Z',
    display_expires_at: '2026-04-05T13:35:00Z',
    current_image_url: '/samples/flower.svg',
    last_rendered_url: '/samples/flower.svg',
    last_image_hash: 'readme-mock-image',
    last_rendered_at: '2026-04-05T13:30:00Z',
    time_remaining_seconds: 254,
  },
  active_item: queue[0],
  preview_item: null,
};

const deviceSettings = {
  name: 'InkyGallery',
  resolution: [800, 480],
  orientation: 'horizontal',
  inverted_image: false,
  timezone: 'UTC',
  time_format: '24h',
  log_system_stats: false,
  image_settings: {
    saturation: 1.0,
    contrast: 1.0,
    sharpness: 1.0,
    brightness: 1.0,
    inky_saturation: 0.5,
  },
};

const displayStatus = {
  resolution: [800, 480],
  orientation: 'horizontal',
  active_asset_id: 'ast_02',
  preview_asset_id: null,
  mode: 'displaying',
  current_image_url: '/samples/flower.svg',
  current_image_hash: 'readme-mock-image',
  last_rendered_at: '2026-04-05T13:30:00Z',
  default_timeout_seconds: 300,
  time_remaining_seconds: 254,
  hardware: {
    display_type: 'inky',
    hardware_enabled: true,
    hardware_ready: true,
    detected_model: 'Inky Impression 7.3"',
    detected_resolution: [800, 480],
    init_error: null,
    current_image_path: '/tmp/current_image.png',
    current_image_exists: true,
  },
};

const routeJson = async (route, payload) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });
};

await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});

const page = await context.newPage();

await page.route('**/api/assets', async (route) => {
  if (route.request().method() === 'GET') {
    return routeJson(route, { items: assets });
  }
  return route.fulfill({ status: 204, body: '' });
});

await page.route('**/api/queue', async (route) => {
  if (route.request().method() === 'GET') {
    return routeJson(route, { items: queue });
  }
  return route.fulfill({ status: 204, body: '' });
});

await page.route('**/api/playback', async (route) => {
  if (route.request().method() === 'GET') {
    return routeJson(route, playbackPayload);
  }
  return route.fulfill({ status: 204, body: '' });
});

await page.route('**/api/device/settings', async (route) => {
  if (route.request().method() === 'GET') {
    return routeJson(route, deviceSettings);
  }
  return route.fulfill({ status: 204, body: '' });
});

await page.route('**/api/display/status', async (route) => {
  if (route.request().method() === 'GET') {
    return routeJson(route, displayStatus);
  }
  return route.fulfill({ status: 204, body: '' });
});

await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.waitForSelector('#bottom-nav');

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

await capture('now-playing.png');

await page.locator('#tab-library').click();
await page.waitForSelector('#library-search');
await capture('library.png');

await page.locator('#tab-queue').click();
await page.waitForSelector('#queue-item-qi_01');
await capture('queue.png');

await page.locator('#tab-settings').click();
await page.waitForSelector('#select-orientation');
await capture('settings.png');

await browser.close();

console.log(`Saved README screenshots to ${outputDir}`);
