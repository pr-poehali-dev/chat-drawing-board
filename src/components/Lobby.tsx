import { useState } from 'react';
import { api } from '@/lib/api';
import Icon from '@/components/ui/icon';

interface User {
  id: number;
  username: string;
  avatar: string;
}

interface LobbyProps {
  user: User;
  onEnterRoom: (code: string, roomId: number) => void;
  onLogout: () => void;
}

export default function Lobby({ user, onEnterRoom, onLogout }: LobbyProps) {
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function createRoom() {
    setError('');
    setLoading('create');
    try {
      const data = await api.room.create();
      onEnterRoom(data.code, data.room_id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(null);
    }
  }

  async function joinRoom() {
    if (!joinCode.trim()) return;
    setError('');
    setLoading('join');
    try {
      const data = await api.room.join(joinCode.trim().toUpperCase());
      onEnterRoom(joinCode.trim().toUpperCase(), data.room_id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(null);
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
        width: 400,
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="text-2xl font-black" style={{ color: 'var(--uno-accent)' }}>UNO</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-lg">{user.avatar}</span>
              <span className="font-semibold text-sm" style={{ color: 'var(--uno-text)' }}>{user.username}</span>
            </div>
          </div>
          <button onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: 'var(--uno-surface2)', color: 'var(--uno-muted)', border: '1px solid var(--uno-border)', cursor: 'pointer' }}>
            <Icon name="LogOut" size={12} />
            Выйти
          </button>
        </div>

        {/* Create room */}
        <div className="mb-6">
          <div className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--uno-muted)' }}>
            Новая игра
          </div>
          <button onClick={createRoom} disabled={loading === 'create'}
            className="w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3"
            style={{
              background: 'linear-gradient(135deg, rgba(231,76,60,0.15), rgba(243,156,18,0.15))',
              border: '1.5px solid rgba(243,156,18,0.3)',
              color: 'var(--uno-accent)',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => !loading && (e.currentTarget.style.background = 'rgba(243,156,18,0.2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'linear-gradient(135deg, rgba(231,76,60,0.15), rgba(243,156,18,0.15))')}>
            {loading === 'create' ? '...' : <>
              <span className="text-2xl">🃏</span>
              Создать комнату
            </>}
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div style={{ flex: 1, height: 1, background: 'var(--uno-border)' }} />
          <span className="text-xs" style={{ color: 'var(--uno-muted)' }}>или</span>
          <div style={{ flex: 1, height: 1, background: 'var(--uno-border)' }} />
        </div>

        {/* Join room */}
        <div>
          <div className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--uno-muted)' }}>
            Войти по коду
          </div>
          <div className="flex gap-2">
            <input
              className="chat-input flex-1"
              placeholder="Код комнаты (напр. ABC123)"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && joinRoom()}
              maxLength={6}
              style={{ letterSpacing: '0.15em', fontSize: 15, fontWeight: 700 }}
            />
            <button onClick={joinRoom} disabled={!joinCode.trim() || loading === 'join'}
              style={{
                padding: '0 20px', borderRadius: 10, fontWeight: 700, fontSize: 14,
                background: joinCode.trim() ? 'var(--uno-accent)' : 'var(--uno-surface2)',
                color: joinCode.trim() ? 'var(--uno-dark)' : 'var(--uno-muted)',
                border: 'none', cursor: joinCode.trim() ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s', flexShrink: 0,
              }}>
              {loading === 'join' ? '...' : '→'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 text-sm text-center px-3 py-2 rounded-lg"
            style={{ background: 'rgba(231,76,60,0.12)', border: '1px solid rgba(231,76,60,0.3)', color: '#e74c3c' }}>
            {error}
          </div>
        )}

        <div className="mt-6 text-center text-xs" style={{ color: 'var(--uno-muted)' }}>
          Пригласи друзей — поделись кодом комнаты
        </div>
      </div>
    </div>
  );
}
