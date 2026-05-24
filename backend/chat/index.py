"""
Чат и polling событий игры через action.
action=poll  — ?room_id=N&after=ID получить новые сообщения
action=send  — {room_id, text} отправить сообщение
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

        if action == 'poll':
            room_id = body.get('room_id') or params.get('room_id')
            after = int(body.get('after') or params.get('after') or 0)
            if not room_id:
                return err('Нет room_id')
            cur.execute(
                f"SELECT id, username, avatar, text, msg_type, created_at "
                f"FROM {SCHEMA}.chat_messages "
                f"WHERE room_id = %s AND id > %s ORDER BY id LIMIT 50",
                (room_id, after)
            )
            rows = cur.fetchall()
            messages = [
                {'id': r[0], 'username': r[1], 'avatar': r[2],
                 'text': r[3], 'type': r[4], 'time': r[5].strftime('%H:%M') if r[5] else ''}
                for r in rows
            ]
            return ok({'messages': messages})

        if not user:
            return err('Требуется авторизация', 401)
        user_id, username, avatar = user

        if action == 'send':
            room_id = body.get('room_id')
            text = (body.get('text') or '').strip()
            if not room_id or not text:
                return err('Нет room_id или text')
            if len(text) > 300:
                return err('Сообщение слишком длинное')
            cur.execute(
                f"INSERT INTO {SCHEMA}.chat_messages (room_id, user_id, username, avatar, text, msg_type) "
                f"VALUES (%s, %s, %s, %s, %s, 'chat') RETURNING id",
                (room_id, user_id, username, avatar, text)
            )
            msg_id = cur.fetchone()[0]
            conn.commit()
            return ok({'id': msg_id})

        return err('Неизвестное действие', 400)
    finally:
        cur.close()
        conn.close()
