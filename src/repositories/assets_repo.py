from typing import Any


class AssetsRepository:
    def __init__(self, database):
        self.database = database

    def create_asset(self, asset: dict[str, Any]):
        with self.database.connection() as conn:
            conn.execute(
                """
                INSERT INTO assets (
                    id, filename_original, filename_stored, mime_type, extension, checksum_sha256,
                    width, height, file_size_bytes, favorite, caption, source_type, created_at, updated_at, deleted_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    asset["id"],
                    asset["filename_original"],
                    asset["filename_stored"],
                    asset["mime_type"],
                    asset["extension"],
                    asset["checksum_sha256"],
                    asset["width"],
                    asset["height"],
                    asset["file_size_bytes"],
                    int(asset.get("favorite", False)),
                    asset.get("caption"),
                    asset["source_type"],
                    asset["created_at"],
                    asset["updated_at"],
                    asset.get("deleted_at"),
                ),
            )
        return self.get_asset(asset["id"])

    def create_variant(self, variant: dict[str, Any]):
        with self.database.connection() as conn:
            conn.execute(
                """
                INSERT INTO asset_variants (id, asset_id, kind, path, width, height, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    variant["id"],
                    variant["asset_id"],
                    variant["kind"],
                    variant["path"],
                    variant["width"],
                    variant["height"],
                    variant["created_at"],
                ),
            )

    def get_crop_profile(self, asset_id: str):
        with self.database.connection() as conn:
            row = conn.execute(
                """
                SELECT asset_id, crop_x, crop_y, crop_width, crop_height, updated_at
                FROM asset_crop_profiles
                WHERE asset_id = ?
                """,
                (asset_id,),
            ).fetchone()
        return dict(row) if row else None

    def upsert_crop_profile(self, crop_profile: dict[str, Any]):
        with self.database.connection() as conn:
            conn.execute(
                """
                INSERT INTO asset_crop_profiles (
                    asset_id, crop_x, crop_y, crop_width, crop_height, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(asset_id) DO UPDATE SET
                    crop_x = excluded.crop_x,
                    crop_y = excluded.crop_y,
                    crop_width = excluded.crop_width,
                    crop_height = excluded.crop_height,
                    updated_at = excluded.updated_at
                """,
                (
                    crop_profile["asset_id"],
                    crop_profile["crop_x"],
                    crop_profile["crop_y"],
                    crop_profile["crop_width"],
                    crop_profile["crop_height"],
                    crop_profile["updated_at"],
                ),
            )
        return self.get_crop_profile(crop_profile["asset_id"])

    def delete_crop_profile(self, asset_id: str):
        with self.database.connection() as conn:
            cursor = conn.execute("DELETE FROM asset_crop_profiles WHERE asset_id = ?", (asset_id,))
        return cursor.rowcount > 0

    def get_asset(self, asset_id: str):
        with self.database.connection() as conn:
            row = conn.execute(
                "SELECT * FROM assets WHERE id = ?",
                (asset_id,),
            ).fetchone()
        return dict(row) if row else None

    def get_asset_by_checksum(self, checksum: str):
        with self.database.connection() as conn:
            row = conn.execute(
                "SELECT * FROM assets WHERE checksum_sha256 = ? AND deleted_at IS NULL",
                (checksum,),
            ).fetchone()
        return dict(row) if row else None

    def list_assets(self, q=None, sort="uploaded_newest", favorite=None, limit=50, cursor=0):
        clauses = ["deleted_at IS NULL"]
        params: list[Any] = []

        if q:
            clauses.append("(filename_original LIKE ? OR COALESCE(caption, '') LIKE ?)")
            needle = f"%{q}%"
            params.extend([needle, needle])
        if favorite is not None:
            clauses.append("favorite = ?")
            params.append(1 if favorite else 0)

        order_by = {
            "uploaded_oldest": "created_at ASC, id ASC",
            "name_asc": "filename_original ASC, id ASC",
            "name_desc": "filename_original DESC, id DESC",
        }.get(sort, "created_at DESC, id DESC")

        with self.database.connection() as conn:
            rows = conn.execute(
                f"""
                SELECT * FROM assets
                WHERE {' AND '.join(clauses)}
                ORDER BY {order_by}
                LIMIT ? OFFSET ?
                """,
                (*params, limit + 1, cursor),
            ).fetchall()

        items = [dict(row) for row in rows[:limit]]
        next_cursor = cursor + limit if len(rows) > limit else None
        return items, next_cursor

    def list_variants(self, asset_id: str):
        with self.database.connection() as conn:
            rows = conn.execute(
                "SELECT * FROM asset_variants WHERE asset_id = ? ORDER BY kind ASC",
                (asset_id,),
            ).fetchall()
        return [dict(row) for row in rows]

    def get_variant(self, asset_id: str, kind: str):
        with self.database.connection() as conn:
            row = conn.execute(
                "SELECT * FROM asset_variants WHERE asset_id = ? AND kind = ?",
                (asset_id, kind),
            ).fetchone()
        return dict(row) if row else None

    def update_asset(self, asset_id: str, updates: dict[str, Any]):
        if not updates:
            return self.get_asset(asset_id)

        assignments = ", ".join(f"{key} = ?" for key in updates.keys())
        params = list(updates.values()) + [asset_id]
        with self.database.connection() as conn:
            conn.execute(
                f"UPDATE assets SET {assignments} WHERE id = ?",
                params,
            )
        return self.get_asset(asset_id)

    def delete_asset(self, asset_id: str):
        with self.database.connection() as conn:
            conn.execute("DELETE FROM assets WHERE id = ?", (asset_id,))
