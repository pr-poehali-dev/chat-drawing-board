import { useState, useCallback, useRef } from 'react';
import UnoTable from '@/components/UnoTable';
import DrawingCanvas from '@/components/DrawingCanvas';
import GameChat from '@/components/GameChat';

export default function Index() {
  const [actions, setActions] = useState<{ text: string; type: 'move' | 'uno' | 'draw' }[]>([]);
  const [topH, setTopH] = useState(58);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleAction = useCallback((text: string, type: 'move' | 'uno' | 'draw' = 'move') => {
    setActions(prev => [...prev, { text, type }]);
  }, []);

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((ev.clientY - rect.top) / rect.height) * 100;
      setTopH(Math.min(80, Math.max(25, pct)));
    };
    const onUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: 'var(--uno-dark)', fontFamily: "'Golos Text', sans-serif" }}>
      {/* Left: Uno + Drawing */}
      <div ref={containerRef} className="flex flex-col" style={{ flex: 1, minWidth: 0 }}>
        {/* UNO Table */}
        <div style={{ height: `${topH}%`, minHeight: 0, overflow: 'hidden' }}>
          <UnoTable onAction={handleAction} />
        </div>

        {/* Resize divider */}
        <div
          onMouseDown={startDrag}
          style={{
            height: 6,
            cursor: 'row-resize',
            background: 'var(--uno-border)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            userSelect: 'none',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--uno-muted)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--uno-border)')}
        >
          <div style={{ width: 40, height: 3, borderRadius: 2, background: 'var(--uno-muted)', opacity: 0.6 }} />
        </div>

        {/* Drawing Canvas */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <DrawingCanvas />
        </div>
      </div>

      {/* Right: Chat */}
      <div style={{ width: 300, flexShrink: 0 }}>
        <GameChat externalMessages={actions} />
      </div>
    </div>
  );
}
