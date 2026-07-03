import { useState } from 'react';

/**
 * AddFoodButton — the home-screen FAB. Uses the real "add_meal_icon" asset
 * from the app, with the same press-scale as HomeView.swift.
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
        padding: 0,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        transform: pressed ? 'scale(.88)' : 'scale(1)',
        transition: 'transform .15s cubic-bezier(.34,1.56,.64,1)',
      }}
    >
      <img
        src="/assets/add_meal_icon.png"
        alt=""
        width={size}
        height={size}
        style={{
          display: 'block',
          filter: 'drop-shadow(0 6px 12px rgba(0,0,0,.35)) drop-shadow(0 2px 4px rgba(0,0,0,.15))',
        }}
      />
    </button>
  );
}
