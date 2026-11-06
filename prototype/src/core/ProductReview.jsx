import { useEffect, useState } from 'react';
import { ScreenStudy } from './ScreenStudy.jsx';
import { useDemoSession } from './use-demo-session.js';
import { captureDay } from './capture-session.js';
import { CampSandbox } from './CampSandbox.jsx';
import { StudyContentContext } from './StudyMedia.jsx';
import { GardenAppearance } from './GardenAppearance.jsx';
import { VARIANT_DEFAULTS } from './VariantMotion.jsx';
import './product-review.css';

// A separate, repeatable review clock and storage. Never imports the owner's run.
export const PRODUCT_REVIEW_KEY = 'chewy.product-review.v1';
const reviewTime = () => new Date(2026, 10, 5, 12).getTime();
const NONE = { protein: false, carbs: false, fats: false, plants: false };
const BREAKFAST = { ...NONE, carbs: true, plants: true };
const REACTIONS = {
  first: { title: 'Первый вклад', text: 'Первый свёрток появляется в рюкзаке. Короткий световой отклик помогает заметить припасы и сад.' },
  repeat: { title: 'Повторный вклад', text: 'Тот же рюкзак коротко откликается ещё раз. Наполнение остаётся прежним: новая ступень и её порог здесь не назначены.' },
  morning: { title: 'Новый день', text: 'Припасы нового дня ещё не появились. Купленные цветы и сам лагерь остаются на месте.' },
};

const ANSWERS_KEY = 'chewy.product-review.answers.v1';
const REVIEW_QUESTIONS = [
  { id: 'hero', title: 'Какой отклик еды приятнее?', recommendation: 'Рекомендация: лагерь и короткое движение Чуви, без подписи над головой.', choices: [['friend', 'Лагерь и Чуви'], ['camp', 'Только лагерь'], ['later', 'Пока не выбираю']] },
  { id: 'repeat', title: 'Как отмечать повторную еду?', recommendation: 'Рекомендация: отдельный короткий отклик, даже когда наполнение выглядит так же.', choices: [['response', 'Нужен отдельный отклик'], ['quiet', 'Достаточно записи в дневнике'], ['later', 'Пока не выбираю']] },
  { id: 'morning', title: 'Как воспринимается новый день?', recommendation: 'Рекомендация: спокойное начало дня с сохранением купленного оформления. Серый вид ещё требует выбора.', choices: [['calm', 'Спокойное начало'], ['loss', 'Похоже на потерю — доработать'], ['later', 'Пока не выбираю']] },
];
const readAnswers = () => {
  const raw = localStorage.getItem(ANSWERS_KEY);
  let saved;
  try { saved = JSON.parse(raw || '{}'); } catch { return {}; }
  return Object.fromEntries(REVIEW_QUESTIONS.filter(question => question.choices.some(([value]) => value === saved?.[question.id])).map(question => [question.id, saved[question.id]]));
};

function ReviewAnswers() {
  const [answers, setAnswers] = useState(() => { try { return readAnswers(); } catch { return {}; } });
  const [status, setStatus] = useState('Выбор не отмечен заранее. Можно ответить только на часть вопросов.');
  const [saveError, setSaveError] = useState('');
  const [unsaved, setUnsaved] = useState({});
  useEffect(() => {
    const sync = event => { if (event.key === ANSWERS_KEY || event.key === null) { try { setAnswers(readAnswers()); } catch { /* Keep the current answers if storage is unavailable. */ } } };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const choose = (id, value) => {
    try {
      const next = { ...readAnswers(), ...unsaved, [id]: value };
      localStorage.setItem(ANSWERS_KEY, JSON.stringify(next));
      setAnswers(next); setUnsaved({}); setSaveError(''); setStatus('Ответ сохранён в этом браузере.');
    } catch {
      setAnswers(previous => ({ ...previous, [id]: value }));
      setUnsaved(previous => ({ ...previous, [id]: value }));
      setStatus('Ответ пока только на экране.');
      setSaveError('Не удалось сохранить ответ. Скопируй текст ниже перед выходом.');
    }
  };
  const summary = ['Chewy · ответы после ревью', ...REVIEW_QUESTIONS.map(question => `${question.title} ${question.choices.find(([value]) => value === answers[question.id])?.[1] ?? 'Без ответа'}`), 'Это обратная связь по черновику; финальная приёмка core остаётся отдельно.'].join('\n');
  const copy = async () => {
    try { await navigator.clipboard.writeText(summary); setStatus('Ответы скопированы — можно отправить их в чат.'); }
    catch { setStatus('Выдели и скопируй текст в поле ниже.'); }
  };
  return <section className="review-answers" aria-labelledby="review-answers-title">
    <span className="review-kicker">ПОСЛЕ ПРОХОДА · ТРИ ВЫБОРА</span><h2 id="review-answers-title">Твои впечатления</h2>
    <p>Ответы сохраняются отдельно от прохода. Их можно поменять после следующей пробы.</p>
    {REVIEW_QUESTIONS.map(question => <fieldset key={question.id}><legend>{question.title}</legend><p className="review-note">{question.recommendation}</p>
      {question.choices.map(([value, label]) => <label key={value}><input type="radio" name={`answer-${question.id}`} checked={answers[question.id] === value} onChange={() => choose(question.id, value)} />{label}</label>)}
    </fieldset>)}
    {saveError && <p role="alert" className="review-error">{saveError}</p>}
    <p role="status">{status}</p><label className="review-answer-summary">Ответы для чата<textarea readOnly value={summary} rows={7} /></label>
    <button onClick={copy}>Скопировать ответы</button>
  </section>;
}

function ReactionDrafts({ device }) {
  const [event, setEvent] = useState('first');
  const [variant, setVariant] = useState('camp');
  const [take, setTake] = useState(0);
  const content = REACTIONS[event];
  return <div className="review-layout">
    <aside className="review-guide">
      <span className="review-kicker">ОТДЕЛЬНАЯ ВИЗУАЛЬНАЯ ПРОБА</span>
      <h2>Как лагерь отвечает</h2>
      <p>Эти реакции ещё не приняты. Они показывают направление движения на прежнем арте. Основной проход использует действующее поведение.</p>
      <fieldset><legend>Момент</legend>{Object.entries(REACTIONS).map(([id, item]) => <label key={id}><input type="radio" name="reaction-event" value={id} checked={event === id} onChange={() => { setEvent(id); setTake(value => value + 1); }} />{item.title}</label>)}</fieldset>
      <fieldset><legend>Вариант отклика</legend>
        <label><input type="radio" name="reaction-variant" checked={variant === 'camp'} onChange={() => { setVariant('camp'); setTake(value => value + 1); }} />Только лагерь</label>
        <label><input type="radio" name="reaction-variant" checked={variant === 'friend'} onChange={() => { setVariant('friend'); setTake(value => value + 1); }} />Лагерь и Чуви</label>
      </fieldset>
      <button className="review-primary" onClick={() => setTake(value => value + 1)}>Повторить отклик</button>
      <p className="review-caption" role="status">{content.text}{variant === 'friend' && event !== 'morning' ? ' Чуви делает короткое радостное движение без подписи над головой.' : ''}</p>
      <p className="review-note">При снижении движения — статичный акцент на затронутых предметах. Проба не выдаёт монеты и не меняет дневник.</p>
    </aside>
    <section className={`review-draft review-draft-${event} review-draft-${variant}`} aria-label={`Черновик: ${content.title}`}>
      <p className="review-scene-label">Черновик · {content.title}</p>
      <div key={`${event}-${variant}-${take}-${device}`} className="review-draft-scene screen-study-content" role="img" aria-label={content.text}>
        <div inert="" aria-hidden="true"><StudyContentContext.Provider value={true}>
          <CampSandbox persistPlacements={false} initialDevice={device} initialPreset="growth" presentation="art" foodLayout="separate" foodPresentation="journal" initialEditing={false} withMirror
            campStage="initial" dayPhase={event === 'morning' ? 'morning' : 'day'} worldLabel={event === 'morning' ? 'Хвойный лес · Утро' : 'Хвойный лес · День'}
            motionVariants={VARIANT_DEFAULTS} dailyContributions={event === 'morning' ? NONE : BREAKFAST}
            provisionsPreview={event === 'morning' ? 'resting' : 'first'} journalData={{ meals: [] }}
            objectReplacements={{ garden: <GardenAppearance appearance="flowers" /> }} />
        </StudyContentContext.Provider></div>
      </div>
    </section>
  </div>;
}

export function ProductReview() {
  const { store, session, dayKey, error } = useDemoSession({
    storage: () => window.localStorage,
    storageKey: PRODUCT_REVIEW_KEY,
    now: reviewTime,
  });
  const [tab, setTab] = useState('flow');
  const [device, setDevice] = useState(() => window.innerWidth < 422 ? 'compact' : 'standard');
  const [revision, setRevision] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(() => !window.matchMedia('(max-width: 760px)').matches);
  const day = captureDay(session.jobs, new Date(store.now()));
  const firstDay = session.entries[0]?.dayKey;
  const isNextDay = !!firstDay && dayKey !== firstDay;
  const pending = session.jobs.some(job => job.status === 'processing');
  const hasAppearance = !!session.inventory.applied.garden;
  const unseen = session.jobs.some(job => job.dayKey === dayKey && job.status === 'ready' && !job.seen);
  const stage = isNextDay ? 'morning' : unseen ? 'result' : day.meals.length >= 2 ? hasAppearance ? 'ready' : 'appearance' : day.meals.length === 1 ? 'repeat' : 'first';
  const guide = {
    result: ['Результат готов', 'В лагере открой «Сегодня», затем карточку готового разбора. Посмотри вклад еды и вернись в лагерь.', 'Разбор уже сохранён. Просмотр показывает результат и не начисляет награду повторно.'],
    first: ['Первое фото', 'В телефоне нажми «+ Еда» → «Галерея» → «Завтрак» → «Добавить фото». Сохрани и разбери. Затем нажми «Получить демоответ» здесь и открой «Сегодня» в лагере.', 'Посмотри, что изменилось в припасах и саду после первого разбора.'],
    repeat: ['Ещё один завтрак', 'Добавь вторую запись тем же способом. Получи демоответ и вернись в лагерь. Это отдельная запись с тем же составом.', 'Дневник и монеты пополнятся. Припасы останутся на первой ступени — достаточно ли такого отклика?'],
    appearance: ['Сделать лагерь своим', 'Открой «Рюкзак» → «Магазин». Купи «Цветы», примерь и примени. Вернись в лагерь.', 'Теперь можно отличить дневной вклад еды от приобретённого оформления.'],
    ready: ['Посмотреть следующий день', 'Нажми «Следующий день» здесь. Это перевод тестовых часов в этой пробе.', 'Сравни припасы, цветы, баланс и вчерашние записи.'],
    morning: ['Новый день', 'Открой «Сегодня»: новый день пока пуст. В «Пути» открой вчерашнюю стоянку и её записи. Вернись в лагерь.', 'Припасы начинают новый день, а вещи, монеты и история остаются. Затем посмотри отдельные черновики реакций.'],
  }[stage];
  const reset = () => {
    if (store.reset()) { setRevision(value => value + 1); setConfirmReset(false); }
  };
  return <main className="product-review" data-review-stage={stage}>
    <header className="review-header"><div><span className="review-kicker">CHEWY · РЕВЬЮ ЗА 10 МИНУТ</span><h1>Один день вместе</h1><p>Пройди существующий цикл, затем сравни черновики отклика.</p></div>
      <label>Размер для ревью<select value={device} onChange={event => setDevice(event.target.value)}><option value="compact">Компактный · 320</option><option value="standard">Обычный · 390</option><option value="large">Большой · 430</option></select></label>
    </header>
    <nav className="review-tabs" aria-label="Части ревью"><button aria-pressed={tab === 'flow'} onClick={() => setTab('flow')}>Основной проход</button><button aria-pressed={tab === 'drafts'} onClick={() => setTab('drafts')}>Черновики реакций</button><button aria-pressed={tab === 'answers'} onClick={() => setTab('answers')}>Мои ответы</button></nav>
    {error && <p role="alert" className="review-error">{error}</p>}
    <div className="review-layout" hidden={tab !== 'flow'}>
      <aside id="review-controls" className="review-guide">
        <span className="review-kicker">ПРОХОД · ОКОЛО 6 МИНУТ</span>
        <h2>{guide[0]}</h2>
        <details open={instructionsOpen} onToggle={event => setInstructionsOpen(event.currentTarget.open)}><summary>Как пройти этот шаг</summary>
          <p>{guide[1]}</p><p className="review-caption">{guide[2]}</p>
          <p className="review-note">Фото подготовлены заранее, ответ анализа и время управляются кнопками. Сессия ревью сохраняется отдельно; перезагрузка продолжает проход. Основной прогресс не меняется.</p>
          <button className="review-text-button" onClick={() => setConfirmReset(true)}>Начать проход заново</button>
        </details>
        <div className="review-actions"><button className="review-primary" disabled={!pending || !!error} onClick={() => store.completeAnalysis()}>Получить демоответ</button>
          <button disabled={stage !== 'ready' || pending || !!error} onClick={() => { if (store.advanceDays(1)) setRevision(value => value + 1); }}>Следующий день</button></div>
        <a className="review-jump" href="#review-phone">К прототипу ↓</a>
        {confirmReset && <section className="review-reset" aria-label="Подтверждение нового прохода"><p>Очистить только записи и покупки этой пробы? Основная сессия сохранится.</p><button disabled={!!error} onClick={reset}>Очистить пробу</button><button onClick={() => setConfirmReset(false)}>Продолжить проход</button></section>}
      </aside>
      <div id="review-phone" className="review-app"><a className="review-jump" href="#review-controls">К управлению разбором ↑</a><ScreenStudy key={revision} initialScreen="camp" presentation="content" reviewMode="walkthrough" sessionStore={store} reviewDevice={device} /></div>
    </div>
    {tab === 'drafts' && <ReactionDrafts device={device} />}
    <div hidden={tab !== 'answers'}><ReviewAnswers /></div>
    <footer className="review-footer"><strong>После прохода</strong><span>Понятна ли связь еды с лагерем? Какой повторный отклик приятнее? Новый день выглядит приглашением вернуться?</span><button onClick={() => setTab('answers')}>Записать впечатления</button></footer>
  </main>;
}
