import { useEffect, useRef, useState } from 'react';
import { DEMO_GARDEN_ITEMS, gardenAppearance, ownsGardenAppearance } from './demo-inventory.js';
import { GardenAppearance } from './GardenAppearance.jsx';
import { RewardWallet } from './RewardWallet.jsx';
import { StudyMedia } from './StudyMedia.jsx';
import { HeroAppearance } from './Headwear.jsx';
import { FoundWardrobe } from './FoundWardrobe.jsx';
import './backpack.css';

function GardenPreview({ appearance, headwearId }) {
  return <div className="study-mini-camp backpack-camp-preview" aria-label="Примерка в лагере">
    <div className="study-mini-ground" />
    <StudyMedia kind="tent" label="Палатка" />
    <HeroAppearance headwearId={headwearId} />
    <StudyMedia kind="fire" label="Костёр" />
    <GardenAppearance appearance={appearance} className="study-preview-item" />
  </div>;
}

function PurchaseDialog({ item, coins, onBuy, onClose, error }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  return <dialog ref={dialog} className="study-dialog" aria-labelledby="backpack-purchase-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <h2 id="backpack-purchase-title">Купить «{item.name}»?</h2>
    <p>Стоимость — {item.cost} монет.<br />После покупки останется {coins - item.cost}.</p>
    <p>Оформление появится в «Моё». Применить его можно отдельно.</p>
    {error && <p role="alert">{error}</p>}
    <button type="button" className="study-primary" disabled={coins < item.cost} onClick={onBuy}>Купить за {item.cost} монет</button>
    <button type="button" onClick={onClose}>Отмена</button>
  </dialog>;
}

export function Backpack({ inventory, store, onCamp, multiplier, initialSection = 'owned', initialFindingId, onExplore }) {
  const applied = gardenAppearance(inventory);
  const [section, setSection] = useState(initialSection);
  const [shelf, setShelf] = useState('owned');
  const [selectedId, setSelectedId] = useState(applied);
  const [previewId, setPreviewId] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const tryButton = useRef(null);
  const applyButton = useRef(null);
  const restoreTryFocus = useRef(false);
  const selectedButton = useRef(null);
  const restoreSelectionFocus = useRef(false);
  const findingsButton = useRef(null);
  const restoreFindingsFocus = useRef(false);
  const selected = DEMO_GARDEN_ITEMS.find(item => item.id === selectedId) ?? DEMO_GARDEN_ITEMS[0];
  const owned = ownsGardenAppearance(inventory, selected.id);
  const equipped = applied === selected.id;
  const visibleItems = shelf === 'owned' ? DEMO_GARDEN_ITEMS.filter(item => ownsGardenAppearance(inventory, item.id)) : DEMO_GARDEN_ITEMS.filter(item => item.id !== 'garden-base');
  const choose = id => { setSelectedId(id); setNotice(''); setError(''); };
  const changeShelf = next => {
    setShelf(next);
    choose(next === 'owned' ? applied : DEMO_GARDEN_ITEMS.find(item => !ownsGardenAppearance(inventory, item.id))?.id ?? 'flowers');
  };
  const cancelPreview = () => {
    restoreTryFocus.current = true;
    setPreviewId(null); setError(''); setNotice('Примерка отменена. В лагере всё по-прежнему.');
  };
  const buy = () => {
    if (!store.purchaseAppearance(selected.id)) {
      setError('Покупку не удалось сохранить. Попробуй ещё раз.');
      return;
    }
    restoreTryFocus.current = true;
    setConfirm(false); setError(''); setShelf('owned');
    setNotice(`${selected.name} теперь в «Моё». Можно примерить.`);
  };
  const apply = () => {
    if (!store.applyAppearance(previewId)) {
      setError('Выбор не удалось сохранить. Попробуй ещё раз.');
      return;
    }
    restoreSelectionFocus.current = true;
    setPreviewId(null); setError(''); setNotice('Оформление применено в лагере.');
  };
  useEffect(() => {
    if (!previewId) {
      if (restoreTryFocus.current) tryButton.current?.focus();
      if (restoreSelectionFocus.current) selectedButton.current?.focus();
      restoreTryFocus.current = false;
      restoreSelectionFocus.current = false;
      return;
    }
    applyButton.current?.focus();
    const escape = event => { if (event.key === 'Escape') { event.preventDefault(); cancelPreview(); } };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [previewId, notice]);
  useEffect(() => { setSection(initialSection); }, [initialSection]);
  useEffect(() => {
    if (section !== 'findings' && restoreFindingsFocus.current) {
      findingsButton.current?.focus(); restoreFindingsFocus.current = false;
    }
  }, [section]);
  if (section === 'findings') return <FoundWardrobe inventory={inventory} store={store} onExplore={onExplore} initialFindingId={initialFindingId} backLabel="В рюкзак" onCamp={() => { restoreFindingsFocus.current = true; setSection('owned'); }} />;
  return <>
    <header className="study-top backpack-heading"><button type="button" onClick={previewId ? cancelPreview : onCamp} aria-label={previewId ? 'Отменить примерку' : 'В лагерь'}>←</button><h1>{previewId ? 'Примерка' : 'Рюкзак'}</h1><RewardWallet coins={inventory.coins} multiplier={multiplier} /></header>
    {previewId ? <>
      <div className="backpack-preview-body">
        <GardenPreview appearance={previewId} headwearId={inventory.applied.headwear} />
        <h2>{selected.name}</h2><p>Посмотри, как будет выглядеть твой сад.</p>
      </div>
      <footer className="backpack-actions">
        {error && <p role="alert">{error}</p>}
        <button ref={applyButton} type="button" className="study-primary" onClick={apply}>Применить</button>
        <button type="button" onClick={cancelPreview}>Отменить примерку</button>
      </footer>
    </> : <>
      <nav className="study-categories backpack-shelves" aria-label="Разделы рюкзака">
        <button type="button" aria-pressed={shelf === 'owned'} onClick={() => changeShelf('owned')}>Моё</button>
        <button type="button" aria-pressed={shelf === 'shop'} onClick={() => changeShelf('shop')}>Магазин</button>
        <button ref={findingsButton} type="button" aria-pressed={false} onClick={() => { store.markExplorationSeen?.(); setSection('findings'); }}>Находки</button>
      </nav>
      <div className="backpack-scroll">
        <section className="backpack-item-card" aria-label={`Карточка: ${selected.name}`}>
          <GardenAppearance appearance={selected.id} />
          <div><small>Оформление сада</small><h2>{selected.name}</h2><p>{selected.description}</p></div>
        </section>
        <div className="study-catalog backpack-catalog" aria-label={shelf === 'owned' ? 'Мои оформления' : 'Оформления в магазине'}>
          {visibleItems.map(item => <button ref={selected.id === item.id ? selectedButton : undefined} type="button" key={item.id} aria-pressed={selected.id === item.id} onClick={() => choose(item.id)} aria-label={`Выбрать: ${item.name}`}>
            <GardenAppearance appearance={item.id} />
            <strong>{item.name}</strong><small>{applied === item.id ? 'В лагере' : item.id === 'garden-base' ? 'Базовый вид' : ownsGardenAppearance(inventory, item.id) ? 'Куплено' : `${item.cost} монет`}</small>
          </button>)}
        </div>
      </div>
      <footer className="backpack-actions">
        <p className="backpack-notice" role="status">{notice || (equipped ? 'Сейчас в твоём лагере.' : owned ? 'Можно примерить перед применением.' : inventory.coins < selected.cost ? 'Пока не хватает монет. Можно вернуться позже.' : 'Покупка добавит оформление в «Моё».')}</p>
        {owned ? <button ref={tryButton} type="button" className="study-primary" disabled={equipped} onClick={() => { setPreviewId(selected.id); setError(''); }}>Примерить</button> : <button type="button" className="study-primary" disabled={inventory.coins < selected.cost} onClick={() => { setError(''); setConfirm(true); }}>Купить · {selected.cost} монет</button>}
      </footer>
    </>}
    {confirm && <PurchaseDialog item={selected} coins={inventory.coins} error={error} onBuy={buy} onClose={() => { setConfirm(false); setError(''); }} />}
  </>;
}
