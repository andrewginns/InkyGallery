# Backend Architecture Overview

This repo ships a single-process Python backend that serves both the JSON API and the built frontend for a local-network Inky display controller.

## Runtime Model

- Flask app entrypoint in [src/app.py](/home/ubuntu/projects/InkyGallery/src/app.py)
- Frontend served from the built app directory, normally `src/static/app`
- JSON APIs under `/api/*`
- No auth or user model
- Trusted-host checks for local/private hosts
- Cross-site browser mutations rejected for API write routes

## Persistence

Current default runtime paths:

- database: `src/data/inkygallery.db`
- device settings: `src/config/device.json`
- rendered device image: `src/static/images/current_image.png`
- uploaded originals and thumbnails under `src/data/media`

Primary storage split:

- SQLite for assets, queue items, playback settings, playback state, and crop profiles
- JSON for device settings
- filesystem for original files, thumbnails, and the current rendered image

## Core Domains

### Assets

Implemented in the asset service and repository layer.

Supports:

- multi-file upload
- duplicate detection by SHA-256
- duplicate policies:
  - `reject`
  - `reuse_existing`
  - `keep_both`
- caption updates
- favorites
- thumbnails
- bulk delete
- persisted crop profiles

Limits:

- max upload size per file: `20 MiB`
- max image size: `32` megapixels

### Queue

Supports:

- add assets to queue
- apply-now insertion for immediate display
- enabled/disabled items
- manual reorder
- server-side sort modes
- per-item timeout override
- per-item fit/background settings

### Playback

Supports:

- preview without rendering
- apply preview to the device
- apply an asset immediately from the library
- next / previous
- pause / resume
- auto-advance
- rerender active item after crop edits

Important semantics:

- Preview changes UI state only.
- Apply triggers a real device render.
- Live playback continues independently of browsing.

### Device Settings

Supports:

- invert image
- timezone
- time format
- log system stats
- image enhancement settings

Preserved defaults:

- `brightness: 1.0`
- `contrast: 1.0`
- `sharpness: 1.0`
- `saturation: 1.0`
- `inky_saturation: 0.5`

The product currently assumes portrait display usage.

## Crop Persistence

Crop editing is implemented and persisted per asset.

Current behavior:

- crop profiles are stored in SQLite
- crops are normalized and reapplied when the asset is rendered in `cover` mode
- `contain` mode does not depend on the saved crop
- saving a crop affects all future renders of that asset
- live images can be rerendered after a crop change without changing queue order

## Rendering Pipeline

The backend keeps the Inky-specific render path and hardware communication in Python.

Current flow:

1. Resolve the active or selected asset
2. Apply saved crop when relevant
3. Fit or contain the image for the device
4. Apply device-level image enhancement settings
5. Write `current_image.png`
6. Send the rendered frame to the Inky display

The web UI may move faster than the physical panel refresh. The backend and frontend both treat device rendering as an eventual operation rather than an instant synchronous one.

## API Reference

Use the live OpenAPI document instead of relying on a handwritten route list in this file.

When the app is running:

- Swagger UI: `/api/docs`
- Raw OpenAPI JSON: `/api/openapi.json`

The OpenAPI document is generated from the registered Flask routes at runtime and enriched with the backend's current request validation rules. That makes it the best place to confirm the available routes and payload shapes without this document drifting out of date.

## Frontend Serving

The built React app is served by Flask from the same origin as the API. That is the deployable model used on the Pi:

- one Python app process
- no separate Node runtime in production
- reverse proxy in front when needed for friendly local access

## Hardware Scope

This repo is Inky-only.

The backend keeps the hardware communication and image-processing path needed for Pimoroni Inky displays, including `inky_saturation`. Non-Inky display support is intentionally out of scope.
