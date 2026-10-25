/**
 * Flow/Map — the screen-transition graph of the Build-1 prototype.
 * Not a runnable screen: a reference diagram + text list of every edge,
 * so the flow can be checked at a glance against SPEC_v5 §11–12.
 */

const INK = '#2b2013';
const PARCHMENT = 'linear-gradient(180deg, #f6e7c6, #eed9ae)';

function Box({ x, y, w = 150, h = 54, title, sub, accent }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={14} fill={accent ? '#ff8a3d' : '#f6e7c6'} stroke={INK} strokeWidth={3} />
      <text x={x + w / 2} y={y + (sub ? 24 : 33)} textAnchor="middle" fontWeight="800" fontSize="15" fill={accent ? '#fff' : INK} fontFamily="var(--font-round)">
        {title}
      </text>
      {sub && (
        <text x={x + w / 2} y={y + 41} textAnchor="middle" fontSize="10" fill={accent ? 'rgba(255,255,255,.9)' : 'rgba(43,32,19,.7)'} fontFamily="var(--font-round)">
          {sub}
        </text>
      )}
    </g>
  );
}

function Edge({ d, label, lx, ly, dashed, both }) {
  return (
    <g>
      <path d={d} fill="none" stroke={INK} strokeWidth={2.5} strokeDasharray={dashed ? '6 5' : undefined} markerEnd="url(#arrow)" markerStart={both ? 'url(#arrowBack)' : undefined} />
      {label && (
        <text x={lx} y={ly} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="rgba(43,32,19,.85)" fontFamily="var(--font-round)" style={{ paintOrder: 'stroke', stroke: '#f3ecd9', strokeWidth: 4 }}>
          {label}
        </text>
      )}
    </g>
  );
}

function FlowMap() {
  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: 20, fontFamily: 'var(--font-round)', color: INK }}>
      <svg viewBox="0 0 760 470" style={{ width: '100%', background: '#f3ecd9', border: `3px solid ${INK}`, borderRadius: 18 }}>
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={INK} />
          </marker>
          <marker id="arrowBack" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 10 0 L 0 5 L 10 10 z" fill={INK} />
          </marker>
        </defs>

        {/* nodes */}
        <Box x={40} y={30} title="ONBOARDING" sub="name · 3 cards · push opt-in" />
        <Box x={305} y={195} w={160} h={64} title="CAMP" sub="hub: hero · fire · plate" accent />
        <Box x={40} y={195} title="ANALYZE" sub="camera · portion · themes" />
        <Box x={40} y={360} title="RESULT" sub="reaction · day plate Δ · +coins" />
        <Box x={575} y={80} title="JOURNAL" sub="scroll · delete (sticky day)" />
        <Box x={575} y={225} title="PATH" sub="biomes · fires · streak" />
        <Box x={575} y={370} title="BACKPACK" sub="decor · pets · themes" />

        {/* onboarding → camp (once) */}
        <Edge d="M 190 62 C 330 70, 380 120, 385 192" label="first launch only" lx={330} ly={92} dashed />

        {/* core loop */}
        <Edge d="M 305 232 L 193 226" label="FAB Add Food" lx={250} ly={215} />
        <Edge d="M 115 252 L 115 357" label="FEED → meal | not-food | unsure" lx={118} ly={310} />
        <Edge d="M 193 385 C 330 380, 380 300, 386 262" label="Back to camp (+🪙 if logged)" lx={330} ly={352} />
        <Edge d="M 150 195 C 190 140, 280 150, 330 192" label="↻ back (no log)" lx={248} ly={148} dashed />

        {/* side screens, both ways */}
        <Edge d="M 465 213 C 520 180, 540 150, 573 122" label="🗺️ ⇄ back" lx={520} ly={148} both />
        <Edge d="M 467 236 L 573 248" label="🧭 ⇄ back" lx={520} ly={230} both />
        <Edge d="M 462 250 C 520 290, 540 330, 573 380" label="🎒 ⇄ back" lx={508} ly={330} both />

        {/* journal → path */}
        <Edge d="M 650 136 L 650 222" label="🧭" lx={662} ly={182} />
      </svg>

      <div style={{ fontSize: 13, lineHeight: 1.55, marginTop: 14 }}>
        <b>Все переходы:</b>
        <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
          <li><b>Onboarding → Camp</b> — один раз: имя героя, 2 карточки, пуш-вопрос от героя (Sure / maybe later).</li>
          <li><b>Camp → Analyze</b> — FAB «Add Food». <b>Analyze → Camp</b> — «↻», без лога.</li>
          <li><b>Analyze → Result</b> — FEED. Три исхода: <i>meal</i> (лог + монеты + дельта тарелки дня), <i>not-food</i> (игровая реакция, без лога и монет), <i>unsure</i> (лог + минимум, «my best guess»).</li>
          <li><b>Result → Camp</b> — единственный выход; на 5-м+ приёме — кап-плашка, монеты = минимум.</li>
          <li><b>Camp ⇄ Journal / Path / Backpack</b> — предметы мира 🗺️ 🧭 🎒, назад — кнопка мира.</li>
          <li><b>Journal → Path</b> — компас со свитка.</li>
          <li>Journal: ✕ удаляет запись, но день липкий — тарелка/монеты/стрик/слоты не откатываются.</li>
          <li>Внутри Camp без перехода: hungry → покормлен (fire dozing → bright), эхо реакции героя.</li>
        </ul>
      </div>
    </div>
  );
}

export default {
  title: 'Flow/Map',
  parameters: { layout: 'fullscreen' },
};

export const TransitionGraph = { render: () => <FlowMap /> };
