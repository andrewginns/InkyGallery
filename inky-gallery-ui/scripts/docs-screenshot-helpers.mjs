import { fileURLToPath } from 'node:url';

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function prepareDocsPage(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('inkygallery-theme-preference', 'light');
  });
  await page.emulateMedia({ colorScheme: 'light' });
}

export async function disableMotion(page) {
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
}

export async function capture(page, outputDir, filename) {
  await wait(150);
  await page.screenshot({
    path: fileURLToPath(new URL(filename, outputDir)),
    fullPage: false,
  });
}

export async function seedDocsState(page) {
  return page.evaluate(async () => {
    const specs = [
      {
        samplePath: '/samples/flower.svg',
        filename: 'flower-study.png',
        caption: 'Botanical study',
        favorite: true,
        fit_mode: 'cover',
        background_mode: 'blur',
        background_color: null,
        timeout_seconds_override: null,
        crop: { x: 0.1, y: 0, width: 0.8, height: 1.0 },
      },
      {
        samplePath: '/samples/interior.svg',
        filename: 'reading-room.png',
        caption: 'Quiet reading room',
        favorite: false,
        fit_mode: 'contain',
        background_mode: 'solid',
        background_color: '#efe7da',
        timeout_seconds_override: 180,
        crop: null,
      },
      {
        samplePath: '/samples/landscape.svg',
        filename: 'lake-dusk.png',
        caption: 'Warm dusk over the lake',
        favorite: true,
        fit_mode: 'cover',
        background_mode: 'none',
        background_color: null,
        timeout_seconds_override: 600,
        crop: null,
      },
      {
        samplePath: '/samples/archipelago.svg',
        filename: 'archipelago-evening.png',
        caption: 'Archipelago at golden hour',
        favorite: false,
        fit_mode: 'cover',
        background_mode: 'blur',
        background_color: null,
        timeout_seconds_override: 420,
        crop: null,
      },
      {
        samplePath: '/samples/moonlit-garden.svg',
        filename: 'moonlit-garden.png',
        caption: 'Moonlit conservatory blooms',
        favorite: true,
        fit_mode: 'cover',
        background_mode: 'solid',
        background_color: '#192130',
        timeout_seconds_override: 240,
        crop: { x: 0.14, y: 0.04, width: 0.72, height: 0.9 },
      },
      {
        samplePath: '/samples/record-player.svg',
        filename: 'record-player.png',
        caption: 'Record player still life',
        favorite: false,
        fit_mode: 'contain',
        background_mode: 'solid',
        background_color: '#efe5d8',
        timeout_seconds_override: 150,
        crop: null,
      },
      {
        samplePath: '/samples/gallery-window.svg',
        filename: 'gallery-window.png',
        caption: 'Sunlit gallery window',
        favorite: false,
        fit_mode: 'contain',
        background_mode: 'solid',
        background_color: '#efe6d8',
        timeout_seconds_override: 180,
        crop: null,
      },
      {
        samplePath: '/samples/citrus-study.svg',
        filename: 'citrus-study.png',
        caption: 'Citrus study on vellum',
        favorite: true,
        fit_mode: 'cover',
        background_mode: 'blur',
        background_color: null,
        timeout_seconds_override: 300,
        crop: { x: 0.18, y: 0.1, width: 0.64, height: 0.8 },
      },
      {
        samplePath: '/samples/canyon-posters.svg',
        filename: 'canyon-poster.png',
        caption: 'Canyon poster series',
        favorite: false,
        fit_mode: 'contain',
        background_mode: 'solid',
        background_color: '#f0e6d7',
        timeout_seconds_override: 510,
        crop: null,
      },
      {
        samplePath: '/samples/night-market.svg',
        filename: 'night-market.png',
        caption: 'Night market lights',
        favorite: true,
        fit_mode: 'cover',
        background_mode: 'none',
        background_color: null,
        timeout_seconds_override: 360,
        crop: null,
      },
      {
        samplePath: '/samples/tides.svg',
        filename: 'tides-study.png',
        caption: 'Tidal layers at dusk',
        favorite: false,
        fit_mode: 'cover',
        background_mode: 'blur',
        background_color: null,
        timeout_seconds_override: 210,
        crop: null,
      },
      {
        samplePath: '/samples/quilt.svg',
        filename: 'quilt-study.png',
        caption: 'Warm patchwork geometry',
        favorite: true,
        fit_mode: 'contain',
        background_mode: 'solid',
        background_color: '#f2e9db',
        timeout_seconds_override: 540,
        crop: null,
      },
    ];

    const api = async (input, init) => {
      const response = await fetch(input, init);
      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json')
        ? await response.json()
        : await response.text();
      if (!response.ok) {
        throw new Error(
          typeof payload === 'string'
            ? payload
            : payload?.error || payload?.message || `Request failed with status ${response.status}`
        );
      }
      return payload;
    };

    const listAssets = async () => {
      const items = [];
      let cursor = 0;
      while (cursor !== null) {
        const query = cursor ? `?cursor=${cursor}` : '';
        const data = await api(`/api/assets${query}`);
        items.push(...data.items);
        cursor = data.next_cursor;
      }
      return items;
    };

    const resetLibrary = async () => {
      const existingAssets = await listAssets();
      if (existingAssets.length > 0) {
        await api('/api/assets/bulk-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ asset_ids: existingAssets.map((asset) => asset.id) }),
        });
      }
    };

    const rasterizeSample = async (samplePath, filename) => {
      const sampleResponse = await fetch(samplePath);
      const svg = await sampleResponse.text();
      const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
      const objectUrl = URL.createObjectURL(svgBlob);
      try {
        const image = await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = objectUrl;
        });

        const canvas = document.createElement('canvas');
        canvas.width = 1200;
        canvas.height = 1600;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#f7f2e8';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const frameX = 72;
        const frameY = 92;
        const frameWidth = canvas.width - frameX * 2;
        const frameHeight = canvas.height - 220;
        const scale = Math.min(frameWidth / image.width, frameHeight / image.height);
        const drawWidth = image.width * scale;
        const drawHeight = image.height * scale;
        const drawX = (canvas.width - drawWidth) / 2;
        const drawY = frameY + (frameHeight - drawHeight) / 2;

        ctx.fillStyle = 'rgba(36, 27, 18, 0.08)';
        ctx.fillRect(drawX + 16, drawY + 20, drawWidth, drawHeight);
        ctx.fillStyle = '#fffdf8';
        ctx.fillRect(drawX, drawY, drawWidth, drawHeight);
        ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);

        ctx.fillStyle = 'rgba(36, 27, 18, 0.75)';
        ctx.font = '600 38px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(filename.replace('.png', ''), canvas.width / 2, canvas.height - 88);

        const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        return pngBlob;
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };

    await resetLibrary();

    const createdAssets = [];
    for (const spec of specs) {
      const pngBlob = await rasterizeSample(spec.samplePath, spec.filename);
      const formData = new FormData();
      formData.append('files[]', pngBlob, spec.filename);
      formData.append('duplicate_policy', 'reject');
      formData.append('auto_add_to_queue', 'false');
      const uploadResult = await api('/api/assets', {
        method: 'POST',
        body: formData,
      });
      const createdAsset = uploadResult.created[0];

      const updatedAsset = await api(`/api/assets/${createdAsset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption: spec.caption,
          favorite: spec.favorite,
        }),
      });

      if (spec.crop) {
        await api(`/api/assets/${createdAsset.id}/crop`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(spec.crop),
        });
      }

      createdAssets.push(updatedAsset);
    }

    const queueCreate = await api('/api/queue/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_ids: createdAssets.map((asset) => asset.id) }),
    });

    for (const queueItem of queueCreate.items) {
      const spec = specs.find((item) => item.filename === queueItem.asset.filename_original);
      if (!spec) {
        continue;
      }
      await api(`/api/queue/items/${queueItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fit_mode: spec.fit_mode,
          background_mode: spec.background_mode,
          background_color: spec.background_color,
          timeout_seconds_override: spec.timeout_seconds_override,
        }),
      });
    }

    const queueData = await api('/api/queue');
    const firstQueueItem = queueData.items[0];
    await api('/api/playback/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue_item_id: firstQueueItem.id }),
    });
    await api('/api/playback/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    return {
      assets: await listAssets(),
      queue: (await api('/api/queue')).items,
      playback: (await api('/api/playback')).state,
    };
  });
}
