import { ScreenStudy } from './ScreenStudy.jsx';

export default {
  title: 'Состояния',
  id: 'states',
  component: ScreenStudy,
  parameters: { layout: 'padded', controls: { disable: true } },
  render: args => <ScreenStudy key={JSON.stringify(args)} presentation="content" {...args} />,
};

// Retained scenes keep their URLs; variants already available in the inspector
// do not need duplicate stories.
export const EmptyCamp = { name: 'Лагерь · пустой день', args: { initialScreen: 'camp', initialEmpty: true, initialCoins: 0, initialPath: 'first' }, parameters: { __id: 'core-sandbox--empty-camp' } };
export const Journal = { name: 'Сегодня · записи', args: { initialScreen: 'journal' }, parameters: { __id: 'core-sandbox--journal' } };
export const Camera = { name: 'Камера · набор снимков', args: { initialScreen: 'camera' }, parameters: { __id: 'core-sandbox--camera' } };
export const Gallery = { name: 'Галерея · выбор фото', args: { initialScreen: 'gallery' }, parameters: { __id: 'core-canvas--gallery' } };
export const Processing = { name: 'Обработка · ожидание', args: { initialScreen: 'waiting' }, parameters: { __id: 'core-sandbox--waiting' } };
export const Result = { name: 'Результат · уточнение', args: { initialScreen: 'result' }, parameters: { __id: 'core-sandbox--result' } };
export const Backpack = { name: 'Рюкзак · примерка', args: { initialScreen: 'backpack', initialInventory: { coins: 12, owned: ['flowers'], applied: { garden: 'flowers' } } }, parameters: { __id: 'core-sandbox--backpack' } };
export const Path = { name: 'Путь · встречи', args: { initialScreen: 'path' }, parameters: { __id: 'core-sandbox--path' } };
export const ReturnPath = { name: 'Путь · возвращение', args: { initialScreen: 'path', initialPath: 'return' } };
export const CameraDenied = { name: 'Камера недоступна', args: { initialScreen: 'cameraDenied' }, parameters: { __id: 'core-sandbox--camera-denied' } };
export const Offline = { name: 'Нет сети', args: { initialScreen: 'offline' }, parameters: { __id: 'core-sandbox--offline' } };
export const NotFood = { name: 'Не удалось узнать еду', args: { initialScreen: 'notFood' }, parameters: { __id: 'core-sandbox--not-food' } };
export const Uncertain = { name: 'Неуверенный анализ', args: { initialScreen: 'uncertain' }, parameters: { __id: 'core-sandbox--uncertain' } };
