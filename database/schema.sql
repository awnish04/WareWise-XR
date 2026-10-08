-- ============================================================
-- WareWise XR  –  Neon Postgres schema  (v8)
-- Tables: admins | trainees | sessions | trainee_leaderboard
--         | leaderboard | access_events
-- Run via:  npm run migrate
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ──────────────────────────────────────────────────────────────
-- admins
-- Stores administrator accounts only.
-- Email is stored as a plain, real email string.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  email         TEXT        NOT NULL UNIQUE,
  department    TEXT        NOT NULL DEFAULT 'Safety & Training',
  password_hash TEXT        NOT NULL,
  password_salt TEXT        NOT NULL,
  access_count  INTEGER     NOT NULL DEFAULT 0,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- trainees
-- Stores employee / trainee accounts.
-- Status: pending → approved → (rejected)
-- Email is stored as a plain, real email string.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trainees (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  email         TEXT        NOT NULL UNIQUE,
  department    TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'approved', 'rejected')),
  password_hash TEXT        NOT NULL,
  password_salt TEXT        NOT NULL,
  access_count  INTEGER     NOT NULL DEFAULT 0,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at   TIMESTAMPTZ,
  rejected_at   TIMESTAMPTZ,
  approved_by   UUID        REFERENCES admins(id) ON DELETE SET NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- sessions
-- Shared session table for both admins and trainees.
-- Exactly one of admin_id / trainee_id must be set per row.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     UUID        REFERENCES admins(id)   ON DELETE CASCADE,
  trainee_id   UUID        REFERENCES trainees(id) ON DELETE CASCADE,
  token_hash   TEXT        NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sessions_one_owner CHECK (
    (admin_id IS NOT NULL AND trainee_id IS NULL) OR
    (admin_id IS NULL     AND trainee_id IS NOT NULL)
  )
);

-- ──────────────────────────────────────────────────────────────
-- trainee_leaderboard
-- Training progress and best scores per trainee.
-- (replaces training_progress)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trainee_leaderboard (
  trainee_id      UUID        PRIMARY KEY REFERENCES trainees(id) ON DELETE CASCADE,
  current_state   JSONB       NOT NULL DEFAULT '{}',
  best_score      INTEGER     NOT NULL DEFAULT 0,
  best_completion INTEGER     NOT NULL DEFAULT 0,  -- percentage 0-100
  attempts        INTEGER     NOT NULL DEFAULT 0,
  last_started_at TIMESTAMPTZ,
  last_played_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- leaderboard
-- Dedicated snapshot leaderboard table.
-- Rebuilt / refreshed whenever a training session saves progress.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leaderboard (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trainee_id      UUID        NOT NULL REFERENCES trainees(id) ON DELETE CASCADE,
  trainee_name    TEXT        NOT NULL,
  trainee_email   TEXT        NOT NULL,
  department      TEXT        NOT NULL DEFAULT '',
  best_score      INTEGER     NOT NULL DEFAULT 0,
  best_completion INTEGER     NOT NULL DEFAULT 0,
  total_attempts  INTEGER     NOT NULL DEFAULT 0,
  total_logins    INTEGER     NOT NULL DEFAULT 0,
  last_played_at  TIMESTAMPTZ,
  last_login_at   TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (trainee_id)
);

-- ──────────────────────────────────────────────────────────────
-- access_events
-- Full audit trail for logins, approvals, and training events.
-- Stores a snapshot of the actor email + role so records remain
-- readable even if the account is later deleted.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS access_events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- actor identity (one will be NULL depending on who triggered the event)
  admin_id      UUID        REFERENCES admins(id)   ON DELETE SET NULL,
  trainee_id    UUID        REFERENCES trainees(id) ON DELETE SET NULL,
  actor_email   TEXT,         -- snapshot of email at event time
  actor_role    TEXT        CHECK (actor_role IN ('admin', 'trainee')),
  event_type    TEXT        NOT NULL CHECK (event_type IN (
                  'login',
                  'logout',
                  'access_request',
                  'request_resubmitted',
                  'approval',
                  'rejection',
                  'training_started',
                  'training_progress_saved',
                  'training_progress_reset'
                )),
  event_details JSONB       NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- Indexes
-- ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS admins_email_idx
  ON admins (email);

CREATE INDEX IF NOT EXISTS trainees_email_idx
  ON trainees (email);

CREATE INDEX IF NOT EXISTS trainees_status_idx
  ON trainees (status);

CREATE INDEX IF NOT EXISTS sessions_admin_idx
  ON sessions (admin_id);

CREATE INDEX IF NOT EXISTS sessions_trainee_idx
  ON sessions (trainee_id);

CREATE INDEX IF NOT EXISTS sessions_expires_idx
  ON sessions (expires_at);

CREATE INDEX IF NOT EXISTS trainee_leaderboard_score_idx
  ON trainee_leaderboard (best_score DESC, best_completion DESC);

CREATE INDEX IF NOT EXISTS leaderboard_score_idx
  ON leaderboard (best_score DESC, best_completion DESC);

CREATE INDEX IF NOT EXISTS access_events_admin_idx
  ON access_events (admin_id, created_at DESC);

CREATE INDEX IF NOT EXISTS access_events_trainee_idx
  ON access_events (trainee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS access_events_type_idx
  ON access_events (event_type, created_at DESC);
