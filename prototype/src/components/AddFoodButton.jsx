import { useState } from 'react';

/**
 * AddFoodButton — the round FAB on the home screen.
 * Mirrors the "add_meal_icon" button in HomeView.swift (press-scale).
 */
export function AddFoodButton({ onClick, size = 80 }) {
  const [pressed, setPressed] = useState(false);

  return (
    <button
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      aria-label="Add food"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: 'none',
        cursor: 'pointer',
        display: 'grid',
        placeItems: 'center',
        fontSize: size * 0.45,
        color: '#fff',
        background: 'linear-gradient(180deg, var(--chewy-orange), var(--chewy-orange-dark))',
        boxShadow: pressed
          ? '0 2px 6px rgba(0,0,0,.3)'
          : '0 10px 18px rgba(0,0,0,.35), 0 3px 6px rgba(0,0,0,.2)',
        transform: pressed ? 'scale(.88)' : 'scale(1)',
        transition: 'transform .15s cubic-bezier(.34,1.56,.64,1), box-shadow .15s',
      }}
    >
      +
    </button>
  );
}
