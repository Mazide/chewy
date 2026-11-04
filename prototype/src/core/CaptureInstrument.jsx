import './capture-instrument.css';

export const CAMERA_LABELS = { science: 'Походная лаборатория', alchemy: 'Алхимическая камера', computer: 'Карманный сканер' };

export function CaptureIcon({ kind, ...props }) {
  return <svg viewBox="0 0 40 40" fill="none" stroke="#665039" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {kind === 'science' ? <><path d="M15 5h10l-1 4v9l8 13q2 5-3 5H11q-5 0-3-5l8-13V9Z" fill="#e9e4c5"/><path d="m13 25-4 7q0 2 3 2h16q3 0 2-3l-3-6Z" fill="#a8b86e"/><path d="M15 9h10M17 14h3M17 19h3"/><circle cx="21" cy="29" r="2" fill="#e9e4c5"/></>
      : kind === 'alchemy' ? <><path d="M15 7h10v7q10 4 9 14-1 9-14 9T6 28q-1-10 9-14Z" fill="#e8d9bd"/><path d="M8 26q6-5 12 0t12 0q1 9-12 9T8 26" fill="#bba0bb"/><path d="M15 4h10v6H15Z" fill="#c79c62"/><path d="m31 5 2 4 4 2-4 2-2 4-2-4-4-2 4-2Z" fill="#e7b965"/></>
      : kind === 'computer' ? <><path d="m6 8 28 1-1 23H7Z" fill="#b9c6a1"/><path d="M10 12h20v15H10Z" fill="#38594b"/><path d="m13 16 4 3-4 3M21 23h5" stroke="#e2edb8"/><path d="M17 32v4h9M13 36h18"/><circle cx="29" cy="30" r=".8" fill="#e7b965"/></>
      : kind === 'gallery' ? <><path d="m3 10 26-5 5 28-26 4Z" fill="#c79c62"/><path d="m10 4 27 3-3 31-27-3Z" fill="#fff3ce"/><path d="m13 9 20 2-2 18-20-2Z" fill="#b4cfa6"/><path d="m11 25 8-10 5 9 4-5 4 10" fill="#78915c"/><circle cx="28" cy="15" r="2.5" fill="#f0cf78"/></>
      : kind === 'notes' ? <><path d="M8 5 31 3l2 32-24 2Z" fill="#c79c62"/><path d="m11 6 20-1 1 28-20 2Z" fill="#f5e8be"/><path d="M7 6l4-1 1 31-4 1Z" fill="#8d7050"/><path d="m16 13 10-1M16 18l8-1M16 23l6-1" stroke="#ab9c75"/><path d="m28 29 3-9 5-11 3 2-5 12Z" fill="#e7b965"/></>
      : kind === 'camera' ? <><path d="M5 12h8l3-5h10l3 5h7v22H5Z" fill="#e9d59f"/><path d="M5 18h31v11H5Z" fill="#72906c"/><circle cx="21" cy="23" r="8" fill="#38594b"/><circle cx="21" cy="23" r="4" fill="#aac1a0"/><path d="M19 20h2" stroke="#fff3ce"/><path d="M29 15h3"/></>
      : <path d="m23 10-10 10 10 10M13 20h18" strokeWidth="2.5"/>}
  </svg>;
}

export function CaptureFinder({ theme }) {
  return <svg className={`capture-instrument-finder finder-${theme}`} viewBox="0 0 320 320" fill="none" aria-hidden="true">
    <path className="finder-shadow" d="M32 79q-3-27 2-43 19-4 46-1M240 35q27-2 44 2 4 20 1 43M286 241q2 27-3 44-17 3-43 0M79 285q-26 3-44-1-4-18-2-44"/>
    <path className="finder-main" d="M32 79q-3-27 2-43 19-4 46-1M240 35q27-2 44 2 4 20 1 43M286 241q2 27-3 44-17 3-43 0M79 285q-26 3-44-1-4-18-2-44"/>
    {theme === 'alchemy' && <path className="finder-main" d="m265 58 4 9 9 4-9 4-4 9-4-9-9-4 9-4Z"/>}
    {theme === 'computer' && <path className="finder-faint" d="M110 36v248M210 36v248M34 110h250M34 210h250"/>}
  </svg>;
}
