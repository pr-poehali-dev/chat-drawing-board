
CREATE TABLE IF NOT EXISTS t_p20297638_chat_drawing_board.users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(32) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar VARCHAR(8) DEFAULT '😎',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p20297638_chat_drawing_board.sessions (
  token TEXT PRIMARY KEY,
  user_id INT NOT NULL REFERENCES t_p20297638_chat_drawing_board.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p20297638_chat_drawing_board.rooms (
  id SERIAL PRIMARY KEY,
  code VARCHAR(8) UNIQUE NOT NULL,
  host_id INT NOT NULL REFERENCES t_p20297638_chat_drawing_board.users(id),
  status VARCHAR(16) DEFAULT 'waiting',
  direction VARCHAR(4) DEFAULT 'cw',
  current_turn INT REFERENCES t_p20297638_chat_drawing_board.users(id),
  deck JSONB DEFAULT '[]',
  discard_top JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p20297638_chat_drawing_board.room_players (
  id SERIAL PRIMARY KEY,
  room_id INT NOT NULL REFERENCES t_p20297638_chat_drawing_board.rooms(id),
  user_id INT NOT NULL REFERENCES t_p20297638_chat_drawing_board.users(id),
  hand JSONB DEFAULT '[]',
  seat INT NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

CREATE TABLE IF NOT EXISTS t_p20297638_chat_drawing_board.chat_messages (
  id SERIAL PRIMARY KEY,
  room_id INT NOT NULL REFERENCES t_p20297638_chat_drawing_board.rooms(id),
  user_id INT REFERENCES t_p20297638_chat_drawing_board.users(id),
  username VARCHAR(32),
  avatar VARCHAR(8),
  text TEXT NOT NULL,
  msg_type VARCHAR(16) DEFAULT 'chat',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON t_p20297638_chat_drawing_board.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_room_players_room ON t_p20297638_chat_drawing_board.room_players(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_room ON t_p20297638_chat_drawing_board.chat_messages(room_id, created_at);
