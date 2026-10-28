import { useContext, useEffect, useLayoutEffect, useRef } from 'react';
import { StudyContentContext } from './StudyMedia.jsx';
import { samplePhoto } from './study-content.js';

export function Portions({ value, onChange }) {
  return <fieldset className="capture-portions"><legend>Порция</legend><div>{['Небольшая', 'Обычная', 'Большая'].map((label, index) => <button type="button" key={label} aria-pressed={value === index} onClick={() => onChange(index)}>{label}</button>)}</div></fieldset>;
}

export function CapturePhotoStrip({ photos, selected, onSelect, onAdd, revealSelected = false }) {
  const content = useContext(StudyContentContext);
  const strip = useRef(null);
  useLayoutEffect(() => {
    if (!revealSelected) return;
    const row = strip.current;
    const photo = row.querySelector('[aria-pressed="true"]');
    if (!photo) return;
    const frame = row.getBoundingClientRect(), item = photo.getBoundingClientRect();
    if (item.right > frame.right - 4) row.scrollLeft += item.right - frame.right + 4;
    else if (item.left < frame.left + 4) row.scrollLeft -= frame.left - item.left + 4;
  }, [selected, revealSelected]);
  return <div ref={strip} className="capture-photo-strip" role="group" aria-label="Снимки одного приёма пищи">
    {photos.map((photo, index) => <button type="button" key={photo.id} className="capture-photo-thumb" data-photo-id={photo.id} aria-label={`Фото ${index + 1}`} aria-pressed={selected === photo.id} onClick={() => onSelect(photo.id)}>
      {content ? <img src={samplePhoto(photo.imageKey).src} alt="" /> : <span>Фото</span>}<small>{index + 1}</small>
    </button>)}
    {onAdd && <button type="button" className="capture-photo-add" onClick={onAdd}><span aria-hidden="true">+</span>Ещё фото</button>}
  </div>;
}

export function CaptureDetails({ notes, portion, onNotes, onPortion, onClose }) {
  const sheet = useRef(null);
  useEffect(() => {
    const trigger = document.activeElement;
    sheet.current.querySelector('button').focus();
    return () => trigger?.focus?.({ preventScroll:true });
  }, []);
  return <div className="capture-sheet-overlay" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={sheet} className="capture-details-sheet" role="dialog" aria-modal="true" aria-labelledby="capture-details-title" onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key === 'Tab') {
        const items = [...sheet.current.querySelectorAll('button,textarea')];
        const first = items[0], last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }}>
      <header><div><h3 id="capture-details-title">Детали еды</h3><p>Можно добавить сейчас или позже.</p></div><button type="button" aria-label="Закрыть детали" onClick={onClose}>×</button></header>
      <label>Что осталось за кадром?<textarea maxLength={500} value={notes} onChange={event => onNotes(event.target.value)} placeholder="Например: соус с йогуртом, внутри сыр" /></label>
      <Portions value={portion} onChange={onPortion} />
      <button type="button" className="capture-primary" onClick={onClose}>Готово</button>
    </section>
  </div>;
}
