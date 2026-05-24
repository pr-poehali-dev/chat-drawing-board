
ALTER TABLE t_p20297638_chat_drawing_board.rooms
  ADD COLUMN IF NOT EXISTS turn_started_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE t_p20297638_chat_drawing_board.room_players
  ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NOW();
