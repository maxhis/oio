CREATE TABLE IF NOT EXISTS submission_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fingerprint_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_submission_attempts_fingerprint_created_at
ON submission_attempts (fingerprint_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_submission_attempts_created_at
ON submission_attempts (created_at DESC);
