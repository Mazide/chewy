import { useEffect, useRef, useState } from 'react';
import { EXPLORATION_ROUTES } from './exploration-study.js';
import { Headwear, HeroAppearance } from './Headwear.jsx';
import './found-wardrobe.css';

export function FoundWardrobe({ inventory, store, onCamp, onExplore, backLabel = 'В лагерь', initialFindingId }) {
  const items = EXPLORATION_ROUTES.filter(route => inventory.owned.includes(route.findingId));
  const applied = inventory.applied.headwear ?? null;
  const initialFindingOwned = items.some(item => item.findingId === initialFindingId);
  const [selectedId, setSelectedId] = useState(initialFindingOwned ? initialFindingId : applied ?? items[0]?.findingId ?? null);
  const [previewId, setPreviewId] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const heading = useRef(null);
  const tryButton = useRef(null);
  const applyButton = useRef(null);
  const selectedButton = useRef(null);
  const restoreFocus = useRef(null);
  const selected = items.find(item => item.findingId === selectedId) ?? items[0];
  const equipped = selected && selected.findingId === applied;
  const cancelPreview = () => {
    restoreFocus.current = 'try'; setPreviewId(null); setError('');
    setNotice('Примерка отменена. Чуви выглядит по-прежнему.');
  };
  const apply = id => {
    let saved = false;
    try { saved = store.applyHeadwear(id); } catch { /* Keep the preview open so the choice can be retried. */ }
    if (!saved) { setError('Выбор не удалось сохранить. Попробуй ещё раз.'); return; }
    restoreFocus.current = 'item'; setPreviewId(null); setError('');
    setNotice(id ? 'Новый головной убор уже на Чуви.' : 'Головной убор снят и остаётся в находках.');
  };
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => { if (initialFindingOwned) setSelectedId(initialFindingId); }, [initialFindingId, initialFindingOwned]);
  useEffect(() => {
    if (!previewId) {
      if (restoreFocus.current === 'try') tryButton.current?.focus();
      if (restoreFocus.current === 'item') selectedButton.current?.focus();
      restoreFocus.current = null;
      return;
    }
    applyButton.current?.focus();
    const escape = event => { if (event.key === 'Escape') { event.preventDefault(); cancelPreview(); } };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [previewId, notice]);

  return <>
    <header className="study-top found-wardrobe-heading"><button type="button" aria-label={previewId ? 'Отменить примерку' : backLabel} onClick={previewId ? cancelPreview : onCamp}>←</button><h1 ref={heading} tabIndex={-1}>{previewId ? 'Примерка' : 'Находки'}</h1></header>
    <div className="found-wardrobe-scroll">
      <div className="found-wardrobe-portrait"><HeroAppearance headwearId={previewId ?? applied} /><span aria-hidden="true" /></div>
      {!items.length ? <div className="found-wardrobe-copy"><h2>Здесь будут находки</h2><p>В окрестностях встречаются вещи, которые можно взять с собой. Посмотрим, что найдётся?</p></div> : <>
        <div className="found-wardrobe-copy"><small>{selected.name}</small><h2>{selected.findingName}</h2><p>{previewId ? 'Как тебе? Можно оставить этот образ или вернуться к прежнему.' : selected.findingId === 'hat-bucket' ? 'Панама с тихого берега. Маленькое напоминание о воде и приключении.' : 'Шляпа с тропы среди сосен. В ней можно отправляться к новым местам.'}</p></div>
        {!previewId && <div className="found-wardrobe-collection" aria-label="Найденные головные уборы">
          {items.map(item => <button ref={selected.findingId === item.findingId ? selectedButton : undefined} type="button" key={item.findingId} aria-pressed={selected.findingId === item.findingId} aria-label={`Выбрать: ${item.findingName}`} onClick={() => { setSelectedId(item.findingId); setNotice(''); setError(''); }}>
            <Headwear id={item.findingId} /><strong>{item.findingName}</strong><small>{applied === item.findingId ? 'На Чуви' : item.name}</small>
          </button>)}
        </div>}
      </>}
    </div>
    <footer className="found-wardrobe-actions">
      {error && <p role="alert">{error}</p>}
      <p role="status">{notice || (previewId ? 'Выбор применится, когда нажмёшь «Надеть».' : equipped ? 'Сейчас на Чуви.' : '')}</p>
      {!items.length ? onExplore && <button type="button" className="study-primary" onClick={onExplore}>Исследовать окрестности</button> : previewId ? <><button ref={applyButton} type="button" className="study-primary" onClick={() => apply(previewId)}>Надеть</button><button type="button" onClick={cancelPreview}>Отменить примерку</button></> : <>
        {equipped ? <button type="button" onClick={() => apply(null)}>Снять головной убор</button> : <button ref={tryButton} type="button" className="study-primary" onClick={() => { setPreviewId(selected.findingId); setNotice(''); setError(''); }}>Примерить</button>}
        {onExplore && <button type="button" onClick={onExplore}>К окрестностям</button>}
      </>}
    </footer>
  </>;
}
