import './hero-state.css';

// Placeholder copy and symbols; the full set of reactions is designed in stage 5.
const STATES = {
  idle: { icon: '♪', text: 'Хорошо у костра.', label: 'Чуви отдыхает' },
  happy: { icon: '♥', text: 'Ура, ты здесь!', label: 'Чуви радуется' },
  sleeping: { icon: '☾', text: 'До утра…', label: 'Чуви спит' },
  returning: { icon: '✦', text: 'Привет! Рад тебя видеть.', label: 'Чуви приветствует тебя' },
};

export function HeroState({ state = 'idle', name, compact = false }) {
  const resolvedState = STATES[state] ? state : 'idle';
  const content = STATES[resolvedState];
  return <div className={`hero-state hero-state-${resolvedState}${compact ? ' hero-state-compact' : ''}`}
    data-hero-state={resolvedState} role="status" aria-live="polite" aria-atomic="true">
    <span className="hero-state-icon" aria-hidden="true">{content.icon}</span>
    <span className="hero-state-copy"><span className="hero-state-label">{content.label.replace('Чуви', () => name || 'Чуви')}</span>{name && <strong className="hero-state-name" aria-hidden="true">{name}</strong>}{content.text}</span>
  </div>;
}
