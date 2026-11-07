// Field-journal objects shared by the result and its arrival in camp.
export function CampSupplyIcon({ metric, ...props }) {
  return <svg viewBox="0 0 48 48" fill="none" stroke="#665039" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {metric === 'protein' ? <>
      <path d="m4 38 18-29 22 29Z" fill="#e6a55e" /><path d="m22 9 2 29H4Z" fill="#f5bc76" />
      <path d="m22 19 10 19H14Z" fill="#76543b" /><path d="m6 39-3 3m39-3 3 3" />
    </> : metric === 'carbs' ? <>
      <path d="m8 33 27-7 6 7-26 10Z" fill="#b88a52" /><ellipse cx="12" cy="38" rx="5" ry="5" fill="#edce99" />
      <path d="m9 27 26 8-3 8-25-8Z" fill="#bd925a" /><ellipse cx="34" cy="39" rx="5" ry="5" fill="#edce99" />
      <path d="M25 4c-2 9-12 12-11 20 0 10 18 12 22 3 3-6-2-13-5-15 0 5-5 7-5 7 2-6-2-9-1-15Z" fill="#e99b49" />
      <path d="M24 19c0 6-8 9-5 14 3 5 12 3 12-2 0-4-4-5-7-12Z" fill="#f6d77c" />
    </> : metric === 'fats' ? <>
      <path d="M13 13V9a11 11 0 0 1 22 0v4" stroke="#7b8457" /><path d="m12 15 3-6h18l3 6-2 24H14Z" fill="#8d9865" />
      <path d="M17 18h14l2 17H15Z" fill="#f9efc5" /><path d="M24 22c-1 4-5 6-3 9 2 3 7 1 6-2Z" fill="#eeb85b" />
      <path d="M13 39h22l2 5H11Z" fill="#a9ae75" /><path d="M17 40h14v3H17Z" fill="#efc16b" /><path d="M11 15h26" />
    </> : <>
      <path d="m7 32 34-1-5 13H12Z" fill="#b98462" /><path d="M24 32V12m0 12q-12-1-12-10 12 0 12 10m0 3q1-11 13-11 0 12-13 11" fill="#9ab679" stroke="#607d4b" />
      <path d="M24 12c-9-2-7-9-2-8 2-6 8-3 6 2 7 0 7 7 1 8Z" fill="#fff5d8" /><circle cx="25" cy="10" r="3" fill="#e8bc5c" />
    </>}
  </svg>;
}
