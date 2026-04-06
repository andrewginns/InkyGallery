# UI Product Surface

This document describes the UI that exists in this repo and the constraints a future design pass should preserve.

## Product Shape

- Local-network only
- No auth, onboarding, or account model
- Mobile-first web app
- Single-product focus: manage and drive one Inky display
- Portrait mode only for the display preview and crop workflow

## Core Navigation

The app has four primary areas:

1. `Now Playing`
2. `Library`
3. `Queue`
4. `Settings`

The bottom navigation is the primary mobile navigation pattern and should remain fast, stable, and easy to use one-handed.

## Now Playing

This is the operational home screen.

It currently supports:

- a compact portrait preview of the selected image
- a clear distinction between:
  - the live image on the device
  - a queued image being previewed in the UI
  - an image currently being rendered to the device
- a horizontally scrolling film strip of the queue
- auto-centering of the currently live queue item in that film strip
- tap-to-preview on queue thumbnails without triggering a real device render
- `Apply` only when the selected image is not yet live
- pause and resume playback
- tap-to-expand on the main image for a larger detail view
- crop editing from the image overlay for both previewed and live images

Important semantics the UI must preserve:

- Preview is non-rendering.
- Apply triggers a real device render.
- Returning to the already-live queue item should clear preview state.
- Render feedback should stay subtle and in-context on the image, not through large layout-shifting banners.

## Library

This is the uploaded asset collection.

It currently supports:

- thumbnail browsing
- text search across filename and caption
- local UI sorting by upload time and name
- favorites filtering
- multi-select mode
- bulk delete
- upload with duplicate handling
- optional auto-add to queue on upload
- asset detail dialog
- caption editing
- favorite toggle
- `Apply Now`
- `Add to Queue`
- persistent crop editing for each asset

Important semantics:

- `Apply Now` inserts the chosen image into the queue at the current live position and renders it immediately.
- When that applied image expires, normal queue playback continues.
- Crop edits are saved for the asset and reused anywhere that asset is rendered in cover mode.

## Queue

This is the playback sequence editor.

It currently supports:

- seeing the ordered queue
- seeing which item is live
- seeing which item is previewed
- enabled/disabled state per item
- manual reordering
- remove from queue
- per-item settings in a bottom sheet
- per-item timeout override
- fit mode: `cover` or `contain`
- background mode for contained images
- server-side sort modes
- previewing a queue item into Now Playing

Important semantics:

- The queue is the playback source of truth.
- The selected preview item may differ from the live device item.
- The live queue position should always stay legible.

## Settings

This area combines playback defaults, browser appearance, and device-level display settings.

It currently supports:

- playback defaults:
  - default timeout
  - loop
  - shuffle
  - auto-advance
- browser-local theme selection:
  - `System`
  - `Light`
  - `Dark`
- device settings:
  - invert image
  - timezone
  - time format
  - log system stats
  - image enhancement settings

Preserved device image defaults:

- `brightness: 1.0`
- `contrast: 1.0`
- `sharpness: 1.0`
- `saturation: 1.0`
- `inky_saturation: 0.5`

## Crop Editing

Crop editing is part of the shipped product and should be treated as a first-class interaction.

Current behavior:

- available from the image overlay in Now Playing
- available from the asset detail dialog in Library
- opens a full-screen mobile dialog
- shows a portrait crop viewport matching the device preview
- supports drag-to-reposition
- supports zoom
- supports reset
- supports `Save crop`
- supports `Save & Apply` when the user is editing an image they want to send live

Important semantics:

- Crops are persisted per asset.
- Saved crops are reused automatically when that asset is rendered in `cover` mode.
- Crop editing should feel precise but calm, with the image doing most of the communication.

## Theme Direction

The app now supports both light and dark presentation.

Design work should preserve:

- `System` as the default theme choice
- a tasteful light mode that works well outdoors or near the display
- the current amber/emerald accent language
- strong readability over flat pure-white screens

If the browser exposes system theme preference, the app should continue to respect it.

## Interaction Guardrails

Any design refinement should preserve these behaviors:

- avoid layout-jumping spinners for preview interactions
- keep live vs preview vs rendering states easy to distinguish
- prefer direct, mobile-friendly controls over hidden desktop-heavy affordances
- keep destructive actions explicit
- do not introduce UI for features the backend does not support

## Out of Scope

The current product does not support:

- user accounts
- remote internet access as a primary mode
- folders or albums
- tags
- image renaming
- per-queue-item crop overrides
- landscape-oriented display workflows
