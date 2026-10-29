import { CampSandbox } from '../../src/core/CampSandbox.jsx';
import { ScreenStudy } from '../../src/core/ScreenStudy.jsx';

export default {
  title: 'Core/Sandbox',
  component: CampSandbox,
  render: (args) => <CampSandbox key={`${args.initialPreset ?? 'default'}-${args.initialDevice ?? 'standard'}`} {...args} />,
  parameters: { backgrounds: { default: 'light' }, controls: { disable: true }, layout: 'padded' },
};

export const CampCollage = { name: 'Песочница · лагерь слоями', args: { foodLayout: 'separate', foodPresentation: 'journal' } };
export const OwnerComposition = { name: 'Композиция · по твоей раскладке', args: { initialPreset: 'owner' } };

const sample = (initialScreen, extra = {}) => () => <ScreenStudy presentation="content" initialScreen={initialScreen} {...extra} />;
export const AllScreens = { name:'Все экраны · с контентом', render:sample('camp') };
export const Camp = { name:'Лагерь · день с едой', render:sample('camp') };
export const Journal = { name:'Сегодня · дневник с фото', render:sample('journal') };
export const EmptyCamp = { name:'Лагерь · первый день', render:sample('camp',{ initialEmpty:true,initialCoins:0 }) };
export const Camera = { name:'Еда · камера', render:sample('camera') };
export const CameraAlchemy = { name:'Камера · алхимия', render:sample('camera',{ initialTheme:'alchemy' }) };
export const CameraComputer = { name:'Камера · компьютер', render:sample('camera',{ initialTheme:'computer' }) };
export const Waiting = { name:'Анализ · лаборатория', render:sample('waiting') };
export const Alchemy = { name:'Анализ · алхимия', render:sample('waiting',{ initialTheme:'alchemy' }) };
export const Computer = { name:'Анализ · компьютер', render:sample('waiting',{ initialTheme:'computer' }) };
export const Result = { name:'Результат · уточнение', render:sample('result') };
export const Backpack = { name:'Рюкзак · примерка', render:sample('backpack') };
export const Path = { name:'Путь · встречи', render:sample('path') };
export const Welcome = { name:'Знакомство · начало', render:sample('welcome') };
export const Name = { name:'Знакомство · имя', render:sample('name') };
export const Reminders = { name:'Знакомство · напоминания', render:sample('reminders') };
export const CameraDenied = { name:'Состояния · камера недоступна', render:sample('cameraDenied') };
export const Offline = { name:'Состояния · нет сети', render:sample('offline') };
export const NotFood = { name:'Состояния · не-еда', render:sample('notFood') };
export const Uncertain = { name:'Состояния · неуверенный анализ', render:sample('uncertain') };
