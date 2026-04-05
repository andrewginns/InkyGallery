# Backend-First Image Library Spec

## Goal

Replace the current plugin-centric image management flow with a backend that is feature-complete for a future frontend rewrite.

Scope for this phase:

- Localhost / local-network only
- No login, auth, or user model
- Backend APIs only
- Inky displays only
- Preserve current device/display settings behavior as the rendering baseline
- Support a rich frontend later for:
  - upload from device
  - browse/manage uploaded images
  - reorder queue
  - sort queue and library
  - set global and per-image timeouts
  - preview and apply to display

## Audit Summary

### Reusable upstream pieces

- `src/config.py`
  - Keep as the low-level device/display config wrapper, but narrow its responsibility to device/runtime settings.
- `src/display/display_manager.py`
  - Keep the render pipeline contract:
    - save `current_image.png`
    - apply orientation
    - resize/crop
    - apply enhancement settings
    - send to the Inky driver
- `src/display/inky_display.py`
  - Keep the Inky hardware integration and `inky_saturation` handling.
- `src/utils/image_utils.py`
  - Keep orientation/resize/enhancement helpers.
- `src/utils/image_loader.py`
  - Keep adaptive image loading and memory-aware decoding.
- `src/blueprints/settings.py`
  - Keep the device/display settings semantics, but expose them through JSON APIs instead of template-first flows.

### Pieces to replace

- `src/model.py`
  - Current model is `Playlist -> PluginInstance`.
  - This is the wrong abstraction for a pure image library.
- `src/refresh_task.py`
  - Current scheduler rotates plugin instances on a global interval.
  - New behavior needs queue-aware playback with per-item timeouts and preview/apply semantics.
- `src/blueprints/plugin.py`
  - Current upload/update flow stores raw plugin settings and raw file paths.
- `src/blueprints/playlist.py`
  - Current playlist API is plugin-centric and not suitable as the main data model for frontend image management.
- `src/plugins/image_upload/image_upload.py`
  - Useful as a reference for padding/background behavior, but image ownership and ordering should move out of plugin settings.

### Simplifications from dropping non-Inky support

- No need to preserve `mock` or Waveshare execution paths in the new architecture
- No need for display-type branching in the new backend APIs
- `inky_saturation` becomes part of the normal default device image settings
- The display service can target a single hardware implementation

### Backend gaps in upstream

- No normalized asset model
- No durable image metadata store
- No thumbnail model
- No dedicated queue model for manual order plus server-side sort
- No per-image timeout model
- No preview/apply playback state
- File uploads are stored by basename only, which risks collisions
- Uploaded files are referenced by absolute paths inside config state
- Production `device.json` is not tracked in git, so bootstrap/default creation must be explicit

## Defaults To Preserve

Preserve these as the backend defaults for display/image enhancement:

- `saturation = 1.0`
- `contrast = 1.0`
- `sharpness = 1.0`
- `brightness = 1.0`
- `inky_saturation = 0.5`

These remain device-level settings, not per-image settings.

## Proposed Architecture

Separate the system into four backend domains:

1. Device Settings
2. Media Library
3. Playback Queue
4. Display Controller

Recommended persistence split:

- JSON config for device/runtime settings
- SQLite for media library, queue, playback state, and audit-friendly metadata
- Filesystem for originals, thumbnails, and the current display image

## Proposed Storage Layout

Recommended runtime paths:

- `src/config/device.json`
- `data/inkypi.db`
- `src/static/images/current_image.png`
- `data/media/originals/<asset_id>/<original_filename>`
- `data/media/thumbnails/<asset_id>/sm.webp`
- `data/media/thumbnails/<asset_id>/md.webp`

Notes:

- Do not store user-facing state as absolute source paths in JSON.
- Use generated asset IDs and database records as the source of truth.
- Preserve the existing `current_image.png` output for compatibility and debugging.

## Proposed Data Model

### `device_settings`

This can remain in JSON rather than SQLite.

Required keys:

- `name`
- `resolution`
- `orientation`
- `inverted_image`
- `timezone`
- `time_format`
- `log_system_stats`
- `image_settings`
  - `saturation`
  - `contrast`
  - `sharpness`
  - `brightness`
  - `inky_saturation`

### `assets`

- `id`
- `filename_original`
- `filename_stored`
- `mime_type`
- `extension`
- `checksum_sha256`
- `width`
- `height`
- `file_size_bytes`
- `favorite`
- `caption`
- `source_type`
  - `upload`
  - `import`
- `created_at`
- `updated_at`
- `deleted_at` nullable

### `asset_variants`

- `id`
- `asset_id`
- `kind`
  - `thumbnail_sm`
  - `thumbnail_md`
- `path`
- `width`
- `height`
- `created_at`

### `queue_items`

- `id`
- `asset_id`
- `position`
- `enabled`
- `timeout_seconds_override` nullable
- `fit_mode`
  - `cover`
  - `contain`
- `background_mode`
  - `blur`
  - `solid`
  - `none`
- `background_color` nullable
- `created_at`
- `updated_at`

### `playback_settings`

Single-row table or JSON-backed service:

- `default_timeout_seconds`
- `loop_enabled`
- `shuffle_enabled`
- `auto_advance_enabled`
- `queue_sort_mode`
  - `manual`
  - `name_asc`
  - `name_desc`
  - `uploaded_newest`
  - `uploaded_oldest`
  - `random`

### `playback_state`

- `id`
- `active_queue_item_id` nullable
- `active_asset_id` nullable
- `preview_queue_item_id` nullable
- `preview_asset_id` nullable
- `mode`
  - `idle`
  - `preview`
  - `displaying`
  - `paused`
- `display_started_at` nullable
- `display_expires_at` nullable
- `last_image_hash` nullable
- `updated_at`

## Required Backend Services

### `DeviceSettingsService`

Responsibilities:

- read/write device settings
- validate enhancement defaults and ranges
- expose current hardware/display state

### `MediaStore`

Responsibilities:

- store originals using generated asset IDs
- prevent basename collisions
- remove files on delete
- expose internal paths safely

### `AssetService`

Responsibilities:

- import uploaded files
- validate type and size
- normalize filenames
- compute checksum
- extract metadata
- generate thumbnails
- update asset metadata
- bulk delete

### `QueueService`

Responsibilities:

- add/remove assets to queue
- reorder items
- apply sort modes
- update per-item timeout and render options
- return queue with stable positions

### `PlaybackController`

Responsibilities:

- determine the active queue item
- support preview without committing active state
- apply preview to display
- next / previous / jump to index
- auto-advance using per-item timeout or default timeout
- maintain playback state
- signal display refreshes

### `DisplayService`

Responsibilities:

- resolve the active asset
- load the asset through `AdaptiveImageLoader`
- apply queue item render options
- apply global device enhancement settings
- write `current_image.png`
- delegate to `DisplayManager`

### `EventService`

Responsibilities:

- emit status changes for frontend polling or SSE
- notify on:
  - upload complete
  - queue change
  - playback change
  - display applied
  - error

## API Surface

All new APIs should be JSON-first.

### Assets

#### `GET /api/assets`

Query params:

- `q`
- `sort`
- `favorite`
- `enabled`
- `limit`
- `cursor`

Supported sorts:

- `uploaded_newest`
- `uploaded_oldest`
- `name_asc`
- `name_desc`

Returns paginated asset summaries plus thumbnail URLs.

#### `POST /api/assets`

Multipart upload endpoint.

Request fields:

- `files[]`
- `duplicate_policy`
  - `reject`
  - `keep_both`
  - `reuse_existing`
- `auto_add_to_queue`

Returns created assets, duplicate results, and thumbnail URLs.

#### `GET /api/assets/:asset_id`

Returns full asset metadata.

#### `PATCH /api/assets/:asset_id`

Updatable fields:

- `caption`
- `favorite`

#### `DELETE /api/assets/:asset_id`

Deletes asset, variants, and any queue references.

#### `POST /api/assets/bulk-delete`

Request:

- `asset_ids`

#### `GET /api/assets/:asset_id/file`

Serves original asset file.

#### `GET /api/assets/:asset_id/thumbnail`

Query:

- `size=sm|md`

### Queue

#### `GET /api/queue`

Returns queue items in effective playback order with embedded asset summaries.

#### `POST /api/queue/items`

Request:

- `asset_ids`
- optional initial queue item settings

#### `PATCH /api/queue/items/:queue_item_id`

Updatable fields:

- `enabled`
- `timeout_seconds_override`
- `fit_mode`
- `background_mode`
- `background_color`

#### `DELETE /api/queue/items/:queue_item_id`

#### `POST /api/queue/reorder`

Request:

- `ordered_queue_item_ids`

This is the canonical endpoint for drag/drop reorder.

#### `POST /api/queue/sort`

Request:

- `sort_mode`

Applies a server-side reorder to queue positions.

### Playback

#### `GET /api/playback`

Returns:

- playback settings
- playback state
- current active item
- current preview item
- current display timeout window

#### `PATCH /api/playback`

Updatable fields:

- `default_timeout_seconds`
- `loop_enabled`
- `shuffle_enabled`
- `auto_advance_enabled`

#### `POST /api/playback/preview`

Request:

- one of:
  - `queue_item_id`
  - `asset_id`
  - `direction`
    - `next`
    - `previous`

Effect:

- render preview candidate without updating active playback state
- update `playback_state.mode = preview`

#### `POST /api/playback/apply`

Commits the current preview to the actual display and active playback state.

#### `POST /api/playback/next`

Advance and display next effective queue item.

#### `POST /api/playback/previous`

Go back and display previous effective queue item.

#### `POST /api/playback/pause`

#### `POST /api/playback/resume`

### Device Settings

#### `GET /api/device/settings`

Returns device/runtime settings, including display enhancement defaults.

#### `PATCH /api/device/settings`

Updatable fields:

- `name`
- `orientation`
- `inverted_image`
- `timezone`
- `time_format`
- `log_system_stats`
- `image_settings`

This replaces template-bound form submission for the future frontend.

### Display Status

#### `GET /api/display/status`

Returns:

- hardware/display type
- resolution
- active asset
- preview asset
- current image URL
- current image hash
- last render timestamp

#### `GET /api/events`

Server-Sent Events endpoint for frontend updates.

If SSE is deferred, polling against `GET /api/playback` and `GET /api/display/status` is acceptable for v1.

## Rendering Rules

For each displayed queue item:

1. Resolve asset file from `MediaStore`
2. Load through `AdaptiveImageLoader`
3. Apply queue item fit/background behavior
4. Apply orientation and invert rules
5. Apply global enhancement settings
6. Save `current_image.png`
7. Send to hardware display driver

The global enhancement settings remain device-level defaults. They are not part of the queue item model.
The only supported driver target is Inky.

## Duplicate Handling

The current upstream upload path stores files by basename only.

New backend requirements:

- compute checksum on ingest
- support explicit duplicate policy
- never overwrite an existing asset because of matching basename
- keep stored filename separate from original filename

## Migration Notes

### Keep

- current display pipeline
- current device settings semantics
- current startup/current image behavior
- current Inky hardware driver integration

### Replace

- plugin-backed image playback
- plugin instance refresh timing as the primary image scheduling mechanism
- absolute file paths in config as the image library source of truth

### Optional migration utility

Add an importer that can read existing `image_upload` plugin instances from `device.json` and convert them into:

- `assets`
- `queue_items`
- `playback_settings`

This is useful if an existing device already has uploaded images and sequence state.

## Recommended Code Layout

Recommended new modules:

- `src/blueprints/api_assets.py`
- `src/blueprints/api_queue.py`
- `src/blueprints/api_playback.py`
- `src/blueprints/api_device.py`
- `src/services/device_settings_service.py`
- `src/services/asset_service.py`
- `src/services/queue_service.py`
- `src/services/playback_controller.py`
- `src/services/display_service.py`
- `src/storage/media_store.py`
- `src/storage/database.py`
- `src/repositories/assets_repo.py`
- `src/repositories/queue_repo.py`
- `src/repositories/playback_repo.py`

The current `plugin.py` and `playlist.py` blueprints can remain during transition, but the new frontend should target only the new JSON APIs.

## Concrete File Responsibilities

### `src/storage/database.py`

Purpose:

- initialize SQLite database
- apply migrations
- expose connection factory
- enable WAL mode and foreign keys

Required behavior:

- use one connection per request or service operation
- set `PRAGMA foreign_keys = ON`
- set `PRAGMA journal_mode = WAL`
- set `PRAGMA busy_timeout = 5000`

### `src/storage/media_store.py`

Purpose:

- create storage directories
- write original uploads
- generate deterministic storage paths from asset IDs
- delete originals and variants
- return file paths for asset resolution

Rules:

- never trust client filenames for storage identity
- always normalize paths
- never serve files by arbitrary path input

### `src/repositories/assets_repo.py`

Purpose:

- CRUD for `assets`
- create and read asset variants
- support search, filters, and paginated list queries

### `src/repositories/queue_repo.py`

Purpose:

- CRUD for `queue_items`
- return queue in effective order
- rewrite queue positions for drag/drop reorder
- apply server-side sort order deterministically

### `src/repositories/playback_repo.py`

Purpose:

- read and update `playback_settings`
- read and update `playback_state`

### `src/services/device_settings_service.py`

Purpose:

- load and validate device settings JSON
- create production `device.json` from defaults when missing
- preserve existing enhancement semantics
- expose a backend-safe update API

### `src/services/asset_service.py`

Purpose:

- accept uploads
- validate and ingest files
- compute checksum and metadata
- create thumbnails
- bulk delete assets and queue references

### `src/services/queue_service.py`

Purpose:

- add assets to queue
- reorder queue
- update queue item render settings
- apply sort modes

### `src/services/display_service.py`

Purpose:

- convert a queue item into a rendered display image
- apply fit/background rules
- pass final image to `DisplayManager`
- return display metadata for status endpoints

### `src/services/playback_controller.py`

Purpose:

- own playback rules and transitions
- maintain preview vs active state
- advance queue on timeout
- coordinate with `DisplayService`

### `src/blueprints/api_assets.py`

Purpose:

- expose JSON upload/list/detail/delete endpoints

### `src/blueprints/api_queue.py`

Purpose:

- expose JSON queue and reorder endpoints

### `src/blueprints/api_playback.py`

Purpose:

- expose preview/apply/next/previous/pause/resume endpoints

### `src/blueprints/api_device.py`

Purpose:

- expose device/display settings and display status endpoints

## SQLite Schema Draft

Recommended first migration:

```sql
CREATE TABLE assets (
    id TEXT PRIMARY KEY,
    filename_original TEXT NOT NULL,
    filename_stored TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    extension TEXT NOT NULL,
    checksum_sha256 TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    favorite INTEGER NOT NULL DEFAULT 0,
    caption TEXT,
    source_type TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE UNIQUE INDEX idx_assets_checksum_live
ON assets(checksum_sha256)
WHERE deleted_at IS NULL;

CREATE TABLE asset_variants (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    path TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_asset_variants_asset_kind
ON asset_variants(asset_id, kind);

CREATE TABLE queue_items (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    timeout_seconds_override INTEGER,
    fit_mode TEXT NOT NULL DEFAULT 'cover',
    background_mode TEXT NOT NULL DEFAULT 'blur',
    background_color TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_queue_items_position
ON queue_items(position);

CREATE TABLE playback_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    default_timeout_seconds INTEGER NOT NULL,
    loop_enabled INTEGER NOT NULL DEFAULT 1,
    shuffle_enabled INTEGER NOT NULL DEFAULT 0,
    auto_advance_enabled INTEGER NOT NULL DEFAULT 1,
    queue_sort_mode TEXT NOT NULL DEFAULT 'manual',
    updated_at TEXT NOT NULL
);

CREATE TABLE playback_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    active_queue_item_id TEXT REFERENCES queue_items(id) ON DELETE SET NULL,
    active_asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
    preview_queue_item_id TEXT REFERENCES queue_items(id) ON DELETE SET NULL,
    preview_asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
    mode TEXT NOT NULL,
    display_started_at TEXT,
    display_expires_at TEXT,
    last_image_hash TEXT,
    updated_at TEXT NOT NULL
);
```

## Request and Response Shapes

### `POST /api/assets`

Response:

```json
{
  "created": [
    {
      "id": "ast_01",
      "filename_original": "beach.jpg",
      "width": 3024,
      "height": 4032,
      "thumbnail_urls": {
        "sm": "/api/assets/ast_01/thumbnail?size=sm",
        "md": "/api/assets/ast_01/thumbnail?size=md"
      }
    }
  ],
  "duplicates": [
    {
      "filename_original": "beach.jpg",
      "existing_asset_id": "ast_existing",
      "action": "reuse_existing"
    }
  ]
}
```

### `GET /api/queue`

Response:

```json
{
  "items": [
    {
      "id": "qi_01",
      "position": 0,
      "enabled": true,
      "timeout_seconds_override": 120,
      "fit_mode": "contain",
      "background_mode": "blur",
      "background_color": null,
      "asset": {
        "id": "ast_01",
        "filename_original": "beach.jpg",
        "thumbnail_url": "/api/assets/ast_01/thumbnail?size=sm"
      }
    }
  ]
}
```

### `GET /api/playback`

Response:

```json
{
  "settings": {
    "default_timeout_seconds": 300,
    "loop_enabled": true,
    "shuffle_enabled": false,
    "auto_advance_enabled": true,
    "queue_sort_mode": "manual"
  },
  "state": {
    "mode": "displaying",
    "active_queue_item_id": "qi_01",
    "preview_queue_item_id": null,
    "display_started_at": "2026-04-05T12:00:00Z",
    "display_expires_at": "2026-04-05T12:05:00Z"
  }
}
```

### `GET /api/device/settings`

Response:

```json
{
  "name": "InkyPi",
  "resolution": [800, 480],
  "orientation": "horizontal",
  "inverted_image": false,
  "timezone": "UTC",
  "time_format": "24h",
  "log_system_stats": false,
  "image_settings": {
    "saturation": 1.0,
    "contrast": 1.0,
    "sharpness": 1.0,
    "brightness": 1.0,
    "inky_saturation": 0.5
  }
}
```

## Validation Rules

### Upload validation

- allowed extensions should align with current upstream support:
  - `png`
  - `jpg`
  - `jpeg`
  - `gif`
  - `webp`
  - `avif`
  - `heif`
  - `heic`
- reject zero-byte files
- reject files that Pillow cannot decode
- normalize EXIF orientation on ingest for JPEG and HEIF-family formats

### Device settings validation

- `orientation` in `horizontal|vertical`
- `time_format` in `12h|24h`
- `saturation`, `contrast`, `sharpness`, `brightness` in `0.0..2.0`
- `inky_saturation` in `0.0..1.0`

### Queue validation

- `timeout_seconds_override` must be null or positive integer
- `background_color` required when `background_mode = solid`
- `fit_mode` in `cover|contain`
- `background_mode` in `blur|solid|none`

### Playback validation

- `default_timeout_seconds` must be positive
- preview/apply endpoints must fail cleanly when queue is empty
- `previous` and `next` must behave deterministically when shuffle is disabled

## Playback Rules

### Active vs preview behavior

- `preview` renders a candidate image without committing queue position
- `apply` promotes preview state to active state and resets the timeout window
- `next` and `previous` are committed navigation actions

### Timeout behavior

- if `timeout_seconds_override` exists, it wins
- otherwise use `default_timeout_seconds`
- if `auto_advance_enabled` is false, timeout expiry does not trigger next-item display

### Queue order behavior

- `manual` uses persisted `position`
- non-manual sort modes rewrite queue positions server-side so the frontend can always render a stable ordered list
- `shuffle_enabled` affects playback traversal, not library order

### Empty-state behavior

- if queue is empty, playback mode is `idle`
- if queue becomes empty while displaying, keep the current display image until explicitly changed

## Bootstrap and Runtime Integration

### `src/inkypi.py`

Planned changes:

1. bootstrap device settings with explicit defaults if `device.json` is missing
2. initialize SQLite database before blueprints are registered
3. instantiate new services:
   - `DeviceSettingsService`
   - `AssetService`
   - `QueueService`
   - `DisplayService`
   - `PlaybackController`
4. register new JSON blueprints
5. keep legacy blueprints available only for migration/admin compatibility until removed

### Background thread model

Keep a single background playback thread, but repurpose it:

- it should read `playback_state` and `playback_settings`
- wake on:
  - timeout expiry
  - explicit preview/apply actions
  - queue changes
  - device setting changes that affect render output

The new playback loop should not depend on `PlaylistManager` or plugin refresh timing.

## Legacy Import Plan

If a production `device.json` already exists, add a one-time import command or startup path:

1. read `playlist_config`
2. find `image_upload` plugin instances
3. create `assets` for each unique `imageFiles[]` entry
4. create `queue_items` in existing order
5. infer timeout values:
   - plugin-level interval becomes per-item override if present
   - otherwise fall back to global default timeout
6. infer render options:
   - `padImage`
   - `backgroundOption`
   - `backgroundColor`
7. seed `playback_state` from existing `refresh_info` and `image_index` where possible

This importer should be idempotent and should mark completion in a small migration state file or table.

## Delivery Phases

### Phase 0: Bootstrap and safety rails

- create `device.json` bootstrap defaults
- add database bootstrap
- add media storage directories
- add migration framework

Deliverable:

- app boots cleanly with no existing production config

### Phase 1: Asset ingestion

- implement upload endpoint
- create asset metadata records
- generate thumbnails
- serve originals and thumbnails

Deliverable:

- frontend can upload and browse assets

### Phase 2: Queue management

- add queue CRUD endpoints
- reorder endpoint
- sort endpoint
- queue item render options

Deliverable:

- frontend can build and maintain a playback queue

### Phase 3: Playback controller

- add playback settings/state persistence
- add preview/apply logic
- add next/previous/pause/resume
- add status endpoints

Deliverable:

- backend can fully drive the display independently of legacy playlists

### Phase 4: Legacy import and cleanup

- add importer from `image_upload` plugin state
- remove or isolate plugin-based image flows
- leave non-image plugins untouched unless later scope changes

Deliverable:

- existing image-based devices can migrate into the new backend

## Test Strategy

### Unit tests

- asset ingestion validation
- duplicate policy behavior
- queue reorder and sort stability
- playback state transitions
- timeout resolution logic
- device settings validation

### Integration tests

- upload asset -> add to queue -> preview -> apply -> next
- delete asset cascades queue cleanup
- queue reorder persists across process restart
- playback settings persist across process restart
- importer creates expected assets and queue items from legacy config

### Hardware-adjacent tests

- verify `DisplayService` writes `current_image.png`
- verify enhancement settings are applied before driver handoff
- verify `inky_saturation` is passed to `InkyDisplay`

## Main Risks

- `device.json` bootstrap behavior is currently implicit and easy to get wrong in production
- replacing plugin-driven playback requires careful coexistence during migration
- preview/apply semantics need clear ownership so the background thread does not fight API-driven state changes
- large uploads and thumbnail generation need bounded memory behavior on low-resource Pi hardware

## Recommended Branch and Execution Strategy

- keep `/home/ubuntu/projects/InkyPi` untouched until implementation begins
- use `/home/ubuntu/projects/InkyPi-upstream-audit` as the planning and implementation base
- create the actual implementation branch from `upstream/main`, not from the current dirty feature branch

## Done Criteria

The backend rewrite is complete when:

- a client can upload, list, edit, and delete assets through JSON APIs
- a client can build and reorder a queue
- a client can set default and per-item timeouts
- a client can preview and apply images to the display
- the display uses preserved enhancement defaults
- no image management feature depends on plugin settings pages
- the new frontend can be built entirely against the new API surface

## Implementation Order

1. Add config bootstrap:
   - create `device.json` from defaults if missing
   - add explicit default image settings including `saturation` and `inky_saturation`
2. Add SQLite bootstrap and repositories
3. Implement `MediaStore` and `AssetService`
4. Implement asset APIs and thumbnail generation
5. Implement `QueueService` and queue APIs
6. Implement `PlaybackController`
7. Integrate `DisplayService` with existing `DisplayManager`
8. Add playback APIs and status APIs
9. Add SSE or polling-friendly state endpoints
10. Add importer for legacy `image_upload` plugin state

## Non-Goals For This Phase

- Authentication
- Multi-user state
- Cloud sync
- Album sharing
- Frontend templates
- Supporting non-Inky displays

## Decision Summary

Build the new backend around:

- device settings in JSON
- media/queue/playback state in SQLite
- originals/thumbnails on disk
- existing display/rendering pipeline reused as-is

Do not build the new system on top of `PlaylistManager` and `PluginInstance`. Those are acceptable legacy compatibility layers, but not the right source of truth for a modern image-management frontend.
