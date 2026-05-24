"""
Игровые действия через action.
action=hand  — посмотреть свои карты (?room_id=N)
action=draw  — {room_id} взять карту из колоды
action=play  — {room_id, card} сыграть карту
"""
import os, json
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p20297638_chat_drawing_board')
CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
}

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

def next_turn(cur, room_id, current_user_id):
    cur.execute(
        f"SELECT user_id FROM {SCHEMA}.room_players WHERE room_id = %s ORDER BY seat",
        (room_id,)
    )
    players = cur.fetchall()
    cur.execute(f"SELECT direction FROM {SCHEMA}.rooms WHERE id = %s", (room_id,))
    direction = cur.fetchone()[0]
    ids = [p[0] for p in players]
    if current_user_id not in ids:
        return ids[0]
    idx = ids.index(current_user_id)
    step = 1 if direction == 'cw' else -1
    return ids[(idx + step) % len(ids)]

def add_msg(cur, room_id, text, msg_type='move'):
    cur.execute(
        f"INSERT INTO {SCHEMA}.chat_messages (room_id, username, avatar, text, msg_type) "
        f"VALUES (%s, 'Система', '🎮', %s, %s)",
        (room_id, text, msg_type)
    )

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
        if not user:
            return err('Требуется авторизация', 401)
        user_id, username, avatar = user

        if action == 'hand':
            room_id = body.get('room_id') or params.get('room_id')
            cur.execute(
                f"SELECT hand FROM {SCHEMA}.room_players WHERE room_id = %s AND user_id = %s",
                (room_id, user_id)
            )
            row = cur.fetchone()
            if not row:
                return err('Не в комнате', 404)
            return ok({'hand': row[0] or []})

        room_id = body.get('room_id')

        if action == 'draw':
            cur.execute(
                f"SELECT deck, current_turn, status FROM {SCHEMA}.rooms WHERE id = %s",
                (room_id,)
            )
            room = cur.fetchone()
            if not room:
                return err('Комната не найдена', 404)
            if room[2] != 'playing':
                return err('Игра не идёт')
            if room[1] != user_id:
                return err('Не твой ход')
            deck = list(room[0]) if room[0] else []
            if not deck:
                return err('Колода пуста')
            card = deck.pop(0)
            cur.execute(
                f"SELECT hand FROM {SCHEMA}.room_players WHERE room_id = %s AND user_id = %s",
                (room_id, user_id)
            )
            hand = list(cur.fetchone()[0] or [])
            hand.append(card)
            cur.execute(
                f"UPDATE {SCHEMA}.room_players SET hand = %s::jsonb WHERE room_id = %s AND user_id = %s",
                (json.dumps(hand), room_id, user_id)
            )
            cur.execute(
                f"UPDATE {SCHEMA}.rooms SET deck = %s::jsonb, current_turn = %s WHERE id = %s",
                (json.dumps(deck), next_turn(cur, room_id, user_id), room_id)
            )
            add_msg(cur, room_id, f'{avatar} {username} взял карту из колоды', 'draw')
            conn.commit()
            return ok({'drew': card})

        if action == 'play':
            card = body.get('card')
            if not card:
                return err('Не указана карта')
            cur.execute(
                f"SELECT discard_top, current_turn, direction, status, deck FROM {SCHEMA}.rooms WHERE id = %s",
                (room_id,)
            )
            room = cur.fetchone()
            if not room:
                return err('Комната не найдена', 404)
            if room[3] != 'playing':
                return err('Игра не идёт')
            if room[1] != user_id:
                return err('Не твой ход')
            top = room[0] or {}
            if card['color'] != 'wild' and card['color'] != top.get('color') and card['value'] != top.get('value'):
                return err('Карту нельзя положить на эту карту')
            cur.execute(
                f"SELECT hand FROM {SCHEMA}.room_players WHERE room_id = %s AND user_id = %s",
                (room_id, user_id)
            )
            hand = list(cur.fetchone()[0] or [])
            removed = False
            for i, c in enumerate(hand):
                if c.get('color') == card['color'] and c.get('value') == card['value']:
                    hand.pop(i)
                    removed = True
                    break
            if not removed:
                return err('У тебя нет такой карты')

            direction = room[2]
            deck = list(room[4]) if room[4] else []
            skip_turn = False

            if card['value'] == '↩':
                direction = 'ccw' if direction == 'cw' else 'cw'
            elif card['value'] == '⬚':
                skip_turn = True
            elif card['value'] in ('+2', '+4'):
                nt = next_turn(cur, room_id, user_id)
                cur.execute(
                    f"SELECT hand FROM {SCHEMA}.room_players WHERE room_id = %s AND user_id = %s",
                    (room_id, nt)
                )
                nt_hand = list((cur.fetchone() or ([],))[0] or [])
                count = 2 if card['value'] == '+2' else 4
                for _ in range(count):
                    if deck:
                        nt_hand.append(deck.pop(0))
                cur.execute(
                    f"UPDATE {SCHEMA}.room_players SET hand = %s::jsonb WHERE room_id = %s AND user_id = %s",
                    (json.dumps(nt_hand), room_id, nt)
                )
                skip_turn = True

            cur.execute(
                f"UPDATE {SCHEMA}.room_players SET hand = %s::jsonb WHERE room_id = %s AND user_id = %s",
                (json.dumps(hand), room_id, user_id)
            )
            nt = next_turn(cur, room_id, user_id)
            if skip_turn:
                nt = next_turn(cur, room_id, nt)
            cur.execute(
                f"UPDATE {SCHEMA}.rooms SET discard_top = %s::jsonb, current_turn = %s, "
                f"direction = %s, deck = %s::jsonb WHERE id = %s",
                (json.dumps(card), nt, direction, json.dumps(deck), room_id)
            )
            msg = f'{avatar} {username} положил {card["value"]} ({card["color"]})'
            if len(hand) == 1:
                msg += ' — UNO! ⚡'
            if len(hand) == 0:
                msg = f'🎉 {avatar} {username} выиграл!'
                cur.execute(f"UPDATE {SCHEMA}.rooms SET status = 'finished' WHERE id = %s", (room_id,))
            add_msg(cur, room_id, msg, 'move')
            conn.commit()
            return ok({'played': card, 'cards_left': len(hand)})

        return err('Неизвестное действие', 400)
    finally:
        cur.close()
        conn.close()
