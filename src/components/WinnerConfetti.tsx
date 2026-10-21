import type { CSSProperties } from 'react';

const PIECE_COUNT = 28;

const COLORS = [
  '#a100ff',
  '#c440ff',
  '#7b5cff',
  '#f4eefc',
  '#6e00b8',
  '#e8d5ff',
];

type Piece = {
  left: string;
  delay: string;
  duration: string;
  drift: string;
  size: string;
  color: string;
  radius: string;
  spin: string;
};

function buildPieces(): Piece[] {
  return Array.from({ length: PIECE_COUNT }, (_, index) => {
    const left = (index * 37 + 11) % 100;
    const delay = ((index * 0.17) % 2.4).toFixed(2);
    const duration = (2.8 + (index % 5) * 0.35).toFixed(2);
    const drift = `${(index % 2 === 0 ? -1 : 1) * (12 + (index % 7) * 4)}px`;
    const size = `${6 + (index % 4) * 2}px`;
    const color = COLORS[index % COLORS.length];
    const radius = index % 3 === 0 ? '50%' : index % 3 === 1 ? '2px' : '1px';
    const spin = `${(index % 2 === 0 ? 1 : -1) * (220 + (index % 6) * 40)}deg`;
    return {
      left: `${left}%`,
      delay: `${delay}s`,
      duration: `${duration}s`,
      drift,
      size,
      color,
      radius,
      spin,
    };
  });
}

const PIECES = buildPieces();

type ConfettiStyle = CSSProperties & {
  '--confetti-drift': string;
  '--confetti-spin': string;
};

export function WinnerConfetti() {
  return (
    <div className="winner-confetti" aria-hidden="true">
      {PIECES.map((piece, index) => {
        const style: ConfettiStyle = {
          left: piece.left,
          width: piece.size,
          height: piece.size,
          background: piece.color,
          borderRadius: piece.radius,
          animationDelay: piece.delay,
          animationDuration: piece.duration,
          '--confetti-drift': piece.drift,
          '--confetti-spin': piece.spin,
        };
        return <span key={index} className="confetti-piece" style={style} />;
      })}
    </div>
  );
}
