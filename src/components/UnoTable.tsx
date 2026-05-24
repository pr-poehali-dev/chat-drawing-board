import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

interface Card {
  color: 'red' | 'blue' | 'green' | 'yellow' | 'wild';
  value: string;
}

interface RoomPlayer {
  id: number;
  username: string;
  avatar: string;
  card_count: number;
  seat: number;
}

interface RoomState {
  id: number;
  code: string;
  status: string;
  direction: string;
  current_turn: number;
  discard_top: Card | null;
  host: string;
  players: RoomPlayer[];
}

interface UnoTableProps {
  roomCode: string;
  roomId: number;
  userId: number;
  username: string;
  avatar: string;
  isHost: boolean;
}

export default function UnoTable({ roomCode, roomId, userId, isHost }: UnoTableProps) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [hand, setHand] = useState<Card[]>([]);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadState = useCallback(async () => {
    try {
      const [state, handData] = await Promise.all([
        api.room.state(roomCode),
        api.game.hand(roomId),
      ]);
      setRoom(state);
      setHand(handData.hand || []);
    } catch (_e) { /* silent poll */ }
  }, [roomCode, roomId]);

  useEffect(() => {
    loadState();
    const iv = setInterval(loadState, 2500);
    return () => clearInterval(iv);
  }, [loadState]);

  async function startGame() {
    setLoading(true);
    try {
      await api.room.start(roomId);
      await loadState();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  async function playCard(card: Card, idx: number) {
    if (!room || room.current_turn !== userId) return;
    if (selectedCard === idx) {
      setLoading(true);
      setError('');
      try {
        await api.game.play(roomId, card);
        setSelectedCard(null);
        await loadState();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Нельзя');
        setSelectedCard(null);
      } finally {
        setLoading(false);
      }
    } else {
      setSelectedCard(idx);
    }
  }

  async function drawCard() {
    if (!room || room.current_turn !== userId) return;
    setLoading(true);
    try {
      await api.game.draw(roomId);
      await loadState();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  const isMyTurn = room?.current_turn === userId && room?.status === 'playing';
  const top = room?.discard_top;

  if (!room) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--uno-muted)' }}>
        Загрузка...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--uno-dark)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: '1px solid var(--uno-border)' }}>
        <div className="flex items-center gap-2">
          <span className="font-black text-lg tracking-wider" style={{ color: 'var(--uno-accent)' }}>UNO</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-mono font-bold" style={{ background: 'var(--uno-surface2)', color: 'var(--uno-accent)', border: '1px solid var(--uno-border)' }}>
            #{roomCode}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--uno-surface2)', color: 'var(--uno-muted)' }}>
            {room.direction === 'cw' ? '↻' : '↺'} {room.players.length} игр.
          </span>
        </div>
        <div className="flex items-center gap-2">
          {room.players.map(p => (
            <div key={p.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm"
              style={{
                background: 'var(--uno-surface2)',
                border: `1.5px solid ${room.current_turn === p.id && room.status === 'playing' ? 'var(--uno-accent)' : p.card_count <= 2 ? 'var(--uno-red)' : 'transparent'}`
              }}>
              <span>{p.avatar}</span>
              <span className="font-medium" style={{ color: 'var(--uno-text)' }}>{p.username}</span>
              <span className="font-black text-xs px-1.5 py-0.5 rounded-full"
                style={{ background: p.card_count <= 2 ? 'var(--uno-red)' : 'var(--uno-border)', color: 'white' }}>
                {p.card_count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Game area */}
      <div className="flex-1 flex items-center justify-center gap-8 px-6">
        {room.status === 'waiting' ? (
          <div className="text-center">
            <div className="text-4xl mb-3">🃏</div>
            <div className="font-bold text-lg mb-1" style={{ color: 'var(--uno-text)' }}>
              Ожидание игроков...
            </div>
            <div className="text-sm mb-4" style={{ color: 'var(--uno-muted)' }}>
              Поделись кодом: <span className="font-black" style={{ color: 'var(--uno-accent)' }}>{roomCode}</span>
            </div>
            {isHost && room.players.length >= 2 && (
              <button onClick={startGame} disabled={loading}
                className="px-6 py-3 rounded-xl font-bold text-base"
                style={{ background: 'var(--uno-accent)', color: 'var(--uno-dark)', border: 'none', cursor: 'pointer' }}>
                {loading ? '...' : '▶ Начать игру'}
              </button>
            )}
            {isHost && room.players.length < 2 && (
              <div className="text-sm" style={{ color: 'var(--uno-muted)' }}>
                Нужно минимум 2 игрока
              </div>
            )}
            {!isHost && (
              <div className="text-sm" style={{ color: 'var(--uno-muted)' }}>
                Хост начнёт игру
              </div>
            )}
          </div>
        ) : room.status === 'finished' ? (
          <div className="text-center">
            <div className="text-5xl mb-3">🎉</div>
            <div className="font-black text-2xl" style={{ color: 'var(--uno-accent)' }}>Игра завершена!</div>
          </div>
        ) : (
          <>
            {/* Draw pile */}
            <div className="flex flex-col items-center gap-2">
              <div onClick={drawCard}
                className="uno-card"
                style={{
                  background: 'linear-gradient(135deg, #1e2233, #252a3a)',
                  border: '2px solid var(--uno-border)',
                  cursor: isMyTurn ? 'pointer' : 'not-allowed',
                  opacity: isMyTurn ? 1 : 0.5,
                }}>
                <span style={{ color: 'var(--uno-accent)', fontSize: 28 }}>🂠</span>
              </div>
              <span className="text-xs" style={{ color: 'var(--uno-muted)' }}>колода</span>
            </div>

            {/* Top card */}
            {top && (
              <div className="flex flex-col items-center gap-2">
                <div className={`uno-card uno-card-${top.color}`} style={{ transform: 'rotate(-4deg)', cursor: 'default' }}>
                  <span style={{ textShadow: '0 2px 6px rgba(0,0,0,0.5)', fontSize: top.value.length > 2 ? 14 : 22 }}>
                    {top.value}
                  </span>
                </div>
                <span className="text-xs" style={{ color: 'var(--uno-muted)' }}>верхняя карта</span>
              </div>
            )}

            {/* Turn indicator */}
            <div className="flex flex-col items-center gap-2">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl ${isMyTurn ? 'pulse-turn' : ''}`}
                style={{
                  background: isMyTurn ? 'rgba(243,156,18,0.15)' : 'var(--uno-surface2)',
                  border: `2px solid ${isMyTurn ? 'var(--uno-accent)' : 'var(--uno-border)'}`,
                }}>
                {isMyTurn ? '🎯' : '⏳'}
              </div>
              <span className="text-xs font-medium" style={{ color: isMyTurn ? 'var(--uno-accent)' : 'var(--uno-muted)' }}>
                {isMyTurn ? 'Твой ход!' : `Ход: ${room.players.find(p => p.id === room.current_turn)?.username || '?'}`}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 text-center text-sm px-3 py-2 rounded-lg"
          style={{ background: 'rgba(231,76,60,0.12)', border: '1px solid rgba(231,76,60,0.3)', color: '#e74c3c' }}>
          {error}
        </div>
      )}

      {/* Player hand */}
      {room.status === 'playing' && (
        <div style={{ borderTop: '1px solid var(--uno-border)', background: 'var(--uno-surface)' }} className="px-4 pt-3 pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium" style={{ color: 'var(--uno-muted)' }}>
              Твои карты ({hand.length})
            </span>
            {selectedCard !== null && (
              <span className="text-xs font-medium animate-pulse" style={{ color: 'var(--uno-accent)' }}>
                Нажми ещё раз — бросить карту
              </span>
            )}
          </div>
          <div className="flex gap-1 overflow-x-auto pb-2" style={{ minHeight: 96 }}>
            {hand.map((card, idx) => (
              <div key={idx} onClick={() => playCard(card, idx)}
                className={`uno-card uno-card-${card.color} ${selectedCard === idx ? 'selected' : ''}`}
                style={{ opacity: isMyTurn ? 1 : 0.6, cursor: isMyTurn && !loading ? 'pointer' : 'not-allowed' }}>
                <span style={{ textShadow: '0 2px 6px rgba(0,0,0,0.4)', fontSize: card.value.length > 2 ? 14 : 22 }}>
                  {card.value}
                </span>
              </div>
            ))}
            {hand.length === 0 && room.status === 'playing' && (
              <div className="flex items-center justify-center w-full text-2xl font-black" style={{ color: 'var(--uno-accent)' }}>
                UNO! 🎉
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}