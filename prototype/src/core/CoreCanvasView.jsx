import { CANVAS_ASSETS, CANVAS_SIZE, frameStyle } from './canvas-layout.js';
import { AddFoodCanvas } from './AddFoodCanvas.jsx';
import './core-canvas.css';

function ImageBox({ asset, className = '', label, frame }) {
  return <div className={`canvas-image ${className}`} style={frameStyle(frame ?? asset.frame)} role="img" aria-label={`Место для изображения: ${label ?? asset.label}`}>
    <span>{label ?? asset.label}<small>{(frame ?? asset.frame).slice(2).join(' × ')}</small></span>
  </div>;
}

function CampImages({ assets, equipped, camp }) {
  return <>
    <ImageBox asset={assets.background} className="canvas-background" />
    {camp && <>
      <ImageBox asset={assets.hammock} className="canvas-preview-decor" />
      <ImageBox asset={assets.shelter} className="canvas-preview-decor canvas-shelter" />
    </>}
    {equipped && <ImageBox asset={assets.lantern} className="canvas-decor" />}
    <ImageBox asset={assets.hero} className="canvas-hero" />
    <ImageBox asset={assets.fire} className="canvas-fire" />
    {camp && <>
      <ImageBox asset={assets.kettle} className="canvas-preview-decor" />
      <ImageBox asset={assets.pet} className="canvas-preview-decor" />
    </>}
  </>;
}

export function CoreCanvasView({ screen, title, state, photo, portion, onReset, onCamp, onAdd, onScreen, onPhoto, onPortion, onFeed, onBuy, onEquip, lanternCost, compact }) {
  const fed = state.meals.length > 0;
  const assets = CANVAS_ASSETS[screen];
  if (screen === 'add') return <AddFoodCanvas compact={compact} />;
  return <section className={`canvas-workbench${compact ? ' canvas-compact' : ''}`}>
    <header className="canvas-review"><span>Канвас · {title}</span><button onClick={onReset}>Сбросить</button></header>
    <div className={`canvas-phone canvas-screen-${screen}`}>
      {(screen === 'camp' || screen === 'result') && <CampImages assets={assets} equipped={state.equipped} camp={screen === 'camp'} />}
      <div className="canvas-safe-top" aria-hidden="true" />
      <header className="canvas-top">{screen === 'camp' ? <span>chewy</span> : <button onClick={onCamp}>← Лагерь</button>}<span>Монеты: {state.coins}</span></header>

      {screen === 'camp' && <>
        <nav aria-label="Экраны лагеря">{[['pathLink', 'path', 'Путь'], ['backpackLink', 'backpack', 'Рюкзак']].map(([key, target, label]) => <button key={key} className="canvas-side-link" style={frameStyle(assets[key].frame)} onClick={() => onScreen(target)} aria-label={label}><span>{label}</span></button>)}</nav>
        <section className="canvas-food-unresolved"><strong>Сегодня · еда и тарелка</strong><span>Область пока без раскладки</span><small>Способ показа ещё обсуждаем</small></section>
        <footer className="canvas-actions"><button className="canvas-action-main" onClick={onAdd}>Добавить еду</button></footer>
      </>}

      {screen === 'result' && (state.result ? <>
        <p className="canvas-speech">«Спасибо, что заглянул!»</p>
        <div className="canvas-result-surface" />
        <ImageBox asset={assets.meal} />
        <ImageBox asset={assets.plate} />
        <p className="canvas-result-caption">Еда добавлена в тарелку дня</p>
        <p className="canvas-reward">+{state.result.coins} монет</p>
        <button className="canvas-action-main canvas-single-action" onClick={onCamp}>В лагерь</button>
      </> : <div className="canvas-empty-result"><p>Сначала добавь еду</p><button onClick={onAdd}>Добавить еду</button></div>)}

      {screen === 'path' && <>
        <h2 className="canvas-page-heading">Путь</h2>
        <ImageBox asset={assets.map} />
        <ImageBox asset={assets.fire} label={fed ? 'Костёр · горит' : 'Место костра'} />
        <p className="canvas-path-today">Сегодня</p>
        <p className="canvas-path-caption">{fed ? 'Костёр горит — еда записана' : 'Здесь начинается твой путь'}</p>
        <button className="canvas-single-action" onClick={onCamp}>В лагерь</button>
      </>}

      {screen === 'backpack' && <>
        <h2 className="canvas-page-heading">Рюкзак</h2>
        <div className="canvas-item-surface" />
        <ImageBox asset={assets.item} />
        <div className="canvas-item-copy"><h3>Фонарь</h3><p>Уютный свет у костра.</p><strong>{state.owned ? (state.equipped ? 'В лагере' : 'Куплен') : `${lanternCost} монет`}</strong></div>
        <div className="canvas-backpack-actions">{state.owned ? <button className="canvas-action-main" onClick={onEquip}>{state.equipped ? 'Убрать из лагеря' : 'Поставить в лагере'}</button> : <><button className="canvas-action-main" disabled={state.coins < lanternCost} onClick={onBuy}>Купить фонарь</button>{state.coins < lanternCost && <p>Пока не хватает монет. Можно вернуться позже.</p>}</>}<button onClick={onCamp}>В лагерь</button></div>
      </>}
      <div className="canvas-safe-bottom" aria-hidden="true" />
    </div>
    {!compact && <aside className="canvas-specs"><p className="canvas-note">База {CANVAS_SIZE.width} × {CANVAS_SIZE.height}. Размеры — области на экране, не разрешение исходных файлов. Размещение и тексты черновые. Диагонали обозначают будущие изображения. Пунктирный декор — пример наполнения сцены: число одновременно активных вещей ещё не выбрано.</p><h2>Какой контент сюда готовим</h2>{Object.entries(assets).map(([key, asset]) => <section key={key}><h3>{asset.label} <small>{asset.frame.slice(2).join(' × ')}</small></h3><p>{asset.content}</p><p className="canvas-treatment">{asset.treatment}</p>{key === 'lantern' && !state.equipped && <p className="canvas-treatment">В сцене появится после покупки и установки.</p>}</section>)}</aside>}
  </section>;
}
