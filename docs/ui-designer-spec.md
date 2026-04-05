# UI Designer Spec

## Purpose

This document describes what the future mobile-first website must enable so a designer can create a polished, intuitive interface for the backend that already exists in this project.

This is not a visual design proposal and does not prescribe layout, branding, typography, or styling. It defines:

- the user jobs the UI must support
- the information and controls each area must expose
- the critical states, transitions, and feedback that must feel good in use
- the backend-backed constraints the UI should be designed around

## Product Context

- The product runs on a trusted local network.
- There is no login, onboarding, or user-account management.
- The system controls an Inky display only.
- The backend already supports uploads, asset browsing, queue management, playback preview/apply, next/previous navigation, playback settings, and device display settings.
- The UI should feel lightweight, calm, and direct rather than enterprise-heavy.
- The UI should be mobile first, because the most likely usage pattern is a user standing near the display and managing it from a phone.

## Primary User Jobs

The UI must make these jobs easy:

- upload images from the user’s device
- review everything already uploaded
- find a specific image quickly
- add images to the playback queue
- remove images from the queue
- reorder the queue manually
- sort the queue server-side
- change how each queue item is displayed
- set a global image timeout
- override timeout per queue item
- preview an image before making it live
- apply the previewed image to the Inky display
- move to the next or previous image
- pause and resume playback
- understand what is currently on the display
- adjust device-level display settings when needed

## Experience Principles

The designer should optimize for these qualities:

- Fast to understand on first use.
- Safe to operate while standing or moving, with one-handed use in mind.
- Confident, meaning the user can always tell what is uploaded, what is queued, what is previewed, and what is actually live on the display.
- Low-friction, with common actions available in one or two taps.
- Reversible where possible, especially for destructive actions and display-changing actions.
- Quietly delightful through responsiveness, good previewing, clear status, and polished empty/loading/success/error states.

## Core Objects The UI Must Represent

### Asset

An uploaded image asset has:

- thumbnail
- original file
- original filename
- dimensions
- file size
- created/uploaded timestamp
- optional caption
- favorite state

The UI must treat the asset library as the source collection of uploaded images.

### Queue Item

A queue item is a display-ready reference to an asset with playback-specific settings:

- enabled/disabled state
- manual position in queue
- optional timeout override
- fit mode: `cover` or `contain`
- background mode: `blur`, `solid`, or `none`
- optional background color

The UI must treat the queue as the ordered list used for playback.

### Playback State

Playback has:

- active item
- preview item
- mode: idle, preview, displaying, paused
- default timeout
- loop enabled
- shuffle enabled
- auto-advance enabled
- last rendered timestamp
- current rendered image

The UI must always make the difference between preview and live display obvious.

### Device Settings

The backend exposes device-level settings including:

- orientation
- inverted image toggle
- timezone
- time format
- log system stats
- image enhancement settings
- brightness
- contrast
- sharpness
- saturation
- inky saturation

These are advanced settings, not the primary daily workflow.

## Required Product Areas

The designer should assume the UI needs four top-level areas.

### 1. Now Playing

This is the operational home screen.

It must show:

- the current image rendered on the display
- whether the app is idle, previewing, displaying, or paused
- the current live item name if available
- the preview item name if different from live
- when the current image was last rendered
- the default timeout in effect

It must allow:

- preview next
- preview previous
- preview a selected asset or queue item
- apply the current preview
- move immediately to next
- move immediately to previous
- pause playback
- resume playback

This is a key delight surface. The user should feel that the display is responsive, understandable, and under control.

### 2. Library

This is the uploaded image collection.

It must support:

- browsing thumbnails
- search by text query
- server-side sorting of assets
- filtering favorites
- pagination or infinite loading using the backend cursor model
- opening asset details
- editing caption
- toggling favorite
- deleting one asset
- deleting multiple assets
- uploading one or more files
- choosing duplicate handling during upload
- optionally auto-adding uploaded files to the queue
- previewing an asset directly from the library
- adding one or more assets to the queue

The designer should assume the user may arrive here either to add new images or to find a previously uploaded image quickly.

### 3. Queue

This is the playback sequence manager.

It must support:

- seeing the current ordered queue
- distinguishing enabled and disabled items
- reordering items manually
- removing items from the queue
- editing per-item settings
- applying a server-side sort mode
- previewing a queue item
- understanding which queue item is currently live
- understanding which queue item is currently previewed

For each queue item, the UI must expose:

- thumbnail
- original filename
- enabled toggle
- timeout override
- fit mode
- background mode
- background color when relevant

The queue needs to feel editable without being fragile. Reordering and per-item editing are core interaction quality points.

### 4. Device and Display Settings

This is the advanced settings area.

It must support:

- reading current device settings
- editing orientation
- editing inverted image
- editing timezone
- editing time format
- editing log system stats
- editing brightness
- editing contrast
- editing sharpness
- editing saturation
- editing inky saturation

This area should also surface the preserved defaults for reference:

- brightness: `1.0`
- contrast: `1.0`
- sharpness: `1.0`
- saturation: `1.0`
- inky saturation: `0.5`

This screen should feel safe and intentional because these settings affect all images, not just one queue item.

## Functional Detail The UI Must Support

### Upload Flow

The upload experience must support:

- selecting multiple files from the device
- showing upload progress or completion feedback
- explaining duplicate handling clearly
- allowing the user to choose between rejecting duplicates, keeping both, or reusing the existing asset
- optionally sending uploads straight into the queue

If duplicates are found, the UI should present that result in a way that feels informative rather than error-heavy.

### Asset Management

The UI must make it easy to:

- inspect asset metadata
- mark favorites
- edit caption
- add selected assets to queue
- bulk delete selected assets
- preview before queueing if desired

The backend does not currently support rename, tagging, albums, or folders, so the UI should not imply those features exist.

### Queue Management

The queue experience must support:

- drag reorder or another touch-friendly reorder pattern
- quick enable/disable
- quick remove
- opening an item editor for advanced settings
- server-side queue sort options:
  - manual
  - name ascending
  - name descending
  - uploaded newest
  - uploaded oldest

If the user applies a sort, the UI should make clear that the queue order changed and that manual order can still be restored by further editing.

### Playback Control

The backend supports previewing by asset, previewing by queue item, and previewing next or previous.

The UI must therefore make room for:

- direct preview from the library
- direct preview from the queue
- next/previous preview from the operational display screen
- a distinct apply action after preview
- direct next/previous actions that commit immediately

The apply step is important. Preview and live state must never be visually ambiguous.

### Timeout and Playback Rules

The UI must support:

- global default timeout
- per-item timeout override
- loop toggle
- shuffle toggle
- auto-advance toggle

The user should be able to understand which timeout is in effect for a given live image:

- item override if present
- otherwise global default

### Display Rendering Controls

The UI must expose the image fitting choices already supported by the backend:

- `cover`
- `contain`

For contain mode, the UI must expose background options:

- `blur`
- `solid`
- `none`

If `solid` is chosen, the UI must allow the user to set a background color.

These controls belong to queue items rather than global device settings.

## States The UI Must Handle Well

The designer should explicitly design for:

- first use with no assets uploaded
- assets uploaded but queue empty
- queue exists but nothing has been applied yet
- preview active but not yet applied
- paused playback
- empty search results
- upload in progress
- upload complete with duplicates handled
- delete confirmation
- queue reorder in progress
- device settings save success
- validation error from backend
- current image unavailable
- network interruption to the local backend

The product should remain understandable even when there is nothing in the system yet.

## Information Hierarchy Requirements

At any point, the user should be able to answer these questions without effort:

- What image is currently on the display?
- Am I looking at a preview or the live display?
- What happens next if I tap apply, next, previous, pause, or resume?
- Which images exist in the library?
- Which images are in the queue?
- What order will the queue play in?
- Which timeout applies to this item?
- Are playback settings global or item-specific?
- Am I changing only one queue item, or the whole device?

If a design makes these answers unclear, it is not meeting the functional brief.

## Mobile-First Constraints

The UI should be designed assuming:

- portrait orientation first
- thumb-friendly tap targets
- minimal text entry
- common actions reachable without precision tapping
- clear separation between browse, edit, and destructive actions
- sticky access to the most important actions on smaller screens
- image-heavy views should remain fast and readable on small devices

Desktop can become a wider version of the same product, but the primary interaction model should not depend on desktop-only affordances.

## Delight Opportunities

The designer should pay special attention to these moments:

- file upload completion
- previewing an image and seeing that it is not yet live
- applying a preview and seeing it become live
- reordering the queue
- marking favorites
- switching between library and queue without losing context
- empty states that invite action rather than feeling dead
- playback controls that feel calm and reliable rather than mechanical

Delight should come from clarity, speed, and polished feedback, not from adding novelty that makes the tool harder to use.

## Out Of Scope For The UI

The current backend does not require UI support for:

- authentication
- multiple users
- permissions or roles
- folders or albums
- tagging systems
- image editing or cropping
- comments or collaboration
- cloud sync
- multiple display types

The UI should not hint at features the backend does not provide.

## Backend Surfaces The UI Will Use

The designer does not need to design around endpoint names, but these backend capability groups exist and should be assumed available:

- asset library listing, upload, metadata update, delete, original file fetch, thumbnail fetch
- queue listing, add, update, delete, reorder, sort
- playback status, playback settings update, preview, apply, next, previous, pause, resume
- device settings read and update
- display status and current rendered image

## Success Criteria For The Future UI

The final UI should allow a user to do the following from a phone without confusion:

- upload an image
- see it appear in the library
- add it to the queue
- change how it will render
- preview it
- apply it to the display
- confirm that it is now live
- change how long it will stay on screen
- reorder what plays next
- pause or resume playback
- adjust device display settings when needed

If those tasks feel direct and pleasant, the design is aligned with the backend and with the product goal.
