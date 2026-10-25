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
        gap: 12,
        padding: '10px 14px',
        borderRadius: 'var(--radius-md)',
        background: 'rgba(0,0,0,.18)',
        color: '#fff',
        font: '600 15px var(--font-round)',
      }}
    >
      <span style={{ fontSize: 22 }}>{emoji}</span>
      <span style={{ flex: 1 }}>{title}</span>
      <span style={{ opacity: 0.7, fontWeight: 500 }}>{time}</span>
    </div>
  );
}
