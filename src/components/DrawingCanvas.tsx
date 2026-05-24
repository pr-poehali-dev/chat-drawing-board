import { useRef, useEffect, useState, useCallback } from 'react';
import Icon from '@/components/ui/icon';

type Tool = 'pen' | 'eraser' | 'fill';

const COLORS = ['#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c','#3498db','#9b59b6','#ffffff','#aaaaaa','#1a1d27'];
const SIZES = [2, 4, 8, 16];

export default function DrawingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#f1c40f');
  const [size, setSize] = useState(4);
  const [users] = useState(['🦊', '🦋', '🐺']);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      const ctx = canvas.getContext('2d');
      const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
      canvas.width = width;
      canvas.height = height;
      const ctx2 = canvas.getContext('2d');
      if (ctx2) {
        ctx2.fillStyle = '#141620';
        ctx2.fillRect(0, 0, canvas.width, canvas.height);
        if (imageData) ctx2.putImageData(imageData, 0, 0);
      }
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const t = e.touches[0];
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDrawing.current = true;
    lastPos.current = getPos(e);
  }, []);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = size * 3;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
    }

    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  }, [tool, color, size]);

  const stopDraw = useCallback(() => {
    isDrawing.current = false;
    lastPos.current = null;
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d')!.globalCompositeOperation = 'source-over';
  }, []);

  function clearCanvas() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#141620';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--uno-surface)', borderTop: '1px solid var(--uno-border)' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--uno-border)', background: 'var(--uno-surface2)' }}>
        {/* Tools */}
        <div className="flex gap-1">
          <button className={`drawing-tool-btn ${tool === 'pen' ? 'active' : ''}`} onClick={() => setTool('pen')} title="Кисть">
            <Icon name="Pen" size={15} />
          </button>
          <button className={`drawing-tool-btn ${tool === 'eraser' ? 'active' : ''}`} onClick={() => setTool('eraser')} title="Ластик">
            <Icon name="Eraser" size={15} />
          </button>
        </div>

        <div style={{ width: 1, height: 24, background: 'var(--uno-border)' }} />

        {/* Colors */}
        <div className="flex gap-1 flex-wrap">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => { setColor(c); setTool('pen'); }}
              style={{
                width: 20, height: 20, borderRadius: '50%', background: c,
                border: color === c && tool !== 'eraser' ? '2px solid white' : '2px solid transparent',
                cursor: 'pointer', flexShrink: 0,
                boxShadow: color === c && tool !== 'eraser' ? '0 0 0 1px var(--uno-muted)' : 'none'
              }}
            />
          ))}
        </div>

        <div style={{ width: 1, height: 24, background: 'var(--uno-border)' }} />

        {/* Sizes */}
        <div className="flex items-center gap-1">
          {SIZES.map(s => (
            <button
              key={s}
              onClick={() => setSize(s)}
              style={{
                width: 28, height: 28, borderRadius: 6, background: size === s ? 'rgba(243,156,18,0.15)' : 'var(--uno-surface2)',
                border: `1.5px solid ${size === s ? 'var(--uno-accent)' : 'transparent'}`,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <div style={{ width: s * 2, height: s * 2, borderRadius: '50%', background: size === s ? 'var(--uno-accent)' : 'var(--uno-muted)', maxWidth: 16, maxHeight: 16 }} />
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Online users */}
          <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--uno-muted)' }}>
            {users.map((u, i) => <span key={i}>{u}</span>)}
            <span className="ml-1">рисуют</span>
          </div>

          <button
            onClick={clearCanvas}
            className="drawing-tool-btn"
            title="Очистить"
            style={{ color: '#e74c3c' }}
          >
            <Icon name="Trash2" size={14} />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden" style={{ cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}>
        <canvas
          ref={canvasRef}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
          style={{ display: 'block', touchAction: 'none' }}
        />
      </div>
    </div>
  );
}
