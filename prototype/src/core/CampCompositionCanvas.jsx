import { useState } from 'react';
import { CampSandbox } from './CampSandbox.jsx';
import { CAMP_COMPOSITIONS } from './camp-composition-presets.js';

export function CampCompositionCanvas() {
  const [preset, setPreset] = useState('growth');
  const [device, setDevice] = useState('standard');
  const [foodLayout, setFoodLayout] = useState('separate');
  return <div className="camp-composition-canvas">
    <nav className="composition-choices" aria-label="Вариант композиции">
      {Object.entries(CAMP_COMPOSITIONS).map(([id, composition]) => <button key={id} aria-pressed={preset === id} onClick={() => setPreset(id)}>{composition.label}</button>)}
    </nav>
    <label className="composition-food-layout">Еда и добавление<select value={foodLayout} onChange={(event) => setFoodLayout(event.target.value)}><option value="separate">Отдельно друг от друга</option><option value="inline">В одну строку</option><option value="stacked">Две панели · прежний вариант</option></select></label>
    <CampSandbox key={`${preset}-${foodLayout}`} initialPreset={preset} initialDevice={device} onDeviceChange={setDevice} presentation="blocks" foodLayout={foodLayout} />
  </div>;
}
