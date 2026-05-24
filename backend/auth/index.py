"""
Регистрация, вход и проверка сессии.
POST /register — {username, password, avatar}
POST /login    — {username, password}
GET  /me       — проверка токена (X-Auth-Token)
"""
import os, json, hashlib, secrets
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p20297638_chat_drawing_board')
CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
}

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def hash_pw(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()

def ok(data):
    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(data, ensure_ascii=False)}

def err(msg, code=400):
    return {'statusCode': code, 'headers': CORS, 'body': json.dumps({'error': msg}, ensure_ascii=False)}

def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    path = event.get('path', '/')

    conn = get_conn()
    cur = conn.cursor()

    try:
        # GET /me — проверка токена
        if method == 'GET' and '/me' in path:
            token = event.get('headers', {}).get('X-Auth-Token', '')
            if not token:
                return err('Нет токена', 401)
            cur.execute(
                f"SELECT u.id, u.username, u.avatar FROM {SCHEMA}.sessions s "
                f"JOIN {SCHEMA}.users u ON u.id = s.user_id WHERE s.token = %s",
                (token,)
            )
            row = cur.fetchone()
            if not row:
                return err('Сессия не найдена', 401)
            return ok({'id': row[0], 'username': row[1], 'avatar': row[2]})

        body = json.loads(event.get('body') or '{}')

        # POST /register
        if method == 'POST' and '/register' in path:
            username = (body.get('username') or '').strip()
            password = body.get('password', '')
            avatar = body.get('avatar', '😎')
            if len(username) < 3:
                return err('Имя минимум 3 символа')
            if len(password) < 4:
                return err('Пароль минимум 4 символа')
            cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE username = %s", (username,))
            if cur.fetchone():
                return err('Имя уже занято')
            cur.execute(
                f"INSERT INTO {SCHEMA}.users (username, password_hash, avatar) VALUES (%s, %s, %s) RETURNING id",
                (username, hash_pw(password), avatar)
            )
            user_id = cur.fetchone()[0]
            token = secrets.token_hex(32)
            cur.execute(f"INSERT INTO {SCHEMA}.sessions (token, user_id) VALUES (%s, %s)", (token, user_id))
            conn.commit()
            return ok({'token': token, 'id': user_id, 'username': username, 'avatar': avatar})

        # POST /login
        if method == 'POST' and '/login' in path:
            username = (body.get('username') or '').strip()
            password = body.get('password', '')
            cur.execute(
                f"SELECT id, avatar FROM {SCHEMA}.users WHERE username = %s AND password_hash = %s",
                (username, hash_pw(password))
            )
            row = cur.fetchone()
            if not row:
                return err('Неверное имя или пароль', 401)
            token = secrets.token_hex(32)
            cur.execute(f"INSERT INTO {SCHEMA}.sessions (token, user_id) VALUES (%s, %s)", (token, row[0]))
            conn.commit()
            return ok({'token': token, 'id': row[0], 'username': username, 'avatar': row[1]})

        return err('Не найдено', 404)
    finally:
        cur.close()
        conn.close()
