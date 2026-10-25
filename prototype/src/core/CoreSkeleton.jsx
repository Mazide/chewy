import { useState } from 'react';
import { EMPTY_PLATE, ITEMS, MEAL_PRESETS, plateFractions, scoreMeal } from '../data/game.js';
import './core-skeleton.css';
import { CoreCanvasView } from './CoreCanvasView.jsx';

const SAMPLE = MEAL_PRESETS.find((meal) => meal.id === 'salad');
const LANTERN = ITEMS.find((item) => item.id === 'lantern');
const VISIBLE_MEALS = 2;
const TITLES = {
  camp: 'Лагерь', add: 'Добавить еду', result: 'Результат',
  path: 'Путь', backpack: 'Рюкзак',
};
const PURPOSES = {
  camp: 'Главный экран: герой, тарелка и сегодняшние записи вместе.',
  add: 'Фото и порция. Камеру пока заменяет пример еды.',
  result: 'Реакция героя, изменение тарелки дня и награда.',
  path: 'Возвращения и прогресс по дням. Пока только сегодняшний день.',
  backpack: 'Купить вещь, применить и увидеть её в лагере.',
};

function makeState(mealCount, initialCoins) {
  const state = {
    meals: [],
    plate: { ...EMPTY_PLATE },
    coins: initialCoins,
    result: null,
    owned: false,
    equipped: false,
  };
  for (let index = 0; index < mealCount; index++) {
    const result = scoreMeal(state.plate, SAMPLE, 1, state.meals.length);
    state.meals.push({ id: index + 1, name: 'Овощи с гарниром' });
    state.plate = result.plateAfter;
    state.coins += result.coins;
    state.result = result;
  }
  return state;
}

function Plate({ plate }) {
  const fills = plateFractions(plate);
  const spans = [['veg', 180, '#879a85'], ['protein', 90, '#aa9384'], ['grain', 90, '#b7ab83']];
  let angle = 0;
  const stops = spans.flatMap(([key, span, color]) => {
    const start = angle;
    angle += span;
    return [`${color} ${start}deg ${start + span * fills[key]}deg`, `#e7e6e1 ${start + span * fills[key]}deg ${angle}deg`];
  });
  return <div className="core-plate" role="img" aria-label="Тарелка дня: сектора овощей, белка и злаков" style={{ background: `conic-gradient(${stops.join(', ')})` }} />;
}

function Scene({ fed, equipped, reaction = false }) {
  return (
    <div className="core-scene" aria-label="Схема лагеря">
      <div className="core-scene-label">Место для сцены лагеря</div>
      <div className="core-hero">Герой<span>{reaction ? 'Радуется' : fed ? 'После еды' : 'Ждёт встречи'}</span></div>
      <div className="core-campfire">Костёр</div>
      {equipped && <div className="core-decor">Фонарь</div>}
    </div>
  );
}

export function CoreSkeleton({ initialScreen = 'camp', seeded = false, initialMealCount = seeded ? 1 : 0, initialCoins = 0, compact = false, presentation = 'skeleton' }) {
  const [screen, setScreen] = useState(initialScreen);
  const [state, setState] = useState(() => makeState(initialMealCount, initialCoins));
  const [photo, setPhoto] = useState(false);
  const [portion, setPortion] = useState(1);
  const [showAllMeals, setShowAllMeals] = useState(false);
  const fed = state.meals.length > 0;
  const latestMeals = [...state.meals].reverse();
  const visibleMeals = showAllMeals ? latestMeals : latestMeals.slice(0, VISIBLE_MEALS);
  const camp = () => setScreen('camp');
  const add = () => { setPhoto(false); setPortion(1); setScreen('add'); };
  const reset = () => {
    setState(makeState(initialMealCount, initialCoins));
    setScreen(initialScreen);
    setPhoto(false);
    setPortion(1);
    setShowAllMeals(false);
  };
  const feed = () => {
    if (!photo) return;
    const result = scoreMeal(state.plate, SAMPLE, portion, state.meals.length);
    setState({
      ...state, result, plate: result.plateAfter, coins: state.coins + result.coins,
      meals: [...state.meals, { id: state.meals.length + 1, name: 'Овощи с гарниром' }],
    });
    setPhoto(false);
    setShowAllMeals(false);
    setScreen('result');
  };
  const buy = () => setState((current) => current.owned || current.coins < LANTERN.cost
    ? current : { ...current, owned: true, coins: current.coins - LANTERN.cost });

  if (presentation === 'canvas') return <CoreCanvasView
    screen={screen} title={TITLES[screen]} state={state} photo={photo} portion={portion}
    onReset={reset} onCamp={camp} onAdd={add} onScreen={setScreen}
    onPhoto={() => setPhoto(true)} onPortion={setPortion} onFeed={feed} onBuy={buy}
    onEquip={() => setState((current) => ({ ...current, equipped: !current.equipped }))}
    lanternCost={LANTERN.cost} compact={compact}
  />;

  return (
    <section className={`core-workbench${compact ? ' core-compact' : ''}`}>
      <div className="core-review-bar"><span>Скелет кора · без медиа</span><button onClick={reset}>Сбросить</button></div>
      <div className="core-phone">
        <header className="core-header">
          {screen !== 'camp' ? <button className="core-back" onClick={camp}>← В лагерь</button> : <span className="core-brand">chewy</span>}
          <span className="core-wallet">{state.coins} монет</span>
        </header>
        <main className={`core-content core-screen-${screen}`}>
          <div className="core-heading"><h1>{TITLES[screen]}</h1></div>

          {screen === 'camp' && <>
            <Scene fed={fed} equipped={state.equipped} />
            <section className="core-today core-card" aria-label="Сегодня">
              <div className="core-day">
                <Plate plate={state.plate} /><span><h2>Сегодня</h2><small>Тарелка дня</small></span>
              </div>
              {fed ? <ul className="core-meals" aria-label="Еда сегодня">{visibleMeals.map((meal, index) => <li className="core-meal" key={meal.id}>
                <span className="core-meal-icon" aria-hidden="true" /><span><strong>{meal.name}</strong><small>{index === 0 ? 'Последняя запись' : 'Добавлено сегодня'}</small></span>
              </li>)}</ul> : <p className="core-today-empty">Сегодня пока нет записей.</p>}
              {state.meals.length > VISIBLE_MEALS && <button className="core-meals-toggle" aria-expanded={showAllMeals} onClick={() => setShowAllMeals((current) => !current)}>{showAllMeals ? 'Свернуть список' : 'Показать остальные'}</button>}
            </section>
            <button className="core-button core-primary" onClick={add}>Добавить еду</button>
            <nav className="core-nav" aria-label="Экраны лагеря">
              <button onClick={() => setScreen('path')}>Путь</button>
              <button onClick={() => setScreen('backpack')}>Рюкзак</button>
            </nav>
          </>}

          {screen === 'add' && <>
            <button className={`core-photo${photo ? ' core-photo-selected' : ''}`} onClick={() => setPhoto(true)}>
              <span className="core-photo-mark" aria-hidden="true">{photo ? '✓' : '+'}</span>
              <strong>{photo ? 'Овощи с гарниром' : 'Выбрать фото'}</strong>
              <small>{photo ? 'Фото выбрано' : 'Камера или галерея'}</small>
            </button>
            <fieldset className="core-portions"><legend>Порция</legend><div>{['Небольшая', 'Обычная', 'Большая'].map((label, index) => <button key={label} aria-pressed={portion === index} onClick={() => setPortion(index)}>{label}</button>)}</div></fieldset>
            <button className="core-button core-primary" disabled={!photo} onClick={feed}>Добавить еду</button>
          </>}

          {screen === 'result' && (state.result ? <>
            <Scene fed equipped={state.equipped} reaction />
            <p className="core-speech">«Спасибо, что заглянул!»</p>
            <div className="core-day core-card"><Plate plate={state.plate} /><span><strong>Овощи с гарниром</strong><small>Добавлено в тарелку дня</small></span></div>
            <div className="core-reward">+{state.result.coins} монет</div>
            <button className="core-button core-primary" onClick={camp}>В лагерь</button>
          </> : <><p className="core-empty">Сначала добавь еду — здесь появится результат.</p><button className="core-button core-primary" onClick={add}>Добавить еду</button></>)}

          {screen === 'path' && <>
            <p className="core-lead">Каждый день с тобой — часть пути.</p>
            <div className="core-trail"><div className={`core-stop${fed ? ' core-stop-lit' : ''}`} /><strong>Сегодня</strong><span>{fed ? 'Костёр горит — еда записана' : 'Здесь начинается твой путь'}</span><div className="core-trail-line" /><small>Продолжение впереди</small></div>
            <button className="core-button core-primary" onClick={camp}>В лагерь</button>
          </>}

          {screen === 'backpack' && <>
            <p className="core-lead">Вещи для твоего лагеря.</p>
            <div className="core-item core-card"><div className="core-item-placeholder">Предмет</div><div><h2>Фонарь</h2><p>Уютный свет у костра.</p><strong>{state.owned ? (state.equipped ? 'В лагере' : 'Твой фонарь') : `${LANTERN.cost} монет`}</strong></div></div>
            {!state.owned ? <><button className="core-button core-primary" disabled={state.coins < LANTERN.cost} onClick={buy}>Купить фонарь</button>{state.coins < LANTERN.cost && <p className="core-hint">Пока не хватает монет. Можно вернуться позже.</p>}</> : <button className="core-button core-primary" onClick={() => setState((current) => ({ ...current, equipped: !current.equipped }))}>{state.equipped ? 'Убрать из лагеря' : 'Поставить в лагере'}</button>}
            <button className="core-button" onClick={camp}>В лагерь</button>
          </>}
        </main>
        <footer className="core-home-indicator" aria-hidden="true" />
      </div>
      <p className="core-purpose">{PURPOSES[screen]}</p>
      {!compact && <p className="core-demo-note">Демоданные · фото заменено примером, анализ мгновенный. Баланс и правила взяты из прежнего демо, это не финальный тюнинг. Состояние живёт до сброса или перезагрузки. Тексты — черновые.</p>}
    </section>
  );
}

export function CoreOverview({ presentation = 'skeleton' }) {
  return <div className="core-overview"><header><p>{presentation === 'canvas' ? 'CHEWY / CORE CANVAS' : 'CHEWY / CORE SKELETON'}</p><h1>Кор по экранам</h1><p>Лагерь → еда → результат → лагерь → вещь. Каждый экран можно потыкать отдельно.</p><p>Демосостояния независимы. Фото, анализ и сохранение — заглушки; экономика и тексты черновые.</p></header><div className="core-overview-grid">{Object.keys(TITLES).map((screen) => <div key={screen}><h2>{TITLES[screen]}</h2><CoreSkeleton presentation={presentation} initialScreen={screen} seeded={screen !== 'camp' && screen !== 'add'} initialCoins={screen === 'backpack' ? LANTERN.cost : 0} compact /></div>)}</div></div>;
}
