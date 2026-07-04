/**
 * PlateRing — the day plate as sectors, zero numbers.
 * Sector spans follow the Harvard plate target (50% veg / 25% protein / 25% grain);
 * each sector fills clockwise as meals contribute to it.
 */
const SECTORS = [
  { key: 'veg', span: 180, color: '#3fae5c', dim: 'rgba(63,174,92,.22)', emoji: '🥦' },
  { key: 'protein', span: 90, color: '#e0713a', dim: 'rgba(224,113,58,.22)', emoji: '🍗' },
  { key: 'grain', span: 90, color: '#d9a53f', dim: 'rgba(217,165,63,.22)', emoji: '🌾' },
];

export function PlateRing({ plate = { veg: 0, protein: 0, grain: 0 }, size = 120 }) {
  let angle = 0;
  const stops = [];
  for (const s of SECTORS) {
    const fill = Math.min(1, plate[s.key] ?? 0);
    const filled = angle + s.span * fill;
    const end = angle + s.span;
    stops.push(`${s.color} ${angle}deg ${filled}deg`, `${s.dim} ${filled}deg ${end}deg`);
    angle = end;
  }

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: `conic-gradient(${stops.join(', ')})`,
          border: '3px solid var(--chewy-ink)',
          boxShadow: '0 3px 0 rgba(0,0,0,.3), inset 0 0 0 4px rgba(255,255,255,.25)',
        }}
      />
      {/* wooden plate center */}
      <div
        style={{
          position: 'absolute',
          inset: size * 0.26,
          borderRadius: '50%',
          background: 'linear-gradient(180deg, #a9743f, #7d5228)',
          border: '3px solid var(--chewy-ink)',
        }}
      />
      {/* sector emojis — clockwise from 12: veg (right half), protein (bottom-left), grain (top-left) */}
      <span style={{ position: 'absolute', right: -6, top: '38%', fontSize: size * 0.16 }}>🥦</span>
      <span style={{ position: 'absolute', left: -4, bottom: 2, fontSize: size * 0.16 }}>🍗</span>
      <span style={{ position: 'absolute', left: -4, top: 2, fontSize: size * 0.16 }}>🌾</span>
    </div>
  );
}
