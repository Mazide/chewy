import { useId, useLayoutEffect, useRef } from 'react';
import './capture-lifecycle.css';

export function CaptureConfirmation({ title, children, action, cancelLabel = 'Оставить запись', error, onConfirm, onClose }) {
  const dialog = useRef(null);
  const safeAction = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  useLayoutEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement;
    const phone = element.closest('.capture-phone');
    phone.scrollIntoView({ block:'center', inline:'nearest', behavior:'instant' });
    const position = () => {
      const rect = phone.getBoundingClientRect();
      const width = Math.min(350, rect.width - 32, window.innerWidth - 32);
      element.style.width = `${width}px`;
      element.style.maxHeight = `${Math.min(rect.height, window.innerHeight) - 32}px`;
      const height = element.getBoundingClientRect().height;
      element.style.left = `${Math.max(width / 2 + 16, Math.min(window.innerWidth - width / 2 - 16, rect.left + rect.width / 2))}px`;
      element.style.top = `${Math.max(height / 2 + 16, Math.min(window.innerHeight - height / 2 - 16, rect.top + rect.height / 2))}px`;
    };
    position();
    element.showModal();
    position();
    safeAction.current.focus();
    const observer = new ResizeObserver(position);
    observer.observe(phone);
    observer.observe(element);
    window.addEventListener('scroll', position, true);
    window.addEventListener('resize', position);
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', position, true);
      window.removeEventListener('resize', position);
      element.close();
      if (trigger?.isConnected) trigger.focus({ preventScroll:true });
      else if (phone.isConnected) phone.querySelector('.capture-top button')?.focus({ preventScroll:true });
    };
  }, []);
  return <dialog ref={dialog} className="capture-confirmation" aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const buttons = [...event.currentTarget.querySelectorAll('button:not(:disabled)')];
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}
    onClick={event => { if (event.target === event.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    } }}>
    <h2 id={titleId}>{title}</h2><p id={descriptionId}>{children}</p>
    {error && <p className="capture-confirmation-error" role="alert">{error}</p>}
    <div className="capture-confirmation-actions"><button ref={safeAction} type="button" className="capture-primary" onClick={onClose}>{cancelLabel}</button><button type="button" onClick={onConfirm}>{action}</button></div>
  </dialog>;
}
