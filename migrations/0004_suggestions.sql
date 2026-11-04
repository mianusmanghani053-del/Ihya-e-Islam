-- Voice notes attached to suggestions. Stored in D1 (short, size-capped) so the
-- feature works without R2. One note per suggestion.
CREATE TABLE IF NOT EXISTS suggestion_audio(record_id TEXT PRIMARY KEY REFERENCES records(id) ON DELETE CASCADE,mime TEXT NOT NULL,size INTEGER NOT NULL,data BLOB NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
