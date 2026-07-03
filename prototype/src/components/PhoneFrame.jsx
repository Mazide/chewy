/**
 * PhoneFrame — iPhone-ish bezel so screen prototypes read as a device.
 */
export function PhoneFrame({ children, background = 'var(--chewy-green)' }) {
  return (
    <div
      style={{
        width: 320,
        height: 680,
        borderRadius: 44,
        padding: 10,
        background: '#111',
        boxShadow: '0 30px 60px rgba(0,0,0,.4), inset 0 0 0 2px #333',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: 36,
          overflow: 'hidden',
          background,
        }}
      >
        {/* notch */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 120,
            height: 26,
            borderRadius: 20,
            background: '#111',
            zIndex: 5,
          }}
        />
        {children}
      </div>
    </div>
  );
}
