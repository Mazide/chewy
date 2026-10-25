import React, { useState } from 'react';
import './camp-canvas.css';

export function CampCanvas() {
  const [fed, setFed] = useState(true);
  const [guides, setGuides] = useState(true);

  return <section className="camp-board">
    <header className="camp-board-header">
      <p>ПРОБА КОМПОЗИЦИИ / ЛАГЕРЬ</p>
      <h1>Одна сцена, поверх — действия</h1>
      <p>Боксы обозначают место и размер. Оформление еды и расположение предметов — предложения для обсуждения.</p>
      <div className="camp-board-tools">
        <button aria-pressed={fed} onClick={() => setFed(!fed)}>{fed ? 'После еды' : 'До первой записи'}</button>
        <button aria-pressed={guides} onClick={() => setGuides(!guides)}>Подписи слоёв</button>
      </div>
    </header>
    <div className="camp-board-layout">
      <div className={`camp-canvas${guides ? ' camp-canvas-guides' : ''}`} aria-label="Композиция лагеря на канвасе">
        <div className="camp-canvas-background"><span>Фон лагеря</span></div>
        <header className="camp-canvas-top"><span>chewy</span><span className="camp-box camp-wallet-box">Монеты</span></header>
        <div className="camp-canvas-ground" />
        <div className="camp-box camp-decor-box">Декор<small>Вещь из рюкзака</small></div>
        <div className="camp-box camp-hero-box">Герой<small>{fed ? 'Реакция после еды' : 'Ждёт встречи'}</small></div>
        <div className="camp-box camp-fire-box">Костёр</div>
        {guides && <span className="camp-layer-label camp-scene-guide">Сцена · главный фокус</span>}
        <section className="camp-food-zone" aria-label="Сегодня">
          <div className="camp-food-title"><strong>Сегодня</strong><span>Еда перед героем · проба</span></div>
          <div className="camp-food-objects">
            <div className="camp-box camp-plate-box">Тарелка<small>{fed ? 'Сектора дня' : 'Пока пустая'}</small></div>
            <div className="camp-food-records">{fed ? <><div className="camp-box camp-record-box">Фото еды<small>Последняя запись</small></div><div className="camp-box camp-record-box camp-older-record">Ранее сегодня</div></> : <p>Здесь появится<br />сегодняшняя еда</p>}</div>
          </div>
        </section>
        <div className="camp-canvas-actions">
          {guides && <span className="camp-layer-label">Действия · поверх сцены</span>}
          <div className="camp-box camp-add-box">+ Добавить еду</div>
          <div className="camp-canvas-nav"><div className="camp-box">Путь</div><div className="camp-box">Рюкзак</div></div>
          <div className="camp-canvas-indicator" />
        </div>
      </div>
      <aside className="camp-board-notes">
        <section><h2>Дальний план</h2><p>Фон занимает весь экран. Верхняя строка лежит поверх него.</p></section>
        <section><h2>Середина — герой</h2><p>Самый крупный объект. Костёр и купленные вещи располагаются рядом, внутри лагеря.</p></section>
        <section><h2>Передний план — сегодня</h2><p>Пробуем тарелку и записи как объекты перед героем. Пока прямоугольники: способ оформления ещё выбираем.</p></section>
        <section><h2>Нижний слой интерфейса</h2><p>Добавление еды всегда на одном месте. Путь и рюкзак — под ним.</p></section>
        <p className="camp-board-footnote">Статичная схема для ревью композиции. Переходы проверяем отдельно в Storybook, «Начать с лагеря». Новых механик здесь нет; тексты служебные.</p>
      </aside>
    </div>
  </section>;
}
