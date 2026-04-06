import sqlite3
from contextlib import contextmanager
from pathlib import Path


class Database:
    def __init__(self, path: Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

    @contextmanager
    def connection(self):
        conn = sqlite3.connect(self.path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA busy_timeout = 5000")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def initialize(self, schema_path: Path):
        with self.connection() as conn:
            conn.executescript(Path(schema_path).read_text())
            # Earlier builds created this as a unique index, which breaks duplicate_policy=keep_both.
            conn.execute("DROP INDEX IF EXISTS idx_assets_checksum_live")
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_assets_checksum_live
                ON assets(checksum_sha256)
                WHERE deleted_at IS NULL
                """
            )
            conn.execute(
                """
                INSERT OR IGNORE INTO playback_settings
                    (id, default_timeout_seconds, loop_enabled, shuffle_enabled, auto_advance_enabled, queue_sort_mode, updated_at)
                VALUES
                    (1, 300, 1, 0, 1, 'manual', CURRENT_TIMESTAMP)
                """
            )
            conn.execute(
                """
                INSERT OR IGNORE INTO playback_state
                    (id, mode, updated_at)
                VALUES
                    (1, 'idle', CURRENT_TIMESTAMP)
                """
            )
