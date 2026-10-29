import { useEffect, useRef } from 'react';
import { StudyMedia } from './StudyMedia.jsx';
import './onboarding-intro.css';

// A review draft: profile persistence and reminder timing are deliberately undecided.
export function OnboardingIntro({ step, name, setName, onNavigate, onFinish }) {
  const heading = useRef(null);
  const welcome = step === 'welcome';
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [step]);

  return <div className="onboarding-intro">
    <header className="study-top onboarding-nav">
      {!welcome && <button type="button" aria-label="Назад" onClick={() => onNavigate('welcome')}>←</button>}
      <span>chewy</span>
      {welcome && <button type="button" className="study-text-button" onClick={onFinish}>Сразу в лагерь</button>}
    </header>
    <div className="onboarding-scroll">
      <div className={`study-mini-camp onboarding-scene${welcome ? '' : ' study-mini-hero'}`}>
        <div className="study-mini-ground" />
        {welcome && <StudyMedia kind="tent" label="Палатка" />}
        <StudyMedia kind="hero" label={name.trim() || 'Чуви'} />
        {welcome && <StudyMedia kind="fire" label="Костёр" />}
      </div>
      <div className="study-intro-copy onboarding-copy">
        <h1 ref={heading} tabIndex={-1}>{welcome ? 'Твоя еда. Наш маленький лагерь.' : 'Пока он — Чуви'}</h1>
        {welcome ? <>
          <p>Сфотографируй еду — получишь разбор тарелки, а в лагере появятся запасы. Чуви будет рад встрече.</p>
          <p className="onboarding-aside">Первое фото можно добавить, когда захочется.</p>
        </> : <>
          <p>Оставим это имя или придумаем своё?</p>
          <form id="onboarding-name-form" onSubmit={event => { event.preventDefault(); onFinish(); }}>
            <label className="study-name-field">Имя друга
              <input maxLength={24} placeholder="Чуви" value={name} onChange={event => setName(event.target.value)} autoComplete="off" enterKeyHint="done" />
            </label>
          </form>
        </>}
      </div>
    </div>
    <footer className="study-intro-actions onboarding-actions">
      {welcome ? <button key="welcome" type="button" className="study-primary" onClick={event => { event.preventDefault(); onNavigate('name'); }}>Познакомиться</button>
        : <><button key="name" type="submit" form="onboarding-name-form" className="study-primary">В лагерь</button>
          <button type="button" onClick={() => { setName(''); onFinish(); }}>Оставить Чуви</button></>}
    </footer>
  </div>;
}
