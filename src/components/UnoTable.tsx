import { useState, useEffect } from 'react';

interface Card {
  id: string;
  color: 'red' | 'blue' | 'green' | 'yellow' | 'wild';
  value: string;
}

interface Player {
  id: number;
  name: string;
  cardCount: number;
  isCurrentTurn: boolean;
  avatar: string;
}

interface UnoTableProps {
  onAction: (msg: string, type?: 'move' | 'uno' | 'draw') => void;
}

const CARD_COLORS = ['red', 'blue', 'green', 'yellow'] as const;
const CARD_VALUES = ['0','1','2','3','4','5','6','7','8','9','+2','⬚','↩'];

function randomCard(): Card {
  const color = CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)];
  const value = CARD_VALUES[Math.floor(Math.random() * CARD_VALUES.length)];
  return { id: Math.random().toString(36).slice(2), color, value };
}

const initialHand: Card[] = Array.from({ length: 7 }, randomCard);

const players: Player[] = [
  { id: 1, name: 'Алекс', cardCount: 5, isCurrentTurn: false, avatar: '🦊' },
  { id: 2, name: 'Мария', cardCount: 3, isCurrentTurn: false, avatar: '🦋' },
  { id: 3, name: 'Иван', cardCount: 8, isCurrentTurn: false, avatar: '🐺' },
];

export default function UnoTable({ onAction }: UnoTableProps) {
  const [hand, setHand] = useState<Card[]>(initialHand);
  const [topCard, setTopCard] = useState<Card>(randomCard());
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [activePlayers, setActivePlayers] = useState<Player[]>(players);
  const [isMyTurn, setIsMyTurn] = useState(true);
  const [direction, setDirection] = useState<'cw' | 'ccw'>('cw');
  const [deckCount, setDeckCount] = useState(42);

  useEffect(() => {
    const interval = setInterval(() => {
      const idx = Math.floor(Math.random() * activePlayers.length);
      const p = activePlayers[idx];
      const actions = [
        `${p.avatar} ${p.name} положил карту`,
        `${p.avatar} ${p.name} взял карту из колоды`,
        `${p.avatar} ${p.name} говорит UNO!`,
      ];
      const actionTypes: ('move' | 'draw' | 'uno')[] = ['move', 'draw', 'uno'];
      const i = Math.floor(Math.random() * actions.length);
      onAction(actions[i], actionTypes[i]);

      setActivePlayers(prev => prev.map((pl, j) =>
        j === idx ? { ...pl, cardCount: Math.max(1, pl.cardCount + (i === 1 ? 1 : -1)) } : pl
      ));
    }, 6000);
    return () => clearInterval(interval);
  }, [activePlayers, onAction]);

  function playCard(card: Card) {
    if (!isMyTurn) return;
    if (selectedCard === card.id) {
      setTopCard(card);
      setHand(prev => prev.filter(c => c.id !== card.id));
      setSelectedCard(null);
      setIsMyTurn(false);
      onAction(`Ты положил ${card.value} (${colorName(card.color)})`, 'move');
      if (card.value === '↩') setDirection(d => d === 'cw' ? 'ccw' : 'cw');
      setTimeout(() => setIsMyTurn(true), 3000);
    } else {
      setSelectedCard(card.id);
    }
  }

  function drawCard() {
    if (!isMyTurn) return;
    const newCard = randomCard();
    setHand(prev => [...prev, newCard]);
    setDeckCount(d => d - 1);
    onAction('Ты взял карту из колоды', 'draw');
  }

  function colorName(c: string) {
    const map: Record<string, string> = { red: 'красная', blue: 'синяя', green: 'зелёная', yellow: 'жёлтая', wild: 'джокер' };
    return map[c] || c;
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--uno-dark)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: '1px solid var(--uno-border)' }}>
        <div className="flex items-center gap-2">
          <span className="font-black text-lg tracking-wider" style={{ color: 'var(--uno-accent)' }}>UNO</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--uno-surface2)', color: 'var(--uno-muted)' }}>
            {direction === 'cw' ? '↻ по часовой' : '↺ против'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {activePlayers.map(p => (
            <div key={p.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm" style={{ background: 'var(--uno-surface2)', border: `1.5px solid ${p.cardCount <= 2 ? 'var(--uno-red)' : 'transparent'}` }}>
              <span>{p.avatar}</span>
              <span className="font-medium" style={{ color: 'var(--uno-text)' }}>{p.name}</span>
              <span className="font-black text-xs px-1.5 py-0.5 rounded-full" style={{ background: p.cardCount <= 2 ? 'var(--uno-red)' : 'var(--uno-border)', color: 'white' }}>
                {p.cardCount}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Game area */}
      <div className="flex-1 flex items-center justify-center gap-8 relative px-6">
        {/* Deck */}
        <div className="flex flex-col items-center gap-2">
          <div
            onClick={drawCard}
            className="uno-card cursor-pointer select-none"
            style={{ background: 'linear-gradient(135deg, #1e2233, #252a3a)', border: '2px solid var(--uno-border)', cursor: isMyTurn ? 'pointer' : 'not-allowed', opacity: isMyTurn ? 1 : 0.5 }}
          >
            <span className="font-black text-2xl" style={{ color: 'var(--uno-accent)' }}>🂠</span>
          </div>
          <span className="text-xs" style={{ color: 'var(--uno-muted)' }}>{deckCount} карт</span>
        </div>

        {/* Top card */}
        <div className="flex flex-col items-center gap-2">
          <div className={`uno-card uno-card-${topCard.color}`} style={{ transform: 'rotate(-5deg)', cursor: 'default' }}>
            <span style={{ textShadow: '0 2px 6px rgba(0,0,0,0.5)' }}>{topCard.value}</span>
          </div>
          <span className="text-xs" style={{ color: 'var(--uno-muted)' }}>верхняя карта</span>
        </div>

        {/* Turn indicator */}
        <div className="flex flex-col items-center gap-2">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl font-black ${isMyTurn ? 'pulse-turn' : ''}`}
            style={{ background: isMyTurn ? 'rgba(243,156,18,0.15)' : 'var(--uno-surface2)', border: `2px solid ${isMyTurn ? 'var(--uno-accent)' : 'var(--uno-border)'}` }}>
            {isMyTurn ? '🎯' : '⏳'}
          </div>
          <span className="text-xs font-medium" style={{ color: isMyTurn ? 'var(--uno-accent)' : 'var(--uno-muted)' }}>
            {isMyTurn ? 'Твой ход!' : 'Ждём...'}
          </span>
        </div>
      </div>

      {/* Player hand */}
      <div style={{ borderTop: '1px solid var(--uno-border)', background: 'var(--uno-surface)' }} className="px-4 pt-3 pb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium" style={{ color: 'var(--uno-muted)' }}>Твои карты ({hand.length})</span>
          {selectedCard && (
            <span className="text-xs font-medium animate-pulse" style={{ color: 'var(--uno-accent)' }}>
              Нажми ещё раз — бросить карту
            </span>
          )}
        </div>
        <div className="flex gap-1 overflow-x-auto pb-2" style={{ minHeight: 96 }}>
          {hand.map((card) => (
            <div
              key={card.id}
              onClick={() => playCard(card)}
              className={`uno-card uno-card-${card.color} ${selectedCard === card.id ? 'selected' : ''}`}
              style={{ opacity: isMyTurn ? 1 : 0.6, cursor: isMyTurn ? 'pointer' : 'not-allowed' }}
            >
              <span style={{ textShadow: '0 2px 6px rgba(0,0,0,0.4)', fontSize: card.value.length > 2 ? 14 : 22 }}>
                {card.value}
              </span>
            </div>
          ))}
          {hand.length === 0 && (
            <div className="flex items-center justify-center w-full text-2xl font-black" style={{ color: 'var(--uno-accent)' }}>
              UNO! 🎉
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
