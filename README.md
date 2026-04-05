# InkyGallery

InkyGallery is a local-network image library and playback controller for Inky e-ink displays.

The repo currently contains:

- a Python backend with asset upload, queue management, playback state, and Inky rendering support
- a mobile-first React/Vite frontend first pass
- product and UI specification docs
- Playwright screenshot capture for the current frontend

## Attribution

This project is inspired by [InkyPi](https://github.com/fatihak/InkyPi).

In particular, the original InkyPi project informed the overall device/display workflow, and parts of the backend image-loading and Inky hardware communication path in this repo were copied or adapted from that codebase.

## Current state

### Backend

Implemented:

- JSON-backed device settings bootstrap
- SQLite-backed assets, queue items, playback settings, and playback state
- media storage for originals, thumbnails, and the current rendered image
- JSON APIs for:
  - assets
  - queue
  - playback
  - device settings
  - display status
- duplicate upload detection by checksum with configurable duplicate handling
- Inky-only display path with optional hardware skip for non-hardware runs

Current backend tests:

```bash
uv run pytest -q
```

### Frontend

The frontend lives in `inky-gallery-ui/`.

It is a mobile-first React/Vite app that currently demonstrates the target UX using mock data and local sample assets. It is not yet wired to the Python backend API.

Implemented in the first pass:

- now playing view
- library view
- queue management view
- settings view
- production build
- Playwright mobile screenshot capture

Current frontend build:

```bash
cd inky-gallery-ui
pnpm build
```

## Running the backend

Entrypoint:

- `run.py`

Environment notes:

- `INKY_SKIP_HARDWARE=1`
  - skips physical Inky initialization and still writes `current_image.png`
- `PORT`
  - defaults to `8080`
- `DEBUG=1`
  - enables Flask debug mode

Install backend dependencies:

```bash
uv sync
```

Run without physical hardware:

```bash
INKY_SKIP_HARDWARE=1 uv run python run.py
```

Run on a real Inky device:

```bash
uv sync --extra hardware
uv run python run.py
```

## Running the frontend

Install frontend dependencies:

```bash
cd inky-gallery-ui
pnpm install
```

Run the frontend dev server:

```bash
pnpm dev
```

Build the frontend:

```bash
pnpm build
```

Preview the production build:

```bash
pnpm preview
```

## Screenshots

Mobile screenshots for the current frontend are in:

- `inky-gallery-ui/docs/screenshots/mobile-430x932/`

Regenerate them with:

```bash
cd inky-gallery-ui
pnpm build
pnpm preview -- --host 127.0.0.1 --port 4173
SCREENSHOT_URL=http://127.0.0.1:4173 node scripts/capture-mobile-screenshots.mjs
```

## Repository layout

- `docs/backend-image-library-spec.md`
  - backend architecture and implementation plan
- `docs/ui-designer-spec.md`
  - designer-facing UI requirements
- `src/api/`
  - JSON API blueprints
- `src/services/`
  - device, assets, queue, display, and playback logic
- `src/repositories/`
  - SQLite data access
- `src/storage/`
  - database bootstrap and media storage
- `src/display/`
  - Inky display integration
- `src/utils/`
  - copied and adapted image helpers
- `inky-gallery-ui/src/`
  - frontend app source
- `inky-gallery-ui/scripts/`
  - Playwright screenshot capture

## Dependency management

### Backend

The backend uses `uv`.

- base dependencies are in `pyproject.toml`
- locked versions are in `uv.lock`
- Raspberry Pi / display-specific packages are behind the `hardware` extra

### Frontend

The frontend uses `pnpm`.

- frontend dependencies are in `inky-gallery-ui/package.json`
- locked versions are in `inky-gallery-ui/pnpm-lock.yaml`
