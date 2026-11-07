import { useEffect, useRef, useState } from 'react';
import { StudyMedia } from './StudyMedia.jsx';
import { HeroAppearance } from './Headwear.jsx';
import { CampSupplyIcon } from './CampSupplyIcon.jsx';
import './onboarding-intro.css';
import './onboarding-draft.css';

const CHAPTERS = ['Встреча', 'Фото', 'Лагерь', 'Твой Чуви'];
const CONTRIBUTIONS = [
  { id: 'protein', food: 'Нут', object: 'Палатка', text: 'Белок из нута помогает обустраивать палатку.' },
  { id: 'carbs', food: 'Гарнир', object: 'Костёр', text: 'Углеводы из гарнира поддерживают огонь.' },
  { id: 'plants', food: 'Овощи', object: 'Растения', text: 'Овощи помогают растениям в лагере расти.' },
];

function IntroCamp({ active, revealed = false }) {
  return <div className={`intro-forest${revealed ? ' intro-forest-revealed' : ''}`} role="img" aria-label={revealed ? 'Пример: палатка, костёр и растения получили вклад от еды' : 'Чуви встречает тебя в лесном лагере'}>
    <div className="intro-forest-sun" aria-hidden="true" />
    <div className={`intro-camp-object intro-camp-tent${active === 'protein' ? ' is-explained' : ''}`}><StudyMedia kind="tent" label="Палатка" /></div>
    <HeroAppearance className="intro-camp-hero" />
    <div className={`intro-camp-object intro-camp-fire${active === 'carbs' ? ' is-explained' : ''}`}><StudyMedia kind="fire" label="Костёр" /></div>
    {revealed && <div className={`intro-camp-object intro-camp-flowers${active === 'plants' ? ' is-explained' : ''}`}><StudyMedia kind="flowers" label="Растения" /></div>}
    {revealed && <div className="intro-camp-photo" aria-hidden="true"><StudyMedia kind="meal" /></div>}
  </div>;
}

// An authored example, independent of the capture and reward stores.
// Name/profile persistence remains a separate product decision.
export function OnboardingDraft({ onFinish, name = '', onNameChange = () => {} }) {
  const [step, setStep] = useState(0);
  const [active, setActive] = useState('protein');
  const [editingName, setEditingName] = useState(false);
  const heading = useRef(null);
  const scroll = useRef(null);
  const nameInput = useRef(null);
  const contribution = CONTRIBUTIONS.find(item => item.id === active);
  const displayName = name.trim() || 'Чуви';

  useEffect(() => {
    scroll.current?.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
  }, [step]);
  useEffect(() => { if (editingName) nameInput.current?.focus(); }, [editingName]);

  return <div className={`onboarding-intro onboarding-story intro-step-${step}`}>
    <header className="intro-story-nav onboarding-nav">
      {step > 0 ? <button type="button" className="intro-back" aria-label="Назад" onClick={() => setStep(value => value - 1)}>←</button> : <span className="intro-wordmark">chewy<span aria-hidden="true">✳</span></span>}
      {step > 0 && <span className="intro-chapter">{step < 3 ? 'Пробный пример' : 'Твой Чуви'}</span>}
      <button type="button" className="intro-skip" onClick={onFinish}>Сразу в лагерь</button>
    </header>

    <div className="intro-story-scroll" ref={scroll}>
      <div key={step} className="intro-story-page">
        {step === 0 && <>
          <IntroCamp />
          <div className="intro-paper intro-welcome-copy">
            <span className="intro-eyebrow">Маленький друг. Свой уголок.</span>
            <h1 ref={heading} tabIndex={-1}>Привет, я Чуви!</h1>
            <p>Давай жить в этом лагере вместе. Ты фотографируешь свою еду — я получаю энергию, а лагерь оживает.</p>
            <p className="intro-handnote">У меня есть фото. Покажу?</p>
          </div>
        </>}

        {step === 1 && <>
          <div className="intro-photo-copy">
            <span className="intro-eyebrow">Один снимок — начало истории</span>
            <h1 ref={heading} tabIndex={-1}>Начнём с этого обеда</h1>
            <p>Свою еду снимать пока не нужно.</p>
          </div>
          <div className="intro-photo-desk">
            <div className="intro-photo-sheet" aria-hidden="true" />
            <button type="button" className="intro-photo-print" aria-label="Разобрать фото-пример" onClick={() => setStep(2)}>
              <span className="intro-photo-tape" aria-hidden="true" />
              <StudyMedia kind="meal" label="Овощи с нутом и гарниром" />
              <span className="intro-photo-caption">Овощи, нут и гарнир<span aria-hidden="true">↗</span></span>
            </button>
            <p className="intro-photo-note">Фото превращается<br />в маленькую историю лагеря.</p>
          </div>
        </>}

        {step === 2 && <>
          <IntroCamp active={active} revealed />
          <div className="intro-paper intro-result-copy">
            <span className="intro-eyebrow">Та же еда. Теперь в мире Чуви.</span>
            <h1 ref={heading} tabIndex={-1}>Лагерь оживает</h1>
            <div className="intro-contributions" role="group" aria-label="Что еда даёт лагерю">
              {CONTRIBUTIONS.map(item => <button type="button" key={item.id} aria-pressed={active === item.id} onClick={() => setActive(item.id)}>
                <span className="intro-ingredient">{item.food}</span>
                <CampSupplyIcon metric={item.id} />
                <span>{item.object}</span>
              </button>)}
            </div>
            <p className="intro-contribution-copy" aria-live="polite">{contribution.text}</p>
            <p className="intro-aside">Это только пример. Он не добавит запись в твой дневник.</p>
          </div>
        </>}

        {step === 3 && <>
          <div className="intro-mirror-room">
            <div className="intro-mirror-frame"><HeroAppearance /></div>
            <span className="intro-mirror-shelf" aria-hidden="true" />
            <span className="intro-mirror-leaf" aria-hidden="true">✳</span>
          </div>
          <div className="intro-paper intro-friend-copy">
            <span className="intro-eyebrow">Теперь — ваша история</span>
            <h1 ref={heading} tabIndex={-1}>Будем знакомы</h1>
            <p>Можно звать меня Чуви.<br />А можно придумать своё имя.</p>
            <form id="intro-friend-name" onSubmit={event => { event.preventDefault(); onFinish(); }}>
              {editingName ? <label className="intro-name-field">Имя друга
                <input ref={nameInput} maxLength={24} placeholder="Чуви" value={name} onChange={event => onNameChange(event.target.value)} autoComplete="off" enterKeyHint="done" />
              </label> : <button type="button" className="intro-name-tag" onClick={() => setEditingName(true)} aria-label="Изменить имя друга"><span>{displayName}</span><span className="intro-name-edit">изменить имя ↗</span></button>}
            </form>
          </div>
        </>}
      </div>
    </div>

    <footer className="intro-story-footer onboarding-actions">
      <p className="intro-footer-note">{step === 0 ? 'Можно начать без еды под рукой' : step === 1 ? 'Готовое фото · камера не понадобится' : step === 2 ? 'А теперь познакомимся с твоим Чуви' : 'Первое фото — когда тебе будет удобно'}</p>
      {step === 0 ? <button key="start" type="button" className="study-primary" onClick={() => setStep(1)}>Попробовать на примере <span aria-hidden="true">→</span></button>
        : step === 1 ? <button key="photo" type="button" className="study-primary" onClick={() => setStep(2)}>Посмотреть, что получится <span aria-hidden="true">→</span></button>
        : step === 2 ? <button key="friend" type="button" className="study-primary" onClick={() => setStep(3)}>К своему Чуви <span aria-hidden="true">→</span></button>
        : <button key="finish" type="submit" form="intro-friend-name" className="study-primary">В свой лагерь <span aria-hidden="true">→</span></button>}
      <ol className="intro-chapter-marks" aria-label="Шаги знакомства">{CHAPTERS.map((title, index) => <li key={title} aria-current={step === index ? 'step' : undefined} aria-label={title}><span aria-hidden="true" /></li>)}</ol>
    </footer>
  </div>;
}
