-- Run this corrected SQL in Supabase → SQL Editor → New query → Run

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  host_user_id INTEGER,
  video_id TEXT DEFAULT '',
  "current_time" REAL DEFAULT 0,
  is_playing BOOLEAN DEFAULT FALSE,
  background_play BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_members (
  id SERIAL PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id INTEGER,
  username TEXT NOT NULL,
  is_host BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  room_id TEXT NOT NULL,
  last_visited TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, room_id)
);

CREATE TABLE IF NOT EXISTS queue (
  id SERIAL PRIMARY KEY,
  room_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  video_title TEXT,
  "position" INTEGER DEFAULT 0,
  added_at TIMESTAMPTZ DEFAULT NOW()
);
