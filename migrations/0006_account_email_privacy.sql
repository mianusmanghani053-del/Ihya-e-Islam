-- Private account addresses are omitted from directories and redacted for other viewers.
ALTER TABLE users ADD COLUMN email_private INTEGER NOT NULL DEFAULT 0;
