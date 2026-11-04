// A permanent camp prop: one short sitting log, independent of food supplies.
export function CampLog({ className = '' }) {
  return <div className={`sandbox-sprite-crop camp-log${className ? ` ${className}` : ''}`}>
    <svg viewBox="0 0 240 110" width="100%" height="100%" fill="none" stroke="#26291e" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ display: 'block' }}>
      {/* A slightly crooked trunk stays broad and clear at small camp scale. */}
      <path d="M37 23c25 0 51 5 77 5 28 0 52 2 79 7 17 3 28 16 29 32 1 18-8 31-24 34-30-2-55-8-82-8-30 0-56 1-82-2-14-1-20-17-19-35 0-17 8-30 22-33Z" fill="#a77550" />
      <path d="M18 70c25 2 49 7 74 7 34 0 60 2 88 7l18 17c-30-2-55-8-82-8-30 0-56 1-82-2-9 0-14-9-16-21Z" fill="#8f603f" stroke="none" />
      <path d="M37 23c25 0 51 5 77 5 28 0 52 2 79 7 17 3 28 16 29 32 1 18-8 31-24 34-30-2-55-8-82-8-30 0-56 1-82-2-14-1-20-17-19-35 0-17 8-30 22-33Z" />
      {/* Sparse bark seams leave an uninterrupted place to sit. */}
      <path d="M32 37c25-1 47 4 68 4l15-1m14 1 36 5M27 58l24 2m16 2c25 0 48 4 71 3l23 2M36 79c24 2 48 4 70 2m17 2 39 6" stroke="#674c34" strokeWidth="2" />
      <path d="M118 53c5-3 12-2 15 1-4 4-11 4-15-1Zm-20 2 11-1m30 2 10 1" stroke="#674c34" strokeWidth="1.7" />
      {/* Bark rim and a pale, uneven cut end; no cast shadow. */}
      <path d="M195 35c16-1 28 12 29 30 2 20-6 34-23 37-16 2-28-11-29-29-2-19 7-35 23-38Z" fill="#8f603f" />
      <path d="M196 40c13-1 23 10 24 26 1 17-5 29-19 32-13 2-23-10-24-26-1-16 6-29 19-32Z" fill="#ddbd86" strokeWidth="2" />
      <path d="M199 47c10 0 16 10 16 22 0 12-5 22-14 24-10 1-18-10-18-23 0-8 2-14 6-18m12 2c5 2 8 8 8 15 0 9-3 15-8 16-7 1-12-6-12-15 0-5 1-9 4-12m7 5c3 1 4 4 3 8 0 4-2 6-5 5-3-1-4-4-3-7" stroke="#a58150" strokeWidth="1.7" />
      <path d="m212 88-7-7m-26-16 7 2" stroke="#674c34" strokeWidth="1.7" />
    </svg>
  </div>;
}
