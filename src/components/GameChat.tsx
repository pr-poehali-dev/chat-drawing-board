import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import Icon from '@/components/ui/icon';

interface ChatMessage {
  id: number;
  username: string;
  avatar: string;
  text: string;
  type: string;
  time: string;
}

interface Notification {
  id: number;
  text: string;
  type: string;
  exiting?: boolean;
}

interface GameChatProps {
  roomId: number;
  username: string;
}

export default function GameChat({ roomId, username }: GameChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [input, setInput] = useState('');
  const [tab, setTab] = useState<'chat' | 'log'>('chat');
  const [sending, setSending] = useState(false);
  const lastIdRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const poll = useCallback(async () => {
    try {
      const data = await api.chat.poll(roomId, lastIdRef.current);
      const newMsgs: ChatMessage[] = data.messages || [];
      if (newMsgs.length === 0) return;
      lastIdRef.current = newMsgs[newMsgs.length - 1].id;
      setMessages(prev => [...prev, ...newMsgs]);
      newMsgs.filter(m => m.type !== 'chat').forEach(m => {
        setNotifications(prev => [...prev.slice(-2), { ...m, exiting: false }]);
        setTimeout(() => {
          setNotifications(prev => prev.map(n => n.id === m.id ? { ...n, exiting: true } : n));
          setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== m.id)), 350);
        }, 3500);
      });
    } catch (_e) { /* silent */ }
  }, [roomId]);

  useEffect(() => {
    poll();
    const iv = setInterval(poll, 2000);
    return () => clearInterval(iv);
  }, [poll]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, tab]);

  async function sendMessage() {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await api.chat.send(roomId, input.trim());
      setInput('');
    } catch (_e) { /* silent */ } finally {
      setSending(false);
    }
  }

  const typeIcon: Record<string, string> = { move: '🃏', draw: '📤', uno: '⚡', system: '🎮' };
  const typeColor: Record<string, string> = { move: '#3498db', draw: '#9b59b6', uno: '#e74c3c', system: 'var(--uno-muted)' };

  const chatMsgs = messages.filter(m => m.type === 'chat' || m.type === 'system');
  const logMsgs = messages.filter(m => m.type !== 'chat');
  const displayed = tab === 'chat' ? chatMsgs : logMsgs;

  return (
    <div className="flex flex-col h-full relative"
      style={{ background: 'var(--uno-surface)', borderLeft: '1px solid var(--uno-border)' }}>

      {/* Notifications */}
      <div className="absolute top-12 right-2 z-50 flex flex-col gap-2 pointer-events-none"
        style={{ width: 'calc(100% - 16px)' }}>
        {notifications.map(n => (
          <div key={n.id}
            className={n.exiting ? 'notification-exit' : 'notification-enter'}
            style={{
              background: 'var(--uno-surface2)',
              border: `1.5px solid ${typeColor[n.type] || 'var(--uno-border)'}`,
              borderRadius: 10, padding: '8px 12px',
              display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            }}>
            <span style={{ fontSize: 18 }}>{typeIcon[n.type] || '📌'}</span>
            <span style={{ fontSize: 12, color: 'var(--uno-text)', fontWeight: 500, lineHeight: 1.3 }}>{n.text}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-shrink-0" style={{ borderBottom: '1px solid var(--uno-border)' }}>
        {(['chat', 'log'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-2.5 text-sm font-medium transition-colors"
            style={{
              color: tab === t ? 'var(--uno-accent)' : 'var(--uno-muted)',
              borderBottom: `2px solid ${tab === t ? 'var(--uno-accent)' : 'transparent'}`,
              background: 'transparent', cursor: 'pointer',
            }}>
            {t === 'chat' ? '💬 Чат' : '📋 Лог ходов'}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {displayed.length === 0 && (
          <div className="text-center text-xs mt-4" style={{ color: 'var(--uno-muted)' }}>
            {tab === 'chat' ? 'Пока тихо... Напиши что-нибудь!' : 'Ходов ещё нет'}
          </div>
        )}
        {displayed.map(msg => (
          <div key={msg.id}>
            {msg.type !== 'chat' ? (
              <div className="text-center py-0.5">
                <span className="text-xs px-2 py-1 rounded-full inline-flex items-center gap-1"
                  style={{ background: 'var(--uno-surface2)', color: 'var(--uno-muted)' }}>
                  {typeIcon[msg.type] || ''} {msg.text}
                </span>
              </div>
            ) : (
              <div className={`flex gap-2 ${msg.username === username ? 'flex-row-reverse' : ''}`}>
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-base"
                  style={{ background: 'var(--uno-surface2)' }}>
                  {msg.avatar}
                </div>
                <div className={`flex flex-col gap-0.5 max-w-[75%] ${msg.username === username ? 'items-end' : ''}`}>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold"
                      style={{ color: msg.username === username ? 'var(--uno-accent)' : 'var(--uno-text)' }}>
                      {msg.username}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--uno-muted)' }}>{msg.time}</span>
                  </div>
                  <div className="px-3 py-2 text-sm leading-snug"
                    style={{
                      background: msg.username === username ? 'rgba(243,156,18,0.12)' : 'var(--uno-surface2)',
                      border: `1px solid ${msg.username === username ? 'rgba(243,156,18,0.25)' : 'var(--uno-border)'}`,
                      color: 'var(--uno-text)',
                      borderRadius: msg.username === username ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                    }}>
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
            <button onClick={sendMessage} disabled={!input.trim() || sending}
              style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: input.trim() ? 'var(--uno-accent)' : 'var(--uno-surface2)',
                color: input.trim() ? 'var(--uno-dark)' : 'var(--uno-muted)',
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}>
              <Icon name="Send" size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
