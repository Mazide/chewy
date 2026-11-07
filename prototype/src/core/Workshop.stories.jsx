import { CampSprite } from './CampLife.jsx';
import { ScreenStudy } from './ScreenStudy.jsx';
import { CampCompositionCanvas } from './CampCompositionCanvas.jsx';
import { CampSandbox } from './CampSandbox.jsx';
import { AddFoodCanvas } from './AddFoodCanvas.jsx';
import { ExplorationStudy } from './ExplorationStudy.jsx';
import { CampMealDemo } from './CampMealDemo.jsx';

export default {
  title: 'Мастерская',
  id: 'workshop',
  parameters: { layout: 'padded', controls: { disable: true } },
};

export const Canvas = {
  name: 'Канвас · все экраны',
  parameters: { __id: 'core-canvas--all-screens' },
  render: () => <ScreenStudy initialScreen="camp" reviewMode="workshop" />,
};
export const Composition = {
  name: 'Лагерь · композиция блоками',
  parameters: { __id: 'core-canvas--camp-compositions' },
  render: () => <CampCompositionCanvas />,
};
export const Layers = {
  name: 'Лагерь · редактор слоёв',
  parameters: { __id: 'core-sandbox--camp-collage' },
  render: () => <CampSandbox foodLayout="separate" foodPresentation="journal" />,
};
export const OwnerComposition = {
  name: 'Лагерь · раскладка владельца',
  parameters: { __id: 'core-sandbox--owner-composition' },
  render: () => <CampSandbox initialPreset="owner" />,
};
export const CaptureSession = {
  name: 'Еда · очередь и таймер',
  parameters: { __id: 'core-canvas--add-food' },
  render: () => <AddFoodCanvas />,
};

export const Exploration = {
  name: 'Активность · окрестности',
  render: () => <ExplorationStudy />,
};

export const CampAnimations = {
  name: 'Лагерь · новые анимации',
  render: () => <div style={{ maxWidth: 780, color: '#343f30' }}>
    <h1>Жизнь лагеря</h1>
    <p>Проба сгенерированных движений. Стыки повторов и финальный арт ещё на ревью.</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20 }}>
      {Object.entries({ tent: 'Палатка', fire: 'Огонь', flowers: 'Цветы', lantern: 'Лампа', bird: 'Птица', butterfly: 'Бабочка', clouds: 'Облака' }).map(([kind, label]) => <figure key={kind} style={{ margin: 0 }}>
        <div style={{ height: 180, padding: 16, background: '#d5e6b5', borderRadius: 16 }}><CampSprite kind={kind} /></div>
        <figcaption>{label}</figcaption>
      </figure>)}
    </div>
  </div>,
};

export const HeroActions = {
  name: 'Чуви · управляемые движения',
  parameters: { layout: 'fullscreen' },
  render: () => <iframe title="Чуви: проба движения, одежды и реквизита" src="/hero-actions/index.html" style={{ display: 'block', width: '100%', height: '100vh', minHeight: 720, border: 0 }} />,
};

export const CampStates = {
  name: 'Лагерь · три состояния Rive',
  parameters: { layout: 'fullscreen' },
  render: () => <iframe title="Лагерь: три состояния предметов в Rive" src="/camp-states/states.html" style={{ display: 'block', width: '100%', height: '100vh', minHeight: 720, border: 0 }} />,
};

export const CampMeals = {
  name: 'Лагерь · день с едой',
  parameters: { layout: 'fullscreen' },
  render: () => <CampMealDemo />,
};

export const RiveMotionPilot = {
  name: 'Rive · до и после движения',
  parameters: { layout: 'fullscreen' },
  render: () => <iframe title="Rive: сравнение движения растений" src="/motion-pilot/preview/review.html" style={{ display: 'block', width: '100%', height: '100vh', minHeight: 720, border: 0 }} />,
};

export const HeroMotionPilot = {
  name: 'Чуви · приветствие Rive',
  parameters: { layout: 'fullscreen' },
  render: () => <iframe title="Чуви: приветствие рукой" src="/hero-motion-pilot/preview/review.html" style={{ display: 'block', width: '100%', height: '100vh', minHeight: 720, border: 0 }} />,
};

export const HeroVideoPilot = {
  name: 'Чуви · видео в Rive',
  parameters: { layout: 'fullscreen' },
  render: () => <iframe title="Чуви: исходные кадры и Rive" src="/hero-video-pilot/preview/review.html" style={{ display: 'block', width: '100%', height: '100vh', minHeight: 720, border: 0 }} />,
};

export const HeroVectorReference = {
  name: 'Чуви · вектор по видео',
  parameters: { layout: 'fullscreen' },
  render: () => <iframe title="Чуви: видео как опора для векторного рига" src="/hero-vector-reference/preview/review.html" style={{ display: 'block', width: '100%', height: '100vh', minHeight: 720, border: 0 }} />,
};
