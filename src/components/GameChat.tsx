import { useState, useEffect, useRef } from 'react';
import Icon from '@/components/ui/icon';

interface Message {
  id: string;
  author: string;
  avatar: string;
  text: string;
  time: string;
  type: 'chat' | 'move' | 'draw' | 'uno' | 'system';
  isMe?: boolean;
}

interface Notification {
  id: string;
  text: string;
  type: 'move' | 'uno' | 'draw';
  exiting?: boolean;
}

interface GameChatProps {
  externalMessages: { text: string; type: 'move' | 'uno' | 'draw' }[];
}

const PLAYERS = [
  { name: 'Алекс', avatar: '🦊' },
  { name: 'Мария', avatar: '🦋' },
  { name: 'Иван', avatar: '🐺' },
];

const initMessages: Message[] = [
  { id: '1', author: 'Система', avatar: '🎮', text: 'Игра началась! Удачи всем!', time: '14:30', type: 'system' },
  { id: '2', author: 'Алекс', avatar: '🦊', text: 'Всем привет! Готов выиграть 😄', time: '14:31', type: 'chat' },
  { id: '3', author: 'Мария', avatar: '🦋', text: 'Посмотрим... У меня хорошие карты', time: '14:31', type: 'chat' },
];

function now() {
  return new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
}

const typeConfig = {
  move: { icon: '🃏', color: '#3498db', label: 'ход' },
  uno: { icon: '⚡', color: '#e74c3c', label: 'UNO' },
  draw: { icon: '🎨', color: '#9b59b6', label: 'рисовалка' },
  system: { icon: '🎮', color: 'var(--uno-muted)', label: '' },
  chat: { icon: '', color: '', label: '' },
};

export default function GameChat({ externalMessages }: GameChatProps) {
  const [messages, setMessages] = useState<Message[]>(initMessages);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [input, setInput] = useState('');
  const [tab, setTab] = useState<'chat' | 'log'>('chat');
  const bottomRef = useRef<HTMLDivElement>(null);
  const processedRef = useRef(0);

  // Handle external actions → notifications + log
  useEffect(() => {
    const newOnes = externalMessages.slice(processedRef.current);
    if (newOnes.length === 0) return;
    processedRef.current = externalMessages.length;

    newOnes.forEach(({ text, type }) => {
      // Add to log
      const player = PLAYERS[Math.floor(Math.random() * PLAYERS.length)];
      setMessages(prev => [...prev, {
        id: Math.random().toString(36).slice(2),
        author: player.name,
        avatar: player.avatar,
        text,
        time: now(),
        type,
      }]);

      // Show notification
      const notifId = Math.random().toString(36).slice(2);
      setNotifications(prev => [...prev.slice(-2), { id: notifId, text, type }]);

      setTimeout(() => {
        setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, exiting: true } : n));
        setTimeout(() => {
          setNotifications(prev => prev.filter(n => n.id !== notifId));
        }, 350);
      }, 3500);
    });
  }, [externalMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, tab]);

  function sendMessage() {
    if (!input.trim()) return;
    setMessages(prev => [...prev, {
      id: Math.random().toString(36).slice(2),
      author: 'Вы',
      avatar: '😎',
      text: input.trim(),
      time: now(),
      type: 'chat',
      isMe: true,
    }]);
    setInput('');
  }

  const chatMsgs = messages.filter(m => m.type === 'chat' || m.type === 'system');
  const logMsgs = messages.filter(m => m.type !== 'chat');

  const displayed = tab === 'chat' ? chatMsgs : logMsgs;

  return (
    <div className="flex flex-col h-full relative" style={{ background: 'var(--uno-surface)', borderLeft: '1px solid var(--uno-border)' }}>
      {/* Notifications */}
      <div className="absolute top-12 right-2 z-50 flex flex-col gap-2 pointer-events-none" style={{ width: 'calc(100% - 16px)' }}>
        {notifications.map(n => {
          const cfg = typeConfig[n.type];
          return (
            <div
              key={n.id}
              className={n.exiting ? 'notification-exit' : 'notification-enter'}
              style={{
                background: 'var(--uno-surface2)',
                border: `1.5px solid ${cfg.color}`,
                borderRadius: 10,
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: `0 4px 20px rgba(0,0,0,0.4)`,
              }}
            >
              <span style={{ fontSize: 18 }}>{cfg.icon}</span>
              <span style={{ fontSize: 12, color: 'var(--uno-text)', fontWeight: 500, lineHeight: 1.3 }}>{n.text}</span>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex flex-shrink-0" style={{ borderBottom: '1px solid var(--uno-border)' }}>
        {(['chat', 'log'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2.5 text-sm font-medium transition-colors"
            style={{
              color: tab === t ? 'var(--uno-accent)' : 'var(--uno-muted)',
              borderBottom: `2px solid ${tab === t ? 'var(--uno-accent)' : 'transparent'}`,
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            {t === 'chat' ? '💬 Чат' : '📋 Лог ходов'}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {displayed.map(msg => (
          <div key={msg.id}>
            {msg.type === 'system' ? (
              <div className="text-center py-1">
                <span className="text-xs px-3 py-1 rounded-full" style={{ background: 'var(--uno-surface2)', color: 'var(--uno-muted)' }}>
                  {msg.avatar} {msg.text}
                </span>
              </div>
            ) : (
              <div className={`flex gap-2 ${msg.isMe ? 'flex-row-reverse' : ''}`}>
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-base"
                  style={{ background: 'var(--uno-surface2)' }}>
                  {msg.avatar}
                </div>
                <div className={`flex flex-col gap-0.5 max-w-[75%] ${msg.isMe ? 'items-end' : ''}`}>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold" style={{ color: msg.isMe ? 'var(--uno-accent)' : 'var(--uno-text)' }}>
                      {msg.author}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--uno-muted)' }}>{msg.time}</span>
                  </div>
                  <div className="px-3 py-2 rounded-xl text-sm leading-snug"
                    style={{
                      background: msg.isMe ? 'rgba(243,156,18,0.12)' : 'var(--uno-surface2)',
                      border: `1px solid ${msg.isMe ? 'rgba(243,156,18,0.25)' : 'var(--uno-border)'}`,
                      color: 'var(--uno-text)',
                      borderRadius: msg.isMe ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                    }}>
                    {msg.type !== 'chat' && tab === 'log' && (
                      <span className="mr-1">{typeConfig[msg.type]?.icon}</span>
                    )}
                    {msg.text}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {tab === 'chat' && (
        <div className="flex-shrink-0 p-3" style={{ borderTop: '1px solid var(--uno-border)' }}>
          <div className="flex gap-2">
            <input
              className="chat-input flex-1"
              placeholder="Написать в чат..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
            />
            <button
              onClick={sendMessage}
              style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: input.trim() ? 'var(--uno-accent)' : 'var(--uno-surface2)',
                color: input.trim() ? 'var(--uno-dark)' : 'var(--uno-muted)',
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon name="Send" size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
