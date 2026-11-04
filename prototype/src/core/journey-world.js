export const JOURNEY_BIOMES = {
  forest:{ name:'Хвойный лес', background:'/assets/sandbox/camp-v3-flat/background.png' },
  lake:{ name:'Тихое озеро', background:'/assets/screen-studies/camp-lake-v1.png' },
  grove:{ name:'Золотая роща', background:'/assets/screen-studies/camp-grove-v1.png' },
  meadow:{ name:'Цветущий луг', background:'/assets/screen-studies/camp-meadow-v1.png' },
  mushroom:{ name:'Грибной лес', background:'/assets/screen-studies/camp-mushroom-v1.png' },
  coast:{ name:'Морское побережье', background:'/assets/screen-studies/camp-coast-v1.png' },
  canyon:{ name:'Красный каньон', background:'/assets/screen-studies/camp-canyon-v1.png' },
  alpine:{ name:'Горная долина', background:'/assets/screen-studies/camp-alpine-v1.png' },
  snow:{ name:'Снежный перевал', background:'/assets/screen-studies/camp-snow-v1.png' },
};
// Regions are ordered from the beginning of the journey (bottom) to its far end.
export const JOURNEY_REGIONS = [
  { id:'woodland', map:'/assets/screen-studies/journey-atlas-v1.png', stops:[
    ['forest','Начало тропинки'],['forest','Поляна под соснами'],['forest','Лесной ручей'],
    ['lake','Тихий берег'],['lake','Камышовая бухта'],['lake','Озёрная стоянка'],
    ['grove','Берёзовая опушка'],['grove','Золотая поляна'],['grove','Тёплые холмы'],
  ] },
  { id:'lowlands', map:'/assets/screen-studies/journey-lowlands-v1.png', stops:[
    ['meadow','Цветущая поляна'],['meadow','Клеверный склон'],['meadow','Луговая стоянка'],
    ['mushroom','Мшистая опушка'],['mushroom','Грибная полянка'],['mushroom','Тихая чаща'],
    ['coast','Морские дюны'],['coast','Ракушечный берег'],['coast','Тихая бухта'],
  ] },
  { id:'highlands', map:'/assets/screen-studies/journey-highlands-v1.png', stops:[
    ['canyon','Песчаный вход'],['canyon','Красные скалы'],['canyon','Тёплое плато'],
    ['alpine','Горные луга'],['alpine','Сосновый склон'],['alpine','Высокая долина'],
    ['snow','Снежная опушка'],['snow','Белая стоянка'],['snow','Тихий перевал'],
  ] },
];
const stopX = [46,59,40,60,42,61,40,58,48];
export const JOURNEY_WORLD_HEIGHT = 3000 * JOURNEY_REGIONS.length;
export const JOURNEY_STOPS = JOURNEY_REGIONS.flatMap((region, regionIndex) =>
  region.stops.map(([biome,name], index) => ({
    name, biome, x:stopX[index],
    y:((JOURNEY_REGIONS.length-1-regionIndex)*100 + 80-index*7.5) / JOURNEY_REGIONS.length,
  }))
);
export const DAY_PHASES = { morning:'Утро', day:'День', evening:'Вечер', night:'Ночь' };
export function resolveDayPhase(mode, date = new Date()) {
  if (mode !== 'auto') return DAY_PHASES[mode] ? mode : 'day';
  const hour = Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',hourCycle:'h23'}).format(date));
  return hour < 6 || hour >= 21 ? 'night' : hour < 10 ? 'morning' : hour < 17 ? 'day' : 'evening';
}
export function journeyBiome(step) {
  return JOURNEY_BIOMES[JOURNEY_STOPS[Math.max(0,Math.min(JOURNEY_STOPS.length-1,step))].biome];
}
