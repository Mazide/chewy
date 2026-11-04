import { PhoneFrame } from '../components/PhoneFrame.jsx';

/**
 * CaptureScreen — the camera viewfinder between camp and analysis.
 * Full-bleed "live camera" (placeholder photo for now), a classic shutter,
 * back to camp. Deliberately bare: chrome lands via the grid workflow.
 */
export function CaptureScreen({ onShutter, onBack }) {
  return (
    <PhoneFrame background="#101010">
      <div style={{ position: 'relative', height: '100%' }}>
        {/* viewfinder */}
        <img
          src="/assets/camera_placeholder.jpg"
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />

        {/* back to camp */}
        <button
          onClick={onBack}
          style={{
            position: 'absolute',
            top: 48,
            left: 14,
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: 'none',
            background: 'rgba(0,0,0,.45)',
            color: '#fff',
            font: '800 20px var(--font-round)',
            cursor: 'pointer',
          }}
        >
          ‹
        </button>

        {/* shutter */}
        <button
          onClick={onShutter}
          aria-label="shutter"
          style={{
            position: 'absolute',
            bottom: 30,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 74,
            height: 74,
            borderRadius: '50%',
            border: '5px solid #fff',
            background: 'rgba(255,255,255,.25)',
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            padding: 0,
          }}
        >
          <span style={{ width: 54, height: 54, borderRadius: '50%', background: '#fff', display: 'block' }} />
        </button>
      </div>
    </PhoneFrame>
  );
}
