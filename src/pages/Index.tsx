import { useState, useEffect, useRef } from 'react';
import AuthScreen from '@/components/AuthScreen';
import UnoTable from '@/components/UnoTable';
import DrawingCanvas from '@/components/DrawingCanvas';
import GameChat from '@/components/GameChat';
import { api } from '@/lib/api';

interface User {
  id: number;
  username: string;
  avatar: string;
  token: string;
}

export default function Index() {
  const [user, setUser] = useState<User | null>(null);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [topH, setTopH] = useState(58);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-login
  useEffect(() => {
    const token = localStorage.getItem('uno_token');
    if (!token) { setAuthChecked(true); return; }
    api.auth.me()
      .then((data) => { setUser({ ...data, token }); setAuthChecked(true); })
      .catch(() => { localStorage.removeItem('uno_token'); setAuthChecked(true); });
  }, []);

  // После авторизации — сразу join в единую комнату
  useEffect(() => {
    if (!user) return;
    api.room.join().then(data => setRoomId(data.room_id)).catch(() => {});
  }, [user]);

  // Ping каждые 5 сек + leave при уходе
  useEffect(() => {
    if (!user || !roomId) return;
    pingRef.current = setInterval(() => {
      api.room.ping().catch(() => {});
    }, 5000);

    const handleLeave = () => { api.room.leave().catch(() => {}); };
    window.addEventListener('beforeunload', handleLeave);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') handleLeave();
    });

    return () => {
      if (pingRef.current) clearInterval(pingRef.current);
      window.removeEventListener('beforeunload', handleLeave);
      handleLeave();
    };
  }, [user, roomId]);

  function handleAuth(u: User) { setUser(u); }

  function handleLogout() {
    api.room.leave().catch(() => {});
    localStorage.removeItem('uno_token');
    setUser(null);
    setRoomId(null);
  }

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setTopH(Math.min(80, Math.max(25, ((ev.clientY - rect.top) / rect.height) * 100)));
    };
    const onUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center h-screen w-screen"
        style={{ background: 'var(--uno-dark)', color: 'var(--uno-muted)', fontFamily: "'Golos Text', sans-serif" }}>
        Загрузка...
      </div>
    );
  }

  if (!user) return <AuthScreen onAuth={handleAuth} />;

  if (!roomId) {
    return (
      <div className="flex items-center justify-center h-screen w-screen"
        style={{ background: 'var(--uno-dark)', color: 'var(--uno-muted)', fontFamily: "'Golos Text', sans-serif" }}>
        Подключение к игре...
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden"
      style={{ background: 'var(--uno-dark)', fontFamily: "'Golos Text', sans-serif" }}>
      <div ref={containerRef} className="flex flex-col" style={{ flex: 1, minWidth: 0 }}>
        <div style={{ height: `${topH}%`, minHeight: 0, overflow: 'hidden' }}>
          <UnoTable
            roomId={roomId}
            userId={user.id}
            username={user.username}
            avatar={user.avatar}
            onLogout={handleLogout}
          />
        </div>

        <div onMouseDown={startDrag}
          style={{
            height: 6, cursor: 'row-resize', flexShrink: 0,
            background: 'var(--uno-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            userSelect: 'none',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--uno-muted)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--uno-border)')}>
          <div style={{ width: 40, height: 3, borderRadius: 2, background: 'var(--uno-muted)', opacity: 0.5 }} />
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <DrawingCanvas />
        </div>
      </div>

      <div style={{ width: 300, flexShrink: 0 }}>
        <GameChat
          roomId={roomId}
          userId={user.id}
          username={user.username}
          avatar={user.avatar}
        />
      </div>
    </div>
  );
}
