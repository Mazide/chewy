import { ChewyApp } from './ChewyApp.jsx';

export default {
  title: 'Flow/ChewyApp',
  component: ChewyApp,
  argTypes: {
    theme: {
      control: 'select',
      options: [undefined, 'tavern', 'lab', 'magic'],
      description: 'Force an analysis skin (otherwise driven by equipped theme)',
    },
  },
};

/** Full loop: camp → pick food + portion → FEED → day plate delta → coins → backpack. */
export const FullFlow = { args: { initialCoins: 24, initialStreak: 6, streakRecord: 9 } };

/** First launch: name him → loop card → honesty card → he asks about pushes. */
export const FreshInstall = { args: { startAtOnboarding: true, initialCoins: 0, initialStreak: 0, streakRecord: 0 } };

/** Enough coins to try the big-ticket items (pets, themes). */
export const RichStart = { args: { initialCoins: 90, initialStreak: 12, streakRecord: 14 } };
