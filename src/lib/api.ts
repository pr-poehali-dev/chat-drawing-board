const URLS = {
  auth: 'https://functions.poehali.dev/60443713-93a5-4bc4-b3fd-066c0222947f',
  room: 'https://functions.poehali.dev/64076ac9-a911-4ec2-9f31-130bbaaade70',
  game: 'https://functions.poehali.dev/42f33e77-9001-4d93-a64b-bcc07ed69135',
  chat: 'https://functions.poehali.dev/2952a8d2-ca47-4217-84e2-a419dbf6a247',
};

function getToken() {
  return localStorage.getItem('uno_token') || '';
}

async function post(fn: keyof typeof URLS, body: object) {
  const res = await fetch(URLS[fn], {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': getToken(),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data;
}

export const api = {
  auth: {
    register: (username: string, password: string, avatar: string) =>
      post('auth', { action: 'register', username, password, avatar }),
    login: (username: string, password: string) =>
      post('auth', { action: 'login', username, password }),
    me: () => post('auth', { action: 'me' }),
  },
  room: {
    create: () => post('room', { action: 'create' }),
    join: (code: string) => post('room', { action: 'join', code }),
    start: (room_id: number) => post('room', { action: 'start', room_id }),
    state: (code: string) => post('room', { action: 'state', code }),
  },
  game: {
    hand: (room_id: number) => post('game', { action: 'hand', room_id }),
    play: (room_id: number, card: object) => post('game', { action: 'play', room_id, card }),
    draw: (room_id: number) => post('game', { action: 'draw', room_id }),
  },
  chat: {
    poll: (room_id: number, after: number) =>
      post('chat', { action: 'poll', room_id, after }),
    send: (room_id: number, text: string) =>
      post('chat', { action: 'send', room_id, text }),
  },
};
