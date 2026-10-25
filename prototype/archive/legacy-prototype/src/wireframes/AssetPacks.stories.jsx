/**
 * Assets/Pack A — contact sheet of generated chrome assets
 * (gpt-image-1.5, transparent PNG, one style preamble).
 * Shown against the camp scene and a dark panel to judge alpha edges.
 */

const PACK_A = [
  'plank', 'scroll', 'parchment_map', 'leather_panel',
  'coin', 'orb_map', 'orb_compass', 'orb_backpack',
];

function Sheet({ background, label }) {
  return (
    <div>
      <div style={{ font: '800 13px system-ui', margin: '0 0 8px' }}>{label}</div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 14,
          padding: 18,
          borderRadius: 16,
          ...background,
        }}
      >
        {PACK_A.map((id) => (
          <div key={id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <img src={`/assets/gen/packA/${id}.png`} alt={id} style={{ width: '100%', maxWidth: 150 }} />
            <span style={{ font: '700 11px system-ui', color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,.6)' }}>{id}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default {
  title: 'Assets/PackA',
  parameters: { layout: 'fullscreen' },
};

export const ContactSheet = {
  render: () => (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20, background: '#fff', minHeight: '100vh' }}>
      <Sheet
        label="На сцене кемпа (боевой фон)"
        background={{ backgroundImage: 'url(/assets/camp_frame.jpg), linear-gradient(180deg, #7ec850, #2e9e4f)', backgroundSize: 'cover' }}
      />
      <Sheet label="На тёмном (края альфы)" background={{ background: '#1d1535' }} />
    </div>
  ),
};
