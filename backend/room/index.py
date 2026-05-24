"""
Управление комнатами через action в теле или query.
action=create  — создать комнату
action=join    — {code} войти по коду
action=state   — ?code=XXX состояние комнаты
action=start   — {room_id} начать игру
"""
import os, json, random, string
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p20297638_chat_drawing_board')
CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
}
COLORS = ['red','blue','green','yellow']
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
    wilds = [{'color': 'wild', 'value': '🌈'}, {'color': 'wild', 'value': '+4'}]
    for w in wilds * 4:
        deck.append(w)
    random.shuffle(deck)
    return deck

def deal(deck, n=7):
    return deck[:n], deck[n:]

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
            code = body.get('code') or params.get('code', '')
            if not code:
                return err('Нет кода комнаты')
            cur.execute(
                f"SELECT r.id, r.code, r.status, r.direction, r.current_turn, r.discard_top, "
                f"u.username as host FROM {SCHEMA}.rooms r "
                f"JOIN {SCHEMA}.users u ON u.id = r.host_id WHERE r.code = %s",
                (code,)
            )
            room = cur.fetchone()
            if not room:
                return err('Комната не найдена', 404)
            room_id = room[0]
            cur.execute(
                f"SELECT u.id, u.username, u.avatar, rp.hand, rp.seat "
                f"FROM {SCHEMA}.room_players rp "
                f"JOIN {SCHEMA}.users u ON u.id = rp.user_id "
                f"WHERE rp.room_id = %s ORDER BY rp.seat",
                (room_id,)
            )
            players = cur.fetchall()
            return ok({
                'id': room_id, 'code': room[1], 'status': room[2],
                'direction': room[3], 'current_turn': room[4],
                'discard_top': room[5], 'host': room[6],
                'players': [
                    {'id': p[0], 'username': p[1], 'avatar': p[2],
                     'card_count': len(p[3]) if p[3] else 0, 'seat': p[4]}
                    for p in players
                ]
            })

        if not user:
            return err('Требуется авторизация', 401)
        user_id, username, avatar = user

        if action == 'create':
            code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
            deck = make_deck()
            hand, deck_rest = deal(deck)
            top = deck_rest.pop(0)
            while top['color'] == 'wild':
                deck_rest.append(top)
                top = deck_rest.pop(0)
            cur.execute(
                f"INSERT INTO {SCHEMA}.rooms (code, host_id, current_turn, deck, discard_top) "
                f"VALUES (%s, %s, %s, %s::jsonb, %s::jsonb) RETURNING id",
                (code, user_id, user_id, json.dumps(deck_rest), json.dumps(top))
            )
            room_id = cur.fetchone()[0]
            cur.execute(
                f"INSERT INTO {SCHEMA}.room_players (room_id, user_id, hand, seat) VALUES (%s, %s, %s::jsonb, 0)",
                (room_id, user_id, json.dumps(hand))
            )
            conn.commit()
            return ok({'code': code, 'room_id': room_id})

        if action == 'join':
            code = body.get('code', '').upper().strip()
            cur.execute(f"SELECT id, status, deck FROM {SCHEMA}.rooms WHERE code = %s", (code,))
            room = cur.fetchone()
            if not room:
                return err('Комната не найдена')
            if room[1] == 'playing':
                return err('Игра уже идёт')
            room_id = room[0]
            deck = room[2] if room[2] else []
            cur.execute(
                f"SELECT id FROM {SCHEMA}.room_players WHERE room_id = %s AND user_id = %s",
                (room_id, user_id)
            )
            if cur.fetchone():
                return ok({'code': code, 'room_id': room_id, 'rejoined': True})
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.room_players WHERE room_id = %s", (room_id,))
            seat = cur.fetchone()[0]
            if seat >= 4:
                return err('Комната заполнена (макс. 4)')
            hand, deck_rest = deal(list(deck))
            cur.execute(
                f"UPDATE {SCHEMA}.rooms SET deck = %s::jsonb WHERE id = %s",
                (json.dumps(deck_rest), room_id)
            )
            cur.execute(
                f"INSERT INTO {SCHEMA}.room_players (room_id, user_id, hand, seat) VALUES (%s, %s, %s::jsonb, %s)",
                (room_id, user_id, json.dumps(hand), seat)
            )
            conn.commit()
            return ok({'code': code, 'room_id': room_id})

        if action == 'start':
            room_id = body.get('room_id')
            cur.execute(f"SELECT host_id FROM {SCHEMA}.rooms WHERE id = %s", (room_id,))
            r = cur.fetchone()
            if not r or r[0] != user_id:
                return err('Только хост может начать игру', 403)
            cur.execute(f"UPDATE {SCHEMA}.rooms SET status = 'playing' WHERE id = %s", (room_id,))
            conn.commit()
            return ok({'started': True})

        return err('Неизвестное действие', 400)
    finally:
        cur.close()
        conn.close()
