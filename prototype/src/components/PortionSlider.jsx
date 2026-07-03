/**
 * PortionSlider — portion size 0–100 for the Add Food screen.
 */
export function PortionSlider({ value = 50, onChange }) {
  return (
    <div style={{ width: '100%', color: '#fff', font: '600 14px var(--font-round)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span>Portion size</span>
        <span style={{ color: 'var(--chewy-orange)' }}>{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange?.(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--chewy-orange)' }}
      />
    </div>
  );
}
