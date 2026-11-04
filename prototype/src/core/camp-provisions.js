// Draft visual states for owner review; these are not nutrition thresholds.
export const PROVISION_STAGES = {
  resting: {
    label: 'Рюкзак отдыхает',
    description: 'Мягкий закрытый рюкзак ждёт припасов.',
  },
  first: {
    label: 'Первый свёрток',
    description: 'Из рюкзака выглядывает небольшой свёрток.',
  },
  stocked: {
    label: 'Припасы внутри',
    description: 'В рюкзаке устроились несколько свёртков.',
  },
  full: {
    label: 'Рюкзак собран',
    description: 'Рюкзак стал объёмнее, сверху видны припасы.',
  },
  extra: {
    label: 'Припасы с запасом',
    description: 'Ещё несколько свёртков удобно уложены сверху.',
  },
};
