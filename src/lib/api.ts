const URLS = {
  auth: 'https://functions.poehali.dev/60443713-93a5-4bc4-b3fd-066c0222947f',
  room: 'https://functions.poehali.dev/64076ac9-a911-4ec2-9f31-130bbaaade70',
  game: 'https://functions.poehali.dev/42f33e77-9001-4d93-a64b-bcc07ed69135',
  chat: 'https://functions.poehali.dev/2952a8d2-ca47-4217-84e2-a419dbf6a247',
};

function getToken() {
  return localStorage.getItem('uno_token') || '';
}

async function req(fn: keyof typeof URLS, method: string, path: string, body?: object) {
  const url = URLS[fn] + path;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': getToken(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data;
}

export const api = {
  auth: {
    register: (username: string, password: string, avatar: string) =>
      req('auth', 'POST', '/register', { username, password, avatar }),
    login: (username: string, password: string) =>
      req('auth', 'POST', '/login', { username, password }),
    me: () => req('auth', 'GET', '/me', undefined),
  },
  room: {
    create: () => req('room', 'POST', '/create', {}),
    join: (code: string) => req('room', 'POST', '/join', { code }),
    start: (room_id: number) => req('room', 'POST', '/start', { room_id }),
    state: (code: string) => req('room', 'GET', `/state?code=${code}`, undefined),
  },
  game: {
    hand: (room_id: number) => req('game', 'GET', `/hand?room_id=${room_id}`, undefined),
    play: (room_id: number, card: object) => req('game', 'POST', '/play', { room_id, card }),
    draw: (room_id: number) => req('game', 'POST', '/draw', { room_id }),
  },
  chat: {
    poll: (room_id: number, after: number) =>
      req('chat', 'GET', `/poll?room_id=${room_id}&after=${after}`, undefined),
    send: (room_id: number, text: string) =>
      req('chat', 'POST', '/send', { room_id, text }),
  },
};
