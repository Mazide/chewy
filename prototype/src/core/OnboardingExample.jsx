import { useEffect, useRef, useState } from 'react';
import { StudyMedia } from './StudyMedia.jsx';
import { CampSupplyIcon } from './CampSupplyIcon.jsx';
import './onboarding-example.css';

// An authored illustration, deliberately independent of the capture/session store.
const steps = ['hello', 'photo', 'plate', 'camp'];
const titles = {
  hello: 'Привет. Я Чуви!',
  photo: 'Попробуем на этом фото',
  plate: 'Вот что в тарелке',
  camp: 'А в лагере — новые запасы',
};

export function OnboardingExample({ onContinue, onSkip }) {
  const [step, setStep] = useState('hello');
  const heading = useRef(null);
  const scroll = useRef(null);
  useEffect(() => {
    scroll.current?.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
  }, [step]);
  const next = () => setStep(steps[steps.indexOf(step) + 1]);

  return <div className={`onboarding-intro onboarding-example onboarding-example-step-${step}`}>
    <header className="study-top onboarding-nav">
      {step !== 'hello' && <button type="button" aria-label="Назад" onClick={() => setStep(steps[steps.indexOf(step) - 1])}>←</button>}
      <span>{step === 'hello' ? 'chewy' : 'Пробный пример'}</span>
      <button type="button" className="study-text-button" onClick={onSkip}>Сразу в лагерь</button>
    </header>
    <div className="onboarding-scroll" ref={scroll}>
      {(step === 'hello' || step === 'camp') && <div className="study-mini-camp onboarding-scene">
        <div className="study-mini-ground" />
        <StudyMedia kind="tent" label="Палатка" />
        <StudyMedia kind="hero" label="Чуви" />
        <StudyMedia kind="fire" label="Костёр" />
        {step === 'camp' && <div className="onboarding-example-supplies" aria-label="Запасы в примере">
          {[['protein', 'Материалы'], ['carbs', 'Дрова'], ['plants', 'Семена']].map(([metric, label]) => <span key={metric}><CampSupplyIcon metric={metric} /><span>{label}</span></span>)}
        </div>}
      </div>}
      <div className="study-intro-copy onboarding-copy">
        <h1 ref={heading} tabIndex={-1}>{titles[step]}</h1>
        {step === 'hello' && <><p>Давай обустроим маленький лагерь вместе. Твоя еда поможет нам с запасами.</p><p className="onboarding-aside">Еда сейчас не нужна. У меня есть фото для пробы.</p></>}
        {step === 'photo' && <><p>В следующий раз ты снимешь свою еду. А сейчас нажми на готовое фото.</p>
          <button type="button" className="onboarding-example-photo" onClick={next} aria-label="Разобрать фото-пример">
            <StudyMedia kind="meal" label="Овощи с нутом и гарниром" /><span>Разобрать это фото</span>
          </button>
          <p className="onboarding-aside">Этот пример не попадёт в твой дневник.</p>
        </>}
        {step === 'plate' && <>
          <div className="onboarding-example-analysis">
            <div className="onboarding-example-plate" role="img" aria-label="Условная тарелка примера: овощи, нут и гарнир"><span>Овощи</span><span>Нут</span><span>Гарнир</span></div>
            <p>Здесь овощи, нут и гарнир. Вид крупы можно уточнить после разбора.</p>
          </div>
          <p>По фото ты увидишь состав своей еды. А Чуви получит запасы для лагеря.</p>
        </>}
        {step === 'camp' && <><p>Из этой еды — материалы, дрова и семена. «Вот и обустроимся!»</p><p className="onboarding-aside">Это был пример. Теперь познакомимся с твоим Чуви. Свою еду покажешь, когда будешь есть.</p></>}
      </div>
    </div>
    <footer className="study-intro-actions onboarding-actions">
      {step === 'hello' && <button type="button" className="study-primary" onClick={next}>Покажи, как это работает</button>}
      {step === 'photo' && <button type="button" onClick={onContinue}>Уже понятно, дальше</button>}
      {step === 'plate' && <button type="button" className="study-primary" onClick={next}>А что в лагере?</button>}
      {step === 'camp' && <button type="button" className="study-primary" onClick={onContinue}>К своему Чуви</button>}
    </footer>
  </div>;
}
