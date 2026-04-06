# UI Refactor And Theme Plan

## Intent

This plan replaces the earlier generic UI inspection plan with one that matches how InkyGallery actually works:

- a Flask-served Vite app deployed to a Raspberry Pi
- a local-network-only control surface for an Inky display
- real backend-driven queue, playback, crop, and device settings flows
- mobile-first interaction as the default

The goal is to improve maintainability and polish without regressing the interaction model that is already working on real hardware.

## Current Reality

The current frontend is feature-complete and close to the intended product behavior, but the architecture has started to compress too much logic into [App.tsx](/home/ubuntu/projects/InkyGallery/inky-gallery-ui/src/App.tsx). The main issues are:

- [App.tsx](/home/ubuntu/projects/InkyGallery/inky-gallery-ui/src/App.tsx) owns bootstrap, polling, optimistic playback state, queue mutations, crop persistence, error handling, and tab layout
- theme boot is hardcoded to dark in [index.html](/home/ubuntu/projects/InkyGallery/inky-gallery-ui/index.html), which ignores the user’s device preference
- verification currently depends too much on ad hoc manual checks instead of preserving the Playwright-backed flows that are already useful in this repo

## Constraints

- Do not change the backend contract casually. The backend already implements queue preview, apply-now, persisted crop profiles, rerender-active, and Pi deployment behavior.
- Do not reintroduce noisy spinners or overlays that were intentionally removed during real-device iteration.
- Do not introduce a separate frontend deployment path. The built frontend remains served by Flask from `src/static/app`.
- Do not optimize for desktop first. All layout decisions should continue to start from narrow mobile viewports.

## Big Forks

### 1. Refactor shape

Do not move everything from [App.tsx](/home/ubuntu/projects/InkyGallery/inky-gallery-ui/src/App.tsx) into a single `useAppState` hook.

That would only turn one God-component into one God-hook.

Preferred direction:

- extract focused hooks by responsibility
- keep state orchestration centralized enough to understand
- avoid unnecessary React context unless state must be consumed far from the root

### 2. Theme strategy

Do not keep the current hardcoded dark boot in [index.html](/home/ubuntu/projects/InkyGallery/inky-gallery-ui/index.html).

Preferred direction:

- honor the user’s device theme with `prefers-color-scheme`
- use light mode as a first-class theme rather than a fallback
- preserve the app’s warm amber/emerald identity across both themes

### 3. UI polish scope

Do not run a broad “tighten spacing everywhere” pass.

Preferred direction:

- only adjust screens where we can point to a concrete issue
- preserve behaviors that have already been tuned against the real Pi and screen latency

## Recommended Architecture Changes

### Phase 1: Break Up App Orchestration

Refactor [App.tsx](/home/ubuntu/projects/InkyGallery/inky-gallery-ui/src/App.tsx) into smaller pieces without changing behavior.

Create:

- `src/hooks/useBootstrap.ts`
  - loads initial assets, queue, playback, display status, and device settings
- `src/hooks/usePlaybackPolling.ts`
  - owns the polling loop for playback and display status
- `src/hooks/useAssetActions.ts`
  - upload, favorite, caption, delete, crop persistence
- `src/hooks/useQueueActions.ts`
  - add to queue, remove, reorder, sort, queue item updates, apply-now
- `src/hooks/usePlaybackActions.ts`
  - preview, apply, pause, resume, rerender-active, optimistic apply state

Keep [App.tsx](/home/ubuntu/projects/InkyGallery/inky-gallery-ui/src/App.tsx) responsible for:

- top-level tab routing
- high-level error and busy surface
- wiring hook outputs into the four main screens

Success criteria for Phase 1:

- no behavioral changes
- no API surface changes
- `App.tsx` becomes layout and wiring, not business logic storage

### Phase 2: Normalize View Models

The component props are still fairly raw. Introduce lightweight derived view-model helpers for repeated UI calculations.

Create:

- `src/lib/playback-view.ts`
  - derive active asset, preview asset, live queue item, selected queue item, and display labels
- `src/lib/theme.ts`
  - resolve theme mode and expose helper functions for initial theme bootstrap

This keeps complex conditional logic out of [NowPlaying.tsx](/home/ubuntu/projects/InkyGallery/inky-gallery-ui/src/components/NowPlaying.tsx) and similar files without introducing backend-shaped types into presentation logic.

### Phase 3: Targeted Screen Cleanup

Only refine the screens that currently have the highest interaction density.

#### Now Playing

Focus:

- keep the preview image compact and stable
- preserve quiet render feedback
- make the film strip, crop entry point, and expanded detail view feel related rather than layered independently

Potential changes:

- consolidate repeated status text into shared helpers
- simplify overlay conditionals
- reduce duplicated asset metadata rendering between inline and expanded views

#### Library

Focus:

- keep the primary actions obvious
- keep crop/apply flows clear without stacking too many buttons
- preserve current real-device semantics of `Apply Now`

Potential changes:

- unify detail dialog action ordering
- standardize badge usage for favorites, saved crop, and queue presence

#### Queue

Focus:

- keep per-item actions discoverable without relying too much on hover-style assumptions
- ensure all important actions remain obvious on touch devices

Potential changes:

- tighten the action cluster without changing the settings sheet behavior
- preserve the newly added stable IDs used for Playwright and docs generation

## Theme Plan

### Goal

Support a tasteful light mode and automatically match the user’s device setting when the browser exposes it, while preserving the existing visual identity.

### Theme behavior

Implement a three-state theme model:

- `system`
- `light`
- `dark`

Default:

- `system`

Resolution order:

1. stored user choice from `localStorage`
2. system preference from `window.matchMedia('(prefers-color-scheme: dark)')`
3. fallback to light mode

### Boot behavior

Update [index.html](/home/ubuntu/projects/InkyGallery/inky-gallery-ui/index.html):

- remove the hardcoded `class="dark"` on `<html>`
- add `meta name="color-scheme" content="light dark"`
- add a tiny inline bootstrap script that sets the theme class before hydration based on stored preference or system preference

This avoids a flash of incorrect theme and is reliable in modern mobile browsers.

### Light theme direction

The light theme should feel warm and deliberate, not generic white UI.

Keep:

- amber primary
- emerald live-state accents
- dark media stage for image previews
- DM Sans and JetBrains Mono

Adjust light tokens toward:

- warm paper background rather than pure white
- slightly deeper card contrast so surfaces remain legible outdoors
- gentle sepia/stone muted tones
- crisp text contrast for sunlight readability on mobile

Recommended light-token direction:

- background: warm paper
- card: slightly darker cream surface
- border: soft sand line
- accent: pale apricot instead of flat gray
- muted text: a touch darker than current to improve legibility outdoors

### Dark theme direction

Keep dark mode available, but make it slightly calmer:

- preserve current deep charcoal base
- reduce the hard contrast gap between background and cards
- keep amber as the main action color rather than introducing a new hue family

### Theme toggle

Add a simple theme selector to [SettingsView.tsx](/home/ubuntu/projects/InkyGallery/inky-gallery-ui/src/components/SettingsView.tsx):

- `System`
- `Light`
- `Dark`

This should be UI-only state stored locally in the browser. It does not belong in device settings.

## Verification Plan

### Frontend verification

Run:

- `cd inky-gallery-ui && pnpm build`

Add focused Playwright checks for:

- system-theme boot with no hardcoded dark class
- light theme loads correctly on first paint
- theme toggle persists across reload
- preview/apply/crop flows still behave the same after refactor

### Backend verification

Run:

- `uv run pytest -q`

The UI refactor should not require backend changes, but regression coverage should remain green because the UI depends on the current playback and queue semantics.

### Pi verification

After shipping a meaningful refactor or theme change:

- deploy to the Pi
- verify `http://127.0.0.1:8080/health`
- verify `https://inky-7.local/health`
- manually check Now Playing, Library, Queue, and Settings on a phone
- verify that device-theme matching works on at least one mobile browser

## Non-Goals

- no conversion to React context unless a concrete prop-drilling problem appears
- no artifact bundling workflow
- no desktop-first redesign
- no backend contract churn unless a frontend simplification clearly justifies it
- no visual overhaul that discards the current amber/emerald identity

## Delivery Order

1. Theme bootstrap and light-mode token pass
2. Extract `useBootstrap` and `usePlaybackPolling`
3. Extract asset, queue, and playback action hooks
4. Simplify [App.tsx](/home/ubuntu/projects/InkyGallery/inky-gallery-ui/src/App.tsx)
5. Apply targeted cleanup to Now Playing, Library, and Queue
6. Add Playwright coverage for theme boot and critical flows
7. Deploy to Pi and verify on real hardware

## Expected Outcome

After this work:

- the app still behaves the same on the Pi
- the code is easier to reason about and change safely
- theme behavior respects the user’s device preference
- light mode looks intentional rather than incidental
- future UI work can happen on top of smaller, clearer state boundaries
