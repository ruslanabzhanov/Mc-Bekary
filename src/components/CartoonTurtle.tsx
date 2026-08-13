import React from 'react';

interface CartoonTurtleProps {
  className?: string;
}

export const CartoonTurtle: React.FC<CartoonTurtleProps> = ({ className }) => {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      style={{ filter: 'drop-shadow(0 1px 0.5px rgba(11, 43, 50, 0.3))' }}
    >
      <defs>
        <radialGradient id="shellGrad" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#5fb8cf" />
          <stop offset="55%" stopColor="#2d889f" />
          <stop offset="100%" stopColor="#154957" />
        </radialGradient>
        <radialGradient id="skinGrad" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="#fdf3e0" />
          <stop offset="100%" stopColor="#eec98f" />
        </radialGradient>
        <linearGradient id="cellGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7fcfe2" />
          <stop offset="100%" stopColor="#1c5e6e" />
        </linearGradient>
      </defs>

      {/* Back legs */}
      <ellipse cx="30" cy="78" rx="8" ry="11" fill="url(#skinGrad)" stroke="#0b2b32" strokeWidth="1" transform="rotate(-25 30 78)" />
      <ellipse cx="70" cy="78" rx="8" ry="11" fill="url(#skinGrad)" stroke="#0b2b32" strokeWidth="1" transform="rotate(25 70 78)" />

      {/* Front flippers */}
      <ellipse cx="18" cy="42" rx="11" ry="16" fill="url(#skinGrad)" stroke="#0b2b32" strokeWidth="1" transform="rotate(-35 18 42)" />
      <ellipse cx="82" cy="42" rx="11" ry="16" fill="url(#skinGrad)" stroke="#0b2b32" strokeWidth="1" transform="rotate(35 82 42)" />

      {/* Tail */}
      <ellipse cx="50" cy="90" rx="4.5" ry="6" fill="url(#skinGrad)" stroke="#0b2b32" strokeWidth="1" />

      {/* Shell */}
      <ellipse cx="50" cy="55" rx="30" ry="34" fill="url(#shellGrad)" stroke="#0b2b32" strokeWidth="1.8" />

      {/* Shell seam lines (subtle plate segmentation) */}
      <g stroke="#0b2b32" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.45">
        <path d="M 50 24 L 50 86" />
        <path d="M 50 38 L 33 48 M 50 38 L 67 48" />
        <path d="M 50 58 L 30 62 M 50 58 L 70 62" />
        <path d="M 50 72 L 36 78 M 50 72 L 64 78" />
      </g>

      {/* Glossy highlight */}
      <ellipse cx="39" cy="42" rx="10" ry="7" fill="#ffffff" opacity="0.35" />
      <ellipse cx="50" cy="55" rx="30" ry="34" fill="url(#cellGrad)" opacity="0.12" />

      {/* Head (drawn last, on top, with a crisp outline for legibility at small sizes) */}
      <circle cx="50" cy="18" r="14" fill="url(#skinGrad)" stroke="#0b2b32" strokeWidth="1.6" />
      <ellipse cx="43" cy="21" rx="2.6" ry="1.6" fill="#ffb4a0" opacity="0.65" />
      <ellipse cx="57" cy="21" rx="2.6" ry="1.6" fill="#ffb4a0" opacity="0.65" />
      <circle cx="44.5" cy="15.5" r="3.1" fill="#1c1c1c" />
      <circle cx="55.5" cy="15.5" r="3.1" fill="#1c1c1c" />
      <circle cx="43.5" cy="14.4" r="1.1" fill="#ffffff" />
      <circle cx="54.5" cy="14.4" r="1.1" fill="#ffffff" />
      <path d="M 45.5 23.5 Q 50 27 54.5 23.5" stroke="#c98a4a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
};
