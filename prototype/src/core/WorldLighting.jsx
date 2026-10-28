import './world-lighting.css';

export function WorldLighting({ phase }) {
  return <div className={`sandbox-world-light sandbox-light-${phase}`} aria-hidden="true">
    {phase === 'night' ? <svg className="sandbox-sky-lights" viewBox="0 0 390 340" preserveAspectRatio="none"><g fill="#f6edc7"><circle cx="72" cy="80" r="1.4"/><circle cx="175" cy="46" r="1.2"/><circle cx="282" cy="96" r="1.6"/><circle cx="238" cy="158" r="1.3"/><circle cx="123" cy="146" r="1"/><circle cx="324" cy="173" r="1.4"/><circle cx="185" cy="208" r="1.1"/></g><path d="M280 64a19 19 0 1 1-20-26 19 19 0 0 0 20 26Z" fill="#f5e5af" /></svg> : phase !== 'day' && <span className="sandbox-sun" />}
  </div>;
}
