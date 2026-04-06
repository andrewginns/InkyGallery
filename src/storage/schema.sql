CREATE TABLE IF NOT EXISTS assets (
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

CREATE INDEX IF NOT EXISTS idx_assets_checksum_live
ON assets(checksum_sha256)
WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS asset_variants (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    path TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_variants_asset_kind
ON asset_variants(asset_id, kind);

CREATE TABLE IF NOT EXISTS asset_crop_profiles (
    asset_id TEXT PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
    crop_x REAL NOT NULL,
    crop_y REAL NOT NULL,
    crop_width REAL NOT NULL,
    crop_height REAL NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS queue_items (
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_queue_items_position
ON queue_items(position);

CREATE TABLE IF NOT EXISTS playback_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    default_timeout_seconds INTEGER NOT NULL,
    loop_enabled INTEGER NOT NULL DEFAULT 1,
    shuffle_enabled INTEGER NOT NULL DEFAULT 0,
    auto_advance_enabled INTEGER NOT NULL DEFAULT 1,
    queue_sort_mode TEXT NOT NULL DEFAULT 'manual',
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS playback_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    active_queue_item_id TEXT REFERENCES queue_items(id) ON DELETE SET NULL,
    active_asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
    preview_queue_item_id TEXT REFERENCES queue_items(id) ON DELETE SET NULL,
    preview_asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
    mode TEXT NOT NULL,
    display_started_at TEXT,
    display_expires_at TEXT,
    last_image_hash TEXT,
    last_rendered_at TEXT,
    updated_at TEXT NOT NULL
);
