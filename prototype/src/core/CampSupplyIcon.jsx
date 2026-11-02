// Field-journal objects, using the same ink and flat fills as CaptureIcon.
export function CampSupplyIcon({ metric, ...props }) {
  return <svg viewBox="0 0 48 48" fill="none" stroke="#665039" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {metric === 'protein' ? <>
      <path d="m10 28 2-22 8 1-1 24M22 30 4-17 8 2-3 18" fill="#cda77c" />
      <path d="m15 10-1 12m15-3-2 8" stroke="#a37a53" />
      <path d="m6 27 35-1-3 16-30-1Z" fill="#bd8b61" />
      <path d="m8 32 31-1M9 37l29-1M11 27l1 14m21-14-1 14" />
      <path d="m33 23 7-5 4 6-7 5Z" fill="#e9d4b0" />
    </> : metric === 'carbs' ? <>
      <path d="M19 12V9q5-8 10 0v4" stroke="#526547" strokeWidth="4" />
      <path d="M13 15q-3 8-3 25 13 7 28-1l-3-24Z" fill="#82946b" />
      <path d="m13 15 7-8 9 1 5 8" fill="#ead4a1" />
      <path d="m21 9 3 7 4-7" stroke="#af8d5b" />
      <path d="M11 16q13-5 26 0l-2 10q-11 4-24-1Z" fill="#b98b62" />
      <path d="m17 18-1 15m14-15 1 15" stroke="#71523b" strokeWidth="3" />
      <path d="m13 33 20-1-1 9-18 1Z" fill="#6d805b" />
      <path d="M14 35q9 5 18-1" />
      <path d="M15 25h4v5h-4Zm14 0h4v5h-4Z" fill="#dfbd72" />
    </> : metric === 'fats' ? <>
      <path d="m8 24 26-8 6 8-26 10Z" fill="#a8794d" />
      <ellipse cx="12" cy="29" rx="6" ry="6.5" fill="#e4c08a" />
      <path d="m13 34 25-9 6 9-27 10Z" fill="#b88a52" />
      <ellipse cx="15" cy="38" rx="6" ry="6" fill="#edce99" />
      <path d="m6 19 23-8 6 8-24 8Z" fill="#bd925a" />
      <ellipse cx="8" cy="22" rx="5" ry="6" fill="#edce99" />
      <path d="m7 20 2 3m2 5 2 2m1 6 2 3M21 33l14-5M19 18l9-3" stroke="#947044" />
      <path d="M25 4c-2 9-10 10-9 17 0 7 13 10 17 3 3-5-2-10-4-12 0 5-4 6-4 6 2-6-2-8 0-14Z" fill="#e99b49" />
    </> : <>
      <path d="m7 19 21 1 3 23-25-1Z" fill="#d8bd83" />
      <path d="m7 19 3-6 16 1 2 6M10 17l15 1" />
      <path d="M18 36v-9m0 4q-8 0-7-7 7 0 7 7m0-2q0-7 7-7 1 7-7 7" fill="#90aa6f" stroke="#607d4b" />
      <path d="m31 30 12-1-3 13H33Z" fill="#b98462" />
      <path d="M37 29V15m0 6q-9-1-8-9 8 0 8 9m0-3q1-8 9-8 0 9-9 8" fill="#9ab679" stroke="#607d4b" />
    </>}
  </svg>;
}
