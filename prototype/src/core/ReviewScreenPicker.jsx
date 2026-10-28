import { STUDY_SCREENS } from './screen-study-data.js';
import { useReviewArchive } from './use-review-archive.js';

export function ReviewScreenPicker({ screen, onNavigate }) {
  const { archive, error, change } = useReviewArchive();
  const removed = new Set(archive.screens.map(entry => entry.id));
  const visible = Object.entries(STUDY_SCREENS).filter(([id]) => !removed.has(id));
  const currentVisible = !removed.has(screen);
  const remove = () => {
    if (!change('screens', { id: screen, label: STUDY_SCREENS[screen].title }, true)) return;
    const next = visible.find(([id]) => id !== screen);
    if (next) onNavigate(next[0]);
  };
  return <section className="review-screen-picker" aria-label="Управление списком экранов">
    <label>Экран<select value={currentVisible ? screen : ''} disabled={!visible.length} onChange={event => onNavigate(event.target.value)}>
      {!currentVisible && <option value="" disabled>{visible.length ? 'Текущий экран удалён из списка' : 'Список экранов пуст'}</option>}
      {visible.map(([id, data]) => <option key={id} value={id}>{data.title}</option>)}
    </select></label>
    {currentVisible
      ? <button type="button" className="review-remove-screen" onClick={remove}>Удалить экран из списка</button>
      : <p role="status">«{STUDY_SCREENS[screen].title}» удалён из списка. Переходы внутри приложения остаются доступны.</p>}
    {!!archive.screens.length && <details className="review-removed-screens">
      <summary>Удалённые экраны · {archive.screens.length}</summary>
      <ul>{archive.screens.map(entry => <li key={entry.id}>
        <span>{entry.label}</span>
        <button type="button" aria-label={`Восстановить экран «${entry.label}»`} onClick={() => {
          if (change('screens', entry, false) && !currentVisible && STUDY_SCREENS[entry.id]) onNavigate(entry.id);
        }}>Вернуть</button>
      </li>)}</ul>
    </details>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
