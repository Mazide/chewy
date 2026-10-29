import { CoreOverview, CoreSkeleton } from '../../src/core/CoreSkeleton.jsx';
import * as skeleton from './CoreSkeleton.stories.jsx';
import { CampCompositionCanvas } from '../../src/core/CampCompositionCanvas.jsx';
import { CampSandbox } from '../../src/core/CampSandbox.jsx';
import { ScreenStudy } from '../../src/core/ScreenStudy.jsx';

export default {
  ...skeleton.default,
  title: 'Core/Canvas',
  render: (args) => <CoreSkeleton key={JSON.stringify(args)} {...args} presentation="canvas" />,
};

export const CampCompositions = { name: 'Лагерь · композиция блоками', render: () => <CampCompositionCanvas />, parameters: { layout: 'padded' } };
export const TodayJournal = { name: 'Сегодня · походный дневник', render: () => <CampSandbox presentation="blocks" initialPreset="growth" foodLayout="separate" foodPresentation="journal" initialEditing={false} />, parameters: { layout: 'padded' } };
export const Walkthrough = { name:'Пройти сценарий', render:() => <ScreenStudy initialScreen="camp" /> };
export const CampWithMeal = { name:'Лагерь · рабочая композиция', render:() => <ScreenStudy initialScreen="camp" /> };
export const CampFullDay = { name:'Сегодня · записи дня', render:() => <ScreenStudy initialScreen="journal" /> };
export const Overview = { name:'Обзор · выбрать экран', render:() => <ScreenStudy initialScreen="camp" /> };
export const AddFood = { ...skeleton.AddFood, name: 'Добавить еду · камера и анализ', parameters: { layout: 'padded' } };
export const Result = { name:'Результат · запись и правки', render:() => <ScreenStudy initialScreen="result" /> };
export const Path = { name:'Путь · карта встреч', render:() => <ScreenStudy initialScreen="path" /> };
export const Backpack = { name:'Рюкзак · примерка и вещи', render:() => <ScreenStudy initialScreen="backpack" /> };
export const AllScreens = { name:'Все экраны · связанная проба', render:() => <ScreenStudy initialScreen="camp" /> };
export const Gallery = { name:'Галерея · выбор снимка', render:() => <ScreenStudy initialScreen="gallery" /> };
export const Waiting = { name:'Обработка · можно уйти', render:() => <ScreenStudy initialScreen="waiting" /> };
export const EditableResult = { name:'Результат · уточнение', render:() => <ScreenStudy initialScreen="result" /> };
export const Welcome = { name:'Знакомство · первый запуск', render:() => <ScreenStudy initialScreen="welcome" /> };
export const Name = { name:'Знакомство · имя', render:() => <ScreenStudy initialScreen="name" /> };
export const Reminders = { name:'Знакомство · напоминания', render:() => <ScreenStudy initialScreen="reminders" /> };
export const CameraDenied = { name:'Состояния · камера недоступна', render:() => <ScreenStudy initialScreen="cameraDenied" /> };
export const Offline = { name:'Состояния · нет сети', render:() => <ScreenStudy initialScreen="offline" /> };
export const NotFood = { name:'Состояния · не-еда', render:() => <ScreenStudy initialScreen="notFood" /> };
export const Uncertain = { name:'Состояния · неуверенный анализ', render:() => <ScreenStudy initialScreen="uncertain" /> };
