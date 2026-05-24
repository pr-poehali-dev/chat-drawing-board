import { useState } from 'react';
import { api } from '@/lib/api';

const AVATARS = ['😎','🦊','🦋','🐺','🐸','🦁','🐼','🦄','🐯','👾'];

interface AuthScreenProps {
  onAuth: (user: { id: number; username: string; avatar: string; token: string }) => void;
}

export default function AuthScreen({ onAuth }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState('😎');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let data;
      if (mode === 'register') {
        data = await api.auth.register(username, password, avatar);
      } else {
        data = await api.auth.login(username, password);
      }
      localStorage.setItem('uno_token', data.token);
      onAuth({ ...data, token: data.token });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center h-screen w-screen"
      style={{ background: 'var(--uno-dark)', fontFamily: "'Golos Text', sans-serif" }}>
      <div style={{
        background: 'var(--uno-surface)',
        border: '1.5px solid var(--uno-border)',
        borderRadius: 20,
        padding: '40px 36px',
        width: 380,
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl font-black mb-2" style={{
            background: 'linear-gradient(135deg, #e74c3c, #f39c12, #2980b9, #27ae60)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>UNO</div>
          <div className="text-sm font-medium" style={{ color: 'var(--uno-muted)' }}>Онлайн-игра с рисовалкой и чатом</div>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl p-1 mb-6" style={{ background: 'var(--uno-surface2)' }}>
          {(['login', 'register'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); }}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: mode === m ? 'var(--uno-accent)' : 'transparent',
                color: mode === m ? 'var(--uno-dark)' : 'var(--uno-muted)',
                border: 'none', cursor: 'pointer',
              }}>
              {m === 'login' ? 'Войти' : 'Регистрация'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--uno-muted)' }}>
              Имя игрока
            </label>
            <input
              className="chat-input w-full"
              placeholder="Введи имя (мин. 3 символа)"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--uno-muted)' }}>
              Пароль
            </label>
            <input
              className="chat-input w-full"
              type="password"
              placeholder="Введи пароль (мин. 4 символа)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--uno-muted)' }}>
                Выбери аватар
              </label>
              <div className="flex flex-wrap gap-2">
                {AVATARS.map(a => (
                  <button key={a} type="button" onClick={() => setAvatar(a)}
                    style={{
                      width: 40, height: 40, borderRadius: 10, fontSize: 20,
                      background: avatar === a ? 'rgba(243,156,18,0.15)' : 'var(--uno-surface2)',
                      border: `2px solid ${avatar === a ? 'var(--uno-accent)' : 'var(--uno-border)'}`,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="text-sm text-center px-3 py-2 rounded-lg"
              style={{ background: 'rgba(231,76,60,0.12)', border: '1px solid rgba(231,76,60,0.3)', color: '#e74c3c' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-base mt-1"
            style={{
              background: loading ? 'var(--uno-surface2)' : 'var(--uno-accent)',
              color: loading ? 'var(--uno-muted)' : 'var(--uno-dark)',
              border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
            }}>
            {loading ? '...' : mode === 'login' ? '→ Войти' : '→ Создать аккаунт'}
          </button>
        </form>
      </div>
    </div>
  );
}
