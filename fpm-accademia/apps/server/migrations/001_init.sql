-- FPM Accademia — schema iniziale (Fase B)
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL,
  password_hash text NOT NULL,
  display_name  text NOT NULL,
  role          text NOT NULL CHECK (role IN ('teacher', 'student')),
  is_adult      boolean NOT NULL,
  -- Tenant predisposto per il futuro multi-docente/scuola; oggi un solo tenant.
  tenant_id     text NOT NULL DEFAULT 'fpm',
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_uq ON users (lower(email));

CREATE TABLE consents (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('terms', 'privacy', 'recording', 'parental')),
  version    text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  PRIMARY KEY (user_id, kind, version)
);

CREATE TABLE sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   text NOT NULL UNIQUE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE teacher_profiles (
  user_id      uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  discipline   text,
  cover_preset text NOT NULL DEFAULT 'studio',
  bio          text NOT NULL DEFAULT '',
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE student_profiles (
  user_id    uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Solo l'hash SHA-256 del codice: il codice in chiaro si mostra una sola volta al docente.
  code_hash   text NOT NULL UNIQUE,
  code_hint   text NOT NULL,
  note        text NOT NULL DEFAULT '',
  max_uses    integer NOT NULL CHECK (max_uses BETWEEN 1 AND 30),
  uses        integer NOT NULL DEFAULT 0 CHECK (uses >= 0),
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (uses <= max_uses)
);
CREATE INDEX invitations_teacher_idx ON invitations (teacher_id);

CREATE TABLE teacher_student_links (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitation_id uuid REFERENCES invitations(id) ON DELETE SET NULL,
  status        text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'revoked')),
  requested_at  timestamptz NOT NULL DEFAULT now(),
  decided_at    timestamptz
);
-- Un allievo ha al massimo UN collegamento attivo (in attesa o approvato): vede solo il proprio docente.
CREATE UNIQUE INDEX links_one_active_per_student
  ON teacher_student_links (student_id) WHERE status IN ('pending', 'approved');
CREATE INDEX links_teacher_idx ON teacher_student_links (teacher_id, status);

CREATE TABLE lessons (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            text NOT NULL,
  starts_at        timestamptz NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 10 AND 240),
  notes            text NOT NULL DEFAULT '',
  status           text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'done')),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lessons_teacher_idx ON lessons (teacher_id, starts_at);
CREATE INDEX lessons_student_idx ON lessons (student_id, starts_at);

-- Preferenze per dispositivo: device_key è un id casuale generato dal browser, non un id hardware.
CREATE TABLE device_preferences (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_key           text NOT NULL,
  label                text NOT NULL DEFAULT '',
  audio_input_label    text,
  audio_output_label   text,
  video_input_label    text,
  midi_input_label     text,
  connection_type      text NOT NULL DEFAULT 'unknown',
  headphones_confirmed boolean NOT NULL DEFAULT false,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_key)
);

-- Prova docente: una sola per account, calcolata con l'orologio del database.
CREATE TABLE trials (
  teacher_id        uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  started_at        timestamptz NOT NULL DEFAULT now(),
  ends_at           timestamptz NOT NULL,
  demo_seconds_used integer NOT NULL DEFAULT 0
);

-- Licenza permanente una tantum: nessun rinnovo, nessuna scadenza.
CREATE TABLE licenses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id   uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  provider     text NOT NULL,
  provider_ref text NOT NULL,
  price_cents  integer NOT NULL,
  currency     text NOT NULL DEFAULT 'EUR',
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'refunded')),
  purchased_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_ref)
);
