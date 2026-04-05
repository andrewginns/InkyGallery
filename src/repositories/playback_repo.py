class PlaybackRepository:
    def __init__(self, database):
        self.database = database

    def get_settings(self):
        with self.database.connection() as conn:
            row = conn.execute("SELECT * FROM playback_settings WHERE id = 1").fetchone()
        data = dict(row)
        data["loop_enabled"] = bool(data["loop_enabled"])
        data["shuffle_enabled"] = bool(data["shuffle_enabled"])
        data["auto_advance_enabled"] = bool(data["auto_advance_enabled"])
        return data

    def update_settings(self, updates: dict):
        assignments = ", ".join(f"{key} = ?" for key in updates.keys())
        params = list(updates.values()) + [1]
        with self.database.connection() as conn:
            conn.execute(f"UPDATE playback_settings SET {assignments} WHERE id = ?", params)
        return self.get_settings()

    def get_state(self):
        with self.database.connection() as conn:
            row = conn.execute("SELECT * FROM playback_state WHERE id = 1").fetchone()
        return dict(row)

    def update_state(self, updates: dict):
        assignments = ", ".join(f"{key} = ?" for key in updates.keys())
        params = list(updates.values()) + [1]
        with self.database.connection() as conn:
            conn.execute(f"UPDATE playback_state SET {assignments} WHERE id = ?", params)
        return self.get_state()

