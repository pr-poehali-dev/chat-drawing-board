"""
Единая глобальная комната. Все игроки попадают в одну игру.
action=join    — войти в глобальную комнату (создаётся если нет)
action=state   — состояние комнаты
action=start   — начать игру (если 2+ онлайн игроков)
action=ping    — heartbeat присутствия (каждые 5 сек с фронтенда)
action=leave   — покинуть комнату
"""
import os, json, random
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p20297638_chat_drawing_board')
ROOM_CODE = 'GLOBAL'
TURN_TIMEOUT = 10  # секунд до авто-хода
ONLINE_TIMEOUT = 15  # секунд без пинга — считается офлайн

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
}
COLORS = ['red', 'blue', 'green', 'yellow']
VALUES = ['0','1','2','3','4','5','6','7','8','9','+2','⬚','↩']

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def ok(data):
    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(data, ensure_ascii=False, default=str)}

def err(msg, code=400):
    return {'statusCode': code, 'headers': CORS, 'body': json.dumps({'error': msg}, ensure_ascii=False)}

def get_user(cur, token):
    cur.execute(
        f"SELECT u.id, u.username, u.avatar FROM {SCHEMA}.sessions s "
        f"JOIN {SCHEMA}.users u ON u.id = s.user_id WHERE s.token = %s",
        (token,)
    )
    return cur.fetchone()

def make_deck():
    deck = []
    for color in COLORS:
        for val in VALUES:
            deck.append({'color': color, 'value': val})
            if val != '0':
                deck.append({'color': color, 'value': val})
    for _ in range(4):
        deck.append({'color': 'wild', 'value': '🌈'})
        deck.append({'color': 'wild', 'value': '+4'})
    random.shuffle(deck)
    return deck

def deal(deck, n=7):
    return deck[:n], deck[n:]

def get_or_create_room(cur, conn):
    cur.execute(f"SELECT id, status FROM {SCHEMA}.rooms WHERE code = %s", (ROOM_CODE,))
    row = cur.fetchone()
    if row:
        return row[0], row[1]
    deck = make_deck()
    top = deck.pop(0)
    while top['color'] == 'wild':
        deck.append(top)
        top = deck.pop(0)
    cur.execute(
        f"INSERT INTO {SCHEMA}.rooms (code, host_id, current_turn, deck, discard_top, status) "
        f"VALUES (%s, 1, NULL, %s::jsonb, %s::jsonb, 'waiting') RETURNING id",
        (ROOM_CODE, json.dumps(deck), json.dumps(top))
    )
    room_id = cur.fetchone()[0]
    conn.commit()
    return room_id, 'waiting'

def next_turn_id(cur, room_id, current_user_id):
    cur.execute(
        f"SELECT user_id FROM {SCHEMA}.room_players WHERE room_id = %s "
        f"AND last_seen > NOW() - INTERVAL '{ONLINE_TIMEOUT} seconds' ORDER BY seat",
        (room_id,)
    )
    players = [p[0] for p in cur.fetchall()]
    if not players:
        return current_user_id
    cur.execute(f"SELECT direction FROM {SCHEMA}.rooms WHERE id = %s", (room_id,))
    direction = cur.fetchone()[0]
    if current_user_id not in players:
        return players[0]
    idx = players.index(current_user_id)
    step = 1 if direction == 'cw' else -1
    return players[(idx + step) % len(players)]

def add_msg(cur, room_id, text, msg_type='move'):
    cur.execute(
        f"INSERT INTO {SCHEMA}.chat_messages (room_id, username, avatar, text, msg_type) "
        f"VALUES (%s, 'Система', '🎮', %s, %s)",
        (room_id, text, msg_type)
    )

def check_auto_draw(cur, conn, room_id):
    """Если текущий игрок не ходил 10 сек — берёт карту и пропускает ход."""
    cur.execute(
        f"SELECT current_turn, turn_started_at, status, deck FROM {SCHEMA}.rooms WHERE id = %s",
        (room_id,)
    )
    room = cur.fetchone()
    if not room or room[2] != 'playing' or not room[1] or not room[0]:
        return
    import datetime
    elapsed = (datetime.datetime.now(datetime.timezone.utc) - room[1]).total_seconds()
    if elapsed < TURN_TIMEOUT:
        return
    player_id = room[0]
    cur.execute(
        f"SELECT u.username, u.avatar FROM {SCHEMA}.users u WHERE u.id = %s",
        (player_id,)
    )
    pu = cur.fetchone()
    if not pu:
        return
    pname, pavatar = pu
    deck = list(room[3]) if room[3] else []
    if deck:
        card = deck.pop(0)
        cur.execute(
            f"SELECT hand FROM {SCHEMA}.room_players WHERE room_id = %s AND user_id = %s",
            (room_id, player_id)
        )
        row = cur.fetchone()
        hand = list(row[0] or []) if row else []
        hand.append(card)
        cur.execute(
            f"UPDATE {SCHEMA}.room_players SET hand = %s::jsonb WHERE room_id = %s AND user_id = %s",
            (json.dumps(hand), room_id, player_id)
        )
        cur.execute(
            f"UPDATE {SCHEMA}.rooms SET deck = %s::jsonb WHERE id = %s",
            (json.dumps(deck), room_id)
        )
    nt = next_turn_id(cur, room_id, player_id)
    cur.execute(
        f"UPDATE {SCHEMA}.rooms SET current_turn = %s, turn_started_at = NOW() WHERE id = %s",
        (nt, room_id)
    )
    add_msg(cur, room_id, f'⏱ {pavatar} {pname} не успел — взял карту и пропустил ход', 'move')
    conn.commit()

def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    params = event.get('queryStringParameters') or {}
    body = json.loads(event.get('body') or '{}')
    action = body.get('action') or params.get('action', '')
    token = (event.get('headers') or {}).get('X-Auth-Token', '')

    conn = get_conn()
    cur = conn.cursor()

    try:
        user = get_user(cur, token) if token else None

        if action == 'state':
            room_id, status = get_or_create_room(cur, conn)
            # Проверяем авто-ход
            check_auto_draw(cur, conn, room_id)
            cur.execute(
                f"SELECT r.direction, r.current_turn, r.discard_top, r.turn_started_at "
                f"FROM {SCHEMA}.rooms r WHERE r.id = %s",
                (room_id,)
            )
            room = cur.fetchone()
            cur.execute(
                f"SELECT u.id, u.username, u.avatar, rp.hand, rp.seat, rp.last_seen "
                f"FROM {SCHEMA}.room_players rp "
                f"JOIN {SCHEMA}.users u ON u.id = rp.user_id "
                f"WHERE rp.room_id = %s ORDER BY rp.seat",
                (room_id,)
            )
            players = cur.fetchall()
            import datetime
            now = datetime.datetime.now(datetime.timezone.utc)
            online_players = []
            all_players = []
            for p in players:
                ls = p[5]
                is_online = ls and (now - ls).total_seconds() < ONLINE_TIMEOUT
                all_players.append({
                    'id': p[0], 'username': p[1], 'avatar': p[2],
                    'card_count': len(p[3]) if p[3] else 0,
                    'seat': p[4], 'online': is_online
                })
                if is_online:
                    online_players.append(p[0])

            cur.execute(f"SELECT status FROM {SCHEMA}.rooms WHERE id = %s", (room_id,))
            status = cur.fetchone()[0]
            ts = room[3]
            turn_elapsed = (now - ts).total_seconds() if ts else 0

            return ok({
                'id': room_id,
                'code': ROOM_CODE,
                'status': status,
                'direction': room[0],
                'current_turn': room[1],
                'discard_top': room[2],
                'players': all_players,
                'online_count': len(online_players),
                'turn_elapsed': int(turn_elapsed),
                'turn_timeout': TURN_TIMEOUT,
            })

        if not user:
            return err('Требуется авторизация', 401)
        user_id, username, avatar = user

        room_id, status = get_or_create_room(cur, conn)

        if action == 'ping':
            cur.execute(
                f"INSERT INTO {SCHEMA}.room_players (room_id, user_id, hand, seat, last_seen) "
                f"VALUES (%s, %s, '[]'::jsonb, 0, NOW()) "
                f"ON CONFLICT (room_id, user_id) DO UPDATE SET last_seen = NOW()",
                (room_id, user_id)
            )
            # Пересчитываем seat
            cur.execute(
                f"SELECT user_id FROM {SCHEMA}.room_players WHERE room_id = %s ORDER BY joined_at",
                (room_id,)
            )
            all_ids = [r[0] for r in cur.fetchall()]
            for i, uid in enumerate(all_ids):
                cur.execute(
                    f"UPDATE {SCHEMA}.room_players SET seat = %s WHERE room_id = %s AND user_id = %s",
                    (i, room_id, uid)
                )
            conn.commit()
            return ok({'ok': True, 'room_id': room_id})

        if action == 'leave':
            cur.execute(
                f"UPDATE {SCHEMA}.room_players SET last_seen = NOW() - INTERVAL '60 seconds' "
                f"WHERE room_id = %s AND user_id = %s",
                (room_id, user_id)
            )
            add_msg(cur, room_id, f'{avatar} {username} вышел из игры', 'system')
            conn.commit()
            return ok({'ok': True})

        if action == 'join':
            cur.execute(
                f"SELECT id FROM {SCHEMA}.room_players WHERE room_id = %s AND user_id = %s",
                (room_id, user_id)
            )
            if not cur.fetchone():
                cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.room_players WHERE room_id = %s", (room_id,))
                seat = cur.fetchone()[0]
                cur.execute(
                    f"INSERT INTO {SCHEMA}.room_players (room_id, user_id, hand, seat, last_seen) "
                    f"VALUES (%s, %s, '[]'::jsonb, %s, NOW())",
                    (room_id, user_id, seat)
                )
                add_msg(cur, room_id, f'{avatar} {username} присоединился к игре', 'system')
            else:
                cur.execute(
                    f"UPDATE {SCHEMA}.room_players SET last_seen = NOW() WHERE room_id = %s AND user_id = %s",
                    (room_id, user_id)
                )
            conn.commit()
            return ok({'room_id': room_id, 'code': ROOM_CODE})

        if action == 'start':
            # Считаем онлайн-игроков
            cur.execute(
                f"SELECT COUNT(*) FROM {SCHEMA}.room_players "
                f"WHERE room_id = %s AND last_seen > NOW() - INTERVAL '{ONLINE_TIMEOUT} seconds'",
                (room_id,)
            )
            online = cur.fetchone()[0]
            if online < 2:
                return err('Нужно минимум 2 онлайн-игрока')
            # Раздаём карты онлайн-игрокам
            deck = make_deck()
            top = deck.pop(0)
            while top['color'] == 'wild':
                deck.append(top)
                top = deck.pop(0)
            cur.execute(
                f"SELECT user_id FROM {SCHEMA}.room_players "
                f"WHERE room_id = %s AND last_seen > NOW() - INTERVAL '{ONLINE_TIMEOUT} seconds' ORDER BY seat",
                (room_id,)
            )
            online_players = [r[0] for r in cur.fetchall()]
            for uid in online_players:
                hand, deck = deal(deck)
                cur.execute(
                    f"UPDATE {SCHEMA}.room_players SET hand = %s::jsonb WHERE room_id = %s AND user_id = %s",
                    (json.dumps(hand), room_id, uid)
                )
            first_player = online_players[0]
            cur.execute(
                f"UPDATE {SCHEMA}.rooms SET status = 'playing', current_turn = %s, "
                f"deck = %s::jsonb, discard_top = %s::jsonb, turn_started_at = NOW(), direction = 'cw' WHERE id = %s",
                (first_player, json.dumps(deck), json.dumps(top), room_id)
            )
            add_msg(cur, room_id, f'🎮 Игра началась! Играют {len(online_players)} человек', 'system')
            conn.commit()
            return ok({'started': True})

        return err('Неизвестное действие', 400)
    finally:
        cur.close()
        conn.close()
