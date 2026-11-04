import { useRef, useState } from 'react';
import './reward-wallet.css';

const format = value => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);

export function RewardWallet({ coins, multiplier }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef(null);
  const close = () => { dialog.current.close(); setOpen(false); };
  return <div className="reward-wallet">
    <button type="button" className="reward-wallet-button" aria-label={`${format(coins)} монет. Множитель ×${format(multiplier)} за регулярность`} aria-haspopup="dialog" aria-expanded={open} onClick={() => { dialog.current.showModal(); setOpen(true); }}>
      <strong>{format(coins)} монет</strong><small>×{format(multiplier)} за регулярность</small>
    </button>
    <dialog ref={dialog} className="reward-explanation" aria-label="Монеты за регулярность" onCancel={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <h2>Монеты за регулярность</h2>
      <p>Первое фото каждой новой записи сразу приносит монеты.</p>
      <p>Множитель растёт, когда ты добавляешь еду в разные дни. Несколько записей за день дают монеты, а множитель растёт один раз.</p>
      <p>После долгого перерыва он постепенно снижается. Монеты, вещи и пройденный путь остаются с тобой. Состав еды не меняет награду.</p>
      <button type="button" onClick={close}>Понятно</button>
    </dialog>
  </div>;
}

export function RewardReceipt({ event }) {
  if (!event) return null;
  return <div className="reward-receipt" role="status">
    <strong>+{format(event.coins)} монет</strong>
    <span>{event.grew ? `×${format(event.multiplierBefore)} → ×${format(event.multiplier)} · за регулярность` : `×${format(event.multiplier)} за регулярность`}</span>
  </div>;
}
