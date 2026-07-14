/**
 * MealLogRow — one entry in the home-screen meal log.
 * e.g. "🥩 Large portion   13:45"
 */
export function MealLogRow({ emoji = '🍽️', title = 'Medium portion', time = '13:45' }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 52,
        padding: '0 22px',
        backgroundImage: 'url(/assets/gen/packA/plank.png)',
        backgroundSize: '100% 100%',
        color: '#fff',
        font: '600 13px var(--font-round)',
        textShadow: '0 1px 2px rgba(60,20,0,.55)',
        filter: 'drop-shadow(0 3px 4px rgba(0,0,0,.3))',
      }}
    >
      <span style={{ fontSize: 20 }}>{emoji}</span>
      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
      <span style={{ opacity: 0.85, fontWeight: 500, fontSize: 12 }}>{time}</span>
    </div>
  );
}
