export const PHOTO_SAMPLES = [
  { key:'meal', name:'Овощи с гарниром', label:'Обед', src:'/assets/screen-studies/meal.png' },
  { key:'breakfast', name:'Овсянка с ягодами', label:'Завтрак', src:'/assets/screen-studies/breakfast.png' },
  { key:'chicken', name:'Курица с картофелем', label:'Ужин', src:'/assets/screen-studies/chicken.jpg' },
];
export const samplePhoto = key => PHOTO_SAMPLES.find(sample => sample.key === key) ?? PHOTO_SAMPLES[0];
