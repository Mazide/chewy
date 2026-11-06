import { useEffect, useRef, useState } from 'react';
import { StudyMedia } from './StudyMedia.jsx';
import { CampSupplyIcon } from './CampSupplyIcon.jsx';
import './onboarding-intro.css';
import './onboarding-example.css';
import './onboarding-draft.css';

// Owner-review proposal. The example never touches the session store.
export function OnboardingDraft({ onFinish }) {
  const [step, setStep] = useState(0);
  const heading = useRef(null);
  const scroll = useRef(null);
  useEffect(() => {
    scroll.current?.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
  }, [step]);
  const titles = ['Привет, я Чуви!', 'Попробуем на готовом фото', 'Еда на фото — запасы в лагере'];
  return <div className="onboarding-intro onboarding-example onboarding-draft">
    <header className="study-top onboarding-nav">
      {step > 0 && <button type="button" aria-label="Назад" onClick={() => setStep(step - 1)}>←</button>}
      <span>{step === 0 ? 'chewy' : 'Пробный пример'}</span>
      <button type="button" className="study-text-button" onClick={onFinish}>Сразу в лагерь</button>
    </header>
    <div className="onboarding-scroll" ref={scroll}>
      {step === 0 && <div className="study-mini-camp onboarding-scene">
        <div className="study-mini-ground" />
        <StudyMedia kind="tent" label="Палатка" /><StudyMedia kind="hero" label="Чуви" /><StudyMedia kind="fire" label="Костёр" />
      </div>}
      <div className="study-intro-copy onboarding-copy">
        <h1 ref={heading} tabIndex={-1}>{titles[step]}</h1>
        {step === 0 && <>
          <p>Я твой маленький друг в лесном лагере.</p>
          <p>Добавляй фото своей еды: я получу энергию, а в лагере появятся запасы.</p>
          <p className="onboarding-aside">Еда сейчас не нужна. Можно посмотреть пример или просто зайти в лагерь.</p>
        </>}
        {step === 1 && <>
          <p>Нажми на фото — посмотрим состав тарелки и что получит лагерь.</p>
          <button type="button" className="onboarding-example-photo" onClick={() => setStep(2)} aria-label="Разобрать фото-пример">
            <StudyMedia kind="meal" label="Овощи с нутом и гарниром" /><span>Разобрать это фото</span>
          </button>
          <p className="onboarding-aside">Это только проба: без камеры и записи в твоём дневнике.</p>
        </>}
        {step === 2 && <>
          <div className="onboarding-draft-result">
            <div className="onboarding-example-plate" role="img" aria-label="Тарелка примера: овощи, нут и гарнир"><span>Овощи</span><span>Нут</span><span>Гарнир</span></div>
            <p>В тарелке — овощи, нут и гарнир.</p>
            <div className="onboarding-draft-arrow" aria-hidden="true">↓</div>
            <div className="onboarding-draft-supplies" aria-label="Запасы в примере">
              {[['protein', 'Материалы'], ['carbs', 'Припасы'], ['plants', 'Семена']].map(([metric, label]) => <span key={metric}><CampSupplyIcon metric={metric} />{label}</span>)}
            </div>
          </div>
          <p>«Спасибо за энергию! Лагерь оживает».</p>
          <p className="onboarding-aside">Это был пример. Свою еду добавишь, когда захочешь.</p>
        </>}
      </div>
    </div>
    <footer className="study-intro-actions onboarding-actions">
      {step === 0 ? <button type="button" className="study-primary" onClick={() => setStep(1)}>Попробовать на примере</button>
        : step === 1 ? <button type="button" onClick={onFinish}>Пропустить пробу</button>
        : <button type="button" className="study-primary" onClick={onFinish}>В свой лагерь</button>}
    </footer>
  </div>;
}
