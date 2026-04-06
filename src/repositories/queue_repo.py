from typing import Any


class QueueRepository:
    def __init__(self, database):
        self.database = database

    def list_items(self, enabled_only=False):
        clause = "WHERE q.enabled = 1" if enabled_only else ""
        with self.database.connection() as conn:
            rows = conn.execute(
                f"""
                SELECT
                    q.*,
                    a.filename_original,
                    a.filename_stored,
                    a.mime_type,
                    a.width,
                    a.height,
                    a.favorite,
                    a.created_at AS asset_created_at
                FROM queue_items q
                JOIN assets a ON a.id = q.asset_id
                {clause}
                ORDER BY q.position ASC
                """
            ).fetchall()
        return [dict(row) for row in rows]

    def get_item(self, queue_item_id: str):
        with self.database.connection() as conn:
            row = conn.execute(
                """
                SELECT
                    q.*,
                    a.filename_original,
                    a.filename_stored,
                    a.mime_type,
                    a.width,
                    a.height,
                    a.favorite,
                    a.created_at AS asset_created_at
                FROM queue_items q
                JOIN assets a ON a.id = q.asset_id
                WHERE q.id = ?
                """,
                (queue_item_id,),
            ).fetchone()
        return dict(row) if row else None

    def create_item(self, item: dict[str, Any]):
        with self.database.connection() as conn:
            conn.execute(
                """
                INSERT INTO queue_items (
                    id, asset_id, position, enabled, timeout_seconds_override,
                    fit_mode, background_mode, background_color, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    item["id"],
                    item["asset_id"],
                    item["position"],
                    int(item.get("enabled", True)),
                    item.get("timeout_seconds_override"),
                    item.get("fit_mode", "cover"),
                    item.get("background_mode", "blur"),
                    item.get("background_color"),
                    item["created_at"],
                    item["updated_at"],
                ),
            )
        return self.get_item(item["id"])

    def append_item(self, item: dict[str, Any]):
        with self.database.connection() as conn:
            conn.execute(
                """
                INSERT INTO queue_items (
                    id, asset_id, position, enabled, timeout_seconds_override,
                    fit_mode, background_mode, background_color, created_at, updated_at
                )
                SELECT
                    ?, ?, COALESCE(MAX(position) + 1, 0), ?, ?, ?, ?, ?, ?, ?
                FROM queue_items
                """,
                (
                    item["id"],
                    item["asset_id"],
                    int(item.get("enabled", True)),
                    item.get("timeout_seconds_override"),
                    item.get("fit_mode", "cover"),
                    item.get("background_mode", "blur"),
                    item.get("background_color"),
                    item["created_at"],
                    item["updated_at"],
                ),
            )
        return self.get_item(item["id"])

    def insert_item_at(self, position: int, item: dict[str, Any]):
        with self.database.connection() as conn:
            item_count = conn.execute("SELECT COUNT(*) AS count FROM queue_items").fetchone()["count"]
            insert_position = max(0, min(int(position), item_count))
            temp_offset = item_count + 1

            conn.execute(
                "UPDATE queue_items SET position = position + ? WHERE position >= ?",
                (temp_offset, insert_position),
            )
            conn.execute(
                """
                INSERT INTO queue_items (
                    id, asset_id, position, enabled, timeout_seconds_override,
                    fit_mode, background_mode, background_color, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    item["id"],
                    item["asset_id"],
                    insert_position,
                    int(item.get("enabled", True)),
                    item.get("timeout_seconds_override"),
                    item.get("fit_mode", "cover"),
                    item.get("background_mode", "blur"),
                    item.get("background_color"),
                    item["created_at"],
                    item["updated_at"],
                ),
            )
            conn.execute(
                "UPDATE queue_items SET position = position - ? WHERE position >= ?",
                (temp_offset - 1, insert_position + temp_offset),
            )
        return self.get_item(item["id"])

    def update_item(self, queue_item_id: str, updates: dict[str, Any]):
        if not updates:
            return self.get_item(queue_item_id)
        assignments = ", ".join(f"{key} = ?" for key in updates.keys())
        params = list(updates.values()) + [queue_item_id]
        with self.database.connection() as conn:
            conn.execute(f"UPDATE queue_items SET {assignments} WHERE id = ?", params)
        return self.get_item(queue_item_id)

    def delete_item(self, queue_item_id: str):
        with self.database.connection() as conn:
            cursor = conn.execute("DELETE FROM queue_items WHERE id = ?", (queue_item_id,))
            deleted = cursor.rowcount > 0
        if deleted:
            self.normalize_positions()
        return deleted

    def clear_asset_references(self, asset_id: str):
        with self.database.connection() as conn:
            conn.execute("DELETE FROM queue_items WHERE asset_id = ?", (asset_id,))
        self.normalize_positions()

    def normalize_positions(self):
        items = self.list_items()
        with self.database.connection() as conn:
            for position, item in enumerate(items):
                conn.execute("UPDATE queue_items SET position = ? WHERE id = ?", (position, item["id"]))

    def reorder(self, ordered_ids: list[str]):
        existing_items = self.list_items()
        existing_ids = [item["id"] for item in existing_items]
        if len(ordered_ids) != len(existing_ids) or len(set(ordered_ids)) != len(ordered_ids):
            raise ValueError("Ordered queue item ids must match the existing queue exactly.")
        if set(existing_ids) != set(ordered_ids):
            raise ValueError("Ordered queue item ids must match the existing queue exactly.")
        with self.database.connection() as conn:
            temp_offset = len(ordered_ids)
            for position, queue_item_id in enumerate(ordered_ids):
                conn.execute(
                    "UPDATE queue_items SET position = ? WHERE id = ?",
                    (position + temp_offset, queue_item_id),
                )
            for position, queue_item_id in enumerate(ordered_ids):
                conn.execute(
                    "UPDATE queue_items SET position = ? WHERE id = ?",
                    (position, queue_item_id),
                )
