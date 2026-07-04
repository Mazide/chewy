/**
 * Wireframes — asset-free skeletons of every Build-1 screen.
 * Dashed orange zones = art assets (numbered, legend on the right),
 * solid gray zones = code-drawn UI, purple = FX/animation, dotted = prototype-only.
 * Purpose: freeze composition first, then generate assets zone by zone.
 */

const KIND_STYLE = {
  asset: { border: '2px dashed #c77b2f', bg: 'rgba(199,123,47,.07)', tag: '#c77b2f' },
  fx: { border: '2px dashed #8a5fbf', bg: 'rgba(138,95,191,.07)', tag: '#8a5fbf' },
  ui: { border: '2px solid #7b8794', bg: 'rgba(123,135,148,.08)', tag: '#556' },
  proto: { border: '2px dotted #aaa', bg: 'rgba(170,170,170,.06)', tag: '#999' },
};

const KIND_LABEL = { asset: 'ассет (gen)', fx: 'FX/анимация', ui: 'код', proto: 'только прототип' };

function Z({ x, y, w, h, n, label, kind = 'asset', round }) {
  const s = KIND_STYLE[kind];
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        border: s.border,
        background: s.bg,
        borderRadius: round ? '50%' : 10,
        display: 'grid',
        placeItems: 'center',
        boxSizing: 'border-box',
      }}
    >
      <span style={{ fontSize: 10.5, fontWeight: 700, color: '#444', textAlign: 'center', padding: 2, lineHeight: 1.25 }}>
        {label}
      </span>
      {n != null && (
        <span
          style={{
            position: 'absolute',
            top: -9,
            left: -9,
            width: 18,
            height: 18,
            borderRadius: 9,
            background: s.tag,
            color: '#fff',
            font: '800 11px system-ui',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          {n}
        </span>
      )}
    </div>
  );
}

function Wire({ title, legend, children }) {
  return (
    <div style={{ display: 'flex', gap: 22, alignItems: 'flex-start', padding: 20, fontFamily: 'system-ui', background: '#fff', minHeight: '100vh', boxSizing: 'border-box' }}>
      <div>
        <div style={{ font: '800 14px system-ui', marginBottom: 8 }}>{title}</div>
        <div
          style={{
            position: 'relative',
            width: 390,
            height: 780,
            border: '3px solid #222',
            borderRadius: 28,
            background: '#fff',
            overflow: 'hidden',
          }}
        >
          {children}
        </div>
      </div>
      <div style={{ maxWidth: 380, fontSize: 12.5, lineHeight: 1.5, paddingTop: 26 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Ассеты / слои</div>
        <table style={{ borderCollapse: 'collapse' }}>
          <tbody>
            {legend.map((it) => (
              <tr key={it.n} style={{ verticalAlign: 'top' }}>
                <td style={{ padding: '2px 8px 2px 0', fontWeight: 800, color: KIND_STYLE[it.kind ?? 'asset'].tag }}>{it.n}</td>
                <td style={{ padding: '2px 8px 2px 0', fontWeight: 700 }}>{it.name}</td>
                <td style={{ padding: '2px 8px 2px 0', whiteSpace: 'nowrap', color: '#777' }}>{KIND_LABEL[it.kind ?? 'asset']}</td>
                <td style={{ padding: '2px 0', color: '#555' }}>{it.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 10, color: '#888', fontSize: 11.5 }}>
          Оранжевый пунктир — арт-ассет · фиолетовый — анимация/FX · серый — рисует код · точечный — только для прототипа
        </div>
      </div>
    </div>
  );
}

export default {
  title: 'Wireframes',
  parameters: { layout: 'fullscreen' },
};

// ---------------------------------------------------------------- CAMP (hub)

export const Camp = {
  render: () => (
    <Wire
      title="CAMP — хаб"
      legend={[
        { n: 1, name: 'Фон кемпа', kind: 'asset', note: 'полноэкранный, зона неба сверху; есть (Kling), нужен вариант «ночь» затемнением' },
        { n: 2, name: 'Герой', kind: 'fx', note: 'спрайтшит idle/eating/happy + hungry/sluggish (Kling)' },
        { n: 3, name: 'Костёр', kind: 'fx', note: '3 состояния: горит / тлеет / потух (луп)' },
        { n: 4, name: 'Слот питомца', kind: 'asset', note: 'сова, белка — статичный PNG + лёгкий bob-код' },
        { n: 5, name: 'Слоты декора', kind: 'asset', note: 'фонарь, флаг, палатка… PNG по позициям сцены' },
        { n: 6, name: 'Иконки-предметы', kind: 'asset', note: 'карта / компас / рюкзак — предметы мира, не системные орбы' },
        { n: 7, name: 'Монета', kind: 'asset', note: 'иконка для бейджа' },
        { n: 8, name: 'FAB Add Food', kind: 'asset', note: 'деревянная тарелка/руна — есть (Kling), оставить' },
        { n: 9, name: 'Чип костра-дня', kind: 'ui', note: 'код: пилюля + мини-иконка пламени из №3' },
        { n: 10, name: 'Мини-тарелка дня', kind: 'ui', note: 'код: conic-gradient кольцо' },
        { n: 11, name: 'Лог приёмов', kind: 'ui', note: 'код: строки поверх сцены' },
        { n: 12, name: 'Speech bubble', kind: 'ui', note: 'код: пузырь с хвостиком' },
      ]}
    >
      <Z x={0} y={0} w={390} h={780} n={1} label="ФОН КЕМПА (full-bleed)" kind="asset" />
      <Z x={14} y={44} w={86} h={34} n={7} label="🪙 бейдж" kind="ui" />
      <Z x={140} y={44} w={110} h={26} n={9} label="чип костра" kind="ui" />
      <Z x={330} y={44} w={46} h={150} n={6} label="орбы ×3" kind="asset" />
      <Z x={104} y={150} w={182} h={330} n={2} label="ГЕРОЙ 182×380" kind="fx" />
      <Z x={160} y={430} w={70} h={56} n={3} label="костёр" kind="fx" />
      <Z x={30} y={420} w={64} h={64} n={4} label="питомец" kind="asset" />
      <Z x={20} y={120} w={54} h={54} n={5} label="декор A" kind="asset" />
      <Z x={310} y={330} w={54} h={54} n={5} label="декор B" kind="asset" />
      <Z x={130} y={500} w={130} h={34} n={12} label="bubble" kind="ui" />
      <Z x={168} y={545} w={54} h={54} n={10} label="тарелка" kind="ui" round />
      <Z x={24} y={610} w={342} h={64} n={11} label="лог приёмов (строки)" kind="ui" />
      <Z x={155} y={690} w={80} h={80} n={8} label="FAB" kind="asset" round />
    </Wire>
  ),
};

// ---------------------------------------------------------------- ANALYZE

export const Analyze = {
  render: () => (
    <Wire
      title="ANALYZE — камера + порция (скины: таверна/лаборатория/магия)"
      legend={[
        { n: 1, name: 'Фон темы', kind: 'asset', note: '×3 темы: дерево таверны / металл лаборатории / ночная магия' },
        { n: 2, name: 'Вывеска-баннер', kind: 'asset', note: '9-slice планка ×3 темы, текст кодом' },
        { n: 3, name: 'Рамка фото-окна', kind: 'asset', note: 'кольцо-оправа ×3 темы (котёл / линза / хрустальный шар)' },
        { n: 4, name: 'Герой-подглядыватель', kind: 'asset', note: 'малый спрайт сбоку окна, статичный кадр' },
        { n: 5, name: 'Проп темы', kind: 'asset', note: 'вилка / колба / гримуар' },
        { n: 6, name: 'Иконки стопов порции', kind: 'asset', note: '×3 темы (кость-курица / шестерня / зелье)' },
        { n: 7, name: 'Кнопка FEED', kind: 'ui', note: 'код: chunky-кнопка, цвет из темы' },
        { n: 8, name: '«Назад» — предмет мира', kind: 'asset', note: '↻ / ⚙ / 📖 малая иконка' },
        { n: 9, name: 'Чипсы пресетов', kind: 'proto', note: 'в iOS не существует — там живая камера' },
        { n: 10, name: 'Live camera', kind: 'ui', note: 'AVFoundation, круглая маска' },
      ]}
    >
      <Z x={0} y={0} w={390} h={780} n={1} label="ФОН ТЕМЫ" kind="asset" />
      <Z x={60} y={48} w={270} h={52} n={2} label="ВЫВЕСКА" kind="asset" />
      <Z x={85} y={150} w={220} h={220} n={10} label="LIVE CAMERA (круг)" kind="ui" round />
      <Z x={70} y={135} w={250} h={250} n={3} label="" kind="asset" round />
      <Z x={40} y={330} w={64} h={80} n={4} label="герой" kind="asset" />
      <Z x={310} y={130} w={50} h={50} n={5} label="проп" kind="asset" />
      <Z x={40} y={420} w={310} h={44} n={9} label="чипсы пресетов (proto-only)" kind="proto" />
      <Z x={24} y={520} w={342} h={120} n={6} label="ПОРЦИЯ: слайдер 3 стопа + иконки" kind="ui" />
      <Z x={24} y={660} w={70} h={56} n={8} label="назад" kind="asset" />
      <Z x={110} y={660} w={256} h={56} n={7} label="FEED!" kind="ui" />
    </Wire>
  ),
};

// ---------------------------------------------------------------- RESULT

export const Result = {
  render: () => (
    <Wire
      title="RESULT — реакция + дельта тарелки дня"
      legend={[
        { n: 1, name: 'Фон = кемп с блюром', kind: 'ui', note: 'тот же ассет фона, blur+dim кодом' },
        { n: 2, name: 'Вывеска-вердикт', kind: 'asset', note: 'та же планка, текст-фраза кодом' },
        { n: 3, name: 'Герой-реакция', kind: 'fx', note: 'happy / sluggish(💤) / unsure(❓) — спрайт + эмодзи-оверлей кодом' },
        { n: 4, name: 'Speech bubble', kind: 'ui', note: 'код' },
        { n: 5, name: 'Тарелка дня + дельта', kind: 'ui', note: 'код: кольцо, анимация заполнения 350мс+900мс' },
        { n: 6, name: 'Бейдж +монеты', kind: 'ui', note: 'код + иконка монеты (см. Camp №7)' },
        { n: 7, name: 'Кнопка Back to camp', kind: 'ui', note: 'код' },
      ]}
    >
      <Z x={0} y={0} w={390} h={780} n={1} label="КЕМП-ФОН (blur 3, dim .25)" kind="ui" />
      <Z x={60} y={48} w={270} h={52} n={2} label="ВЫВЕСКА-ВЕРДИКТ" kind="asset" />
      <Z x={118} y={140} w={154} h={290} n={3} label="ГЕРОЙ (scale .72)" kind="fx" />
      <Z x={110} y={450} w={170} h={36} n={4} label="bubble-фраза" kind="ui" />
      <Z x={70} y={530} w={100} h={100} n={5} label="тарелка дня Δ" kind="ui" round />
      <Z x={210} y={545} w={120} h={70} n={6} label="блюдо + 🪙+N" kind="ui" />
      <Z x={95} y={680} w={200} h={54} n={7} label="Back to camp" kind="ui" />
    </Wire>
  ),
};

// ---------------------------------------------------------------- JOURNAL

export const Journal = {
  render: () => (
    <Wire
      title="JOURNAL — свиток дня"
      legend={[
        { n: 1, name: 'Фон = кемп с блюром', kind: 'ui', note: 'blur 4, dim .3' },
        { n: 2, name: 'Вывеска', kind: 'asset', note: 'общая планка' },
        { n: 3, name: 'Свиток-пергамент', kind: 'asset', note: '9-slice: закрученные края сверху/снизу' },
        { n: 4, name: 'Иконки настроений', kind: 'asset', note: '6 лиц героя (happy/content/full/sluggish/unsure/idle) — можно кропом из спрайтов' },
        { n: 5, name: 'Тарелка дня', kind: 'ui', note: 'код' },
        { n: 6, name: 'Строки лога + ✕', kind: 'ui', note: 'код, sepia; удаление не откатывает день' },
        { n: 7, name: 'Компас → Путь', kind: 'asset', note: 'та же иконка, что орб хаба' },
        { n: 8, name: 'Кнопка', kind: 'ui', note: 'код' },
      ]}
    >
      <Z x={0} y={0} w={390} h={780} n={1} label="КЕМП-ФОН (blur)" kind="ui" />
      <Z x={60} y={48} w={270} h={52} n={2} label="ВЫВЕСКА" kind="asset" />
      <Z x={24} y={130} w={342} h={470} n={3} label="СВИТОК (9-slice)" kind="asset" />
      <Z x={45} y={165} w={56} h={56} n={4} label="лицо" kind="asset" round />
      <Z x={270} y={160} w={72} h={72} n={5} label="тарелка" kind="ui" round />
      <Z x={45} y={260} w={300} h={300} n={6} label="строки лога (✕ справа)" kind="ui" />
      <Z x={95} y={690} w={54} h={54} n={7} label="🧭" kind="asset" round />
      <Z x={165} y={690} w={170} h={54} n={8} label="Back to camp" kind="ui" />
    </Wire>
  ),
};

// ---------------------------------------------------------------- PATH

export const Path = {
  render: () => (
    <Wire
      title="PATH — тропа по биомам"
      legend={[
        { n: 1, name: 'Фон = кемп с блюром', kind: 'ui', note: 'blur 4, dim .3' },
        { n: 2, name: 'Вывеска', kind: 'asset', note: 'общая планка' },
        { n: 3, name: 'Пергамент-карта', kind: 'asset', note: '9-slice, длинный скролл' },
        { n: 4, name: 'Фоны биомов', kind: 'asset', note: '4 плашки-ландшафта: лес / холмы / пики / озеро (после сигнала; в Сборке 1 — тинты)' },
        { n: 5, name: 'Костры дней', kind: 'asset', note: '🔥/🟠/⚫ малые иконки — из №3 кемпа' },
        { n: 6, name: 'Маркер героя', kind: 'asset', note: 'мини-герой «hero is here»' },
        { n: 7, name: 'Тизер-силуэт биома', kind: 'asset', note: 'размытый силуэт следующего ландшафта' },
        { n: 8, name: 'Стрик/рекорд/легенда', kind: 'ui', note: 'код: 🔥 N + 🏅 + строка уголька' },
        { n: 9, name: 'Кнопка', kind: 'ui', note: 'код' },
      ]}
    >
      <Z x={0} y={0} w={390} h={780} n={1} label="КЕМП-ФОН (blur)" kind="ui" />
      <Z x={60} y={48} w={270} h={52} n={2} label="ВЫВЕСКА" kind="asset" />
      <Z x={24} y={130} w={342} h={540} n={3} label="ПЕРГАМЕНТ (скролл)" kind="asset" />
      <Z x={45} y={160} w={300} h={64} n={8} label="🔥 N days · 🏅 record · легенда" kind="ui" />
      <Z x={45} y={240} w={300} h={150} n={4} label="БИОМ A (плашка) + костры дней" kind="asset" />
      <Z x={45} y={400} w={300} h={150} n={4} label="БИОМ B + маркер героя (№6)" kind="asset" />
      <Z x={140} y={565} w={110} h={80} n={7} label="силуэт за поворотом" kind="asset" />
      <Z x={95} y={690} w={200} h={54} n={9} label="Back to camp" kind="ui" />
    </Wire>
  ),
};

// ---------------------------------------------------------------- BACKPACK

export const Backpack = {
  render: () => (
    <Wire
      title="BACKPACK — магазин: декор / питомцы / темы"
      legend={[
        { n: 1, name: 'Фон = кемп с блюром', kind: 'ui', note: 'blur 4, dim .3' },
        { n: 2, name: 'Вывеска + бейдж монет', kind: 'asset', note: 'планка; монета из общего сета' },
        { n: 3, name: 'Герой-витрина', kind: 'fx', note: 'idle-спрайт малым, рядом — купленный питомец' },
        { n: 4, name: 'Кожаная панель-сетка', kind: 'asset', note: '9-slice кожа + карманы-ячейки' },
        { n: 5, name: 'Иконки товаров', kind: 'asset', note: '~18–20 шт: декор/питомцы/темы — главный пак генерации' },
        { n: 6, name: 'Ячейка товара', kind: 'ui', note: 'код: цена/Equip, рамка-подсветка надетого' },
        { n: 7, name: 'Кнопка', kind: 'ui', note: 'код' },
      ]}
    >
      <Z x={0} y={0} w={390} h={780} n={1} label="КЕМП-ФОН (blur)" kind="ui" />
      <Z x={60} y={44} w={270} h={78} n={2} label="ВЫВЕСКА + 🪙" kind="asset" />
      <Z x={125} y={135} w={140} h={130} n={3} label="герой-витрина" kind="fx" />
      <Z x={24} y={280} w={342} h={380} n={4} label="КОЖАНАЯ СЕТКА 2×N (скролл)" kind="asset" />
      <Z x={45} y={300} w={150} h={110} n={5} label="иконка товара" kind="asset" />
      <Z x={210} y={300} w={150} h={110} n={6} label="ячейка: цена/Equip" kind="ui" />
      <Z x={95} y={690} w={200} h={54} n={7} label="Back to camp" kind="ui" />
    </Wire>
  ),
};

// ---------------------------------------------------------------- ONBOARDING

export const Onboarding = {
  render: () => (
    <Wire
      title="ONBOARDING — имя + карточки + пуш-вопрос"
      legend={[
        { n: 1, name: 'Фон кемпа', kind: 'asset', note: 'общий, лёгкий blur на карточках' },
        { n: 2, name: 'Вывеска-заголовок', kind: 'asset', note: 'общая планка' },
        { n: 3, name: 'Герой', kind: 'fx', note: 'idle-спрайт' },
        { n: 4, name: 'Арт карточек', kind: 'asset', note: '3 мини-виньетки: 📷→😊→🪙 луп · «no judging» · пуш-сцена (можно собрать из готовых ассетов)' },
        { n: 5, name: 'Поле имени', kind: 'ui', note: 'код: пергамент-инпут, плейсхолдер = дефолт-имя' },
        { n: 6, name: 'CTA + точки шагов', kind: 'ui', note: 'код' },
        { n: 7, name: 'Пуш-вопрос', kind: 'ui', note: 'bubble от героя + «Sure» / «maybe later»; системный алерт iOS — после «Sure»' },
      ]}
    >
      <Z x={0} y={0} w={390} h={780} n={1} label="ФОН КЕМПА" kind="asset" />
      <Z x={60} y={48} w={270} h={52} n={2} label="ВЫВЕСКА ШАГА" kind="asset" />
      <Z x={118} y={140} w={154} h={290} n={3} label="ГЕРОЙ" kind="fx" />
      <Z x={130} y={450} w={130} h={60} n={4} label="виньетка шага" kind="asset" />
      <Z x={70} y={530} w={250} h={40} n={7} label="текст шага / пуш-вопрос" kind="ui" />
      <Z x={45} y={600} w={300} h={48} n={5} label="ИМЯ (шаг 1)" kind="ui" />
      <Z x={95} y={664} w={200} h={50} n={6} label="CTA" kind="ui" />
      <Z x={165} y={726} w={60} h={14} n={6} label="• • •" kind="ui" />
    </Wire>
  ),
};
