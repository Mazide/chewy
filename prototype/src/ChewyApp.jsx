import { useState } from 'react';
import { OnboardingScreen } from './screens/OnboardingScreen.jsx';
import { HomeScreen } from './screens/HomeScreen.jsx';
import { AnalyzeScreen } from './screens/AnalyzeScreen.jsx';
import { ResultScreen } from './screens/ResultScreen.jsx';
import { JournalScreen } from './screens/JournalScreen.jsx';
import { PathScreen } from './screens/PathScreen.jsx';
import { BackpackScreen } from './screens/BackpackScreen.jsx';
import { MEAL_PRESETS, WEEK_LIVE, EMPTY_PLATE, scoreMeal, plateFractions } from './data/game.js';

/**
 * ChewyApp — the whole prototype flow in one state machine.
 * (onboarding →) camp → analyze (pick what the camera "sees" + portion) →
 * result → camp, plus journal / path / backpack side screens.
 * Scoring, anti-farm and the day plate run on the Build-1 rules (data/game.js).
 * Sticky day: hasLog, the day plate and meal slots never roll back — deleting
 * a journal entry keeps coins, plate and streak (invariant #6, no retro-punish).
 */
export function ChewyApp({ initialCoins = 24, initialStreak = 6, streakRecord = 9, totalDaysLogged = 16, startAtOnboarding = false, theme: themeOverride }) {
  const [screen, setScreen] = useState(startAtOnboarding ? 'onboarding' : 'camp');
  const [heroName, setHeroName] = useState('Chewy');
  const [coins, setCoins] = useState(initialCoins);
  const [meals, setMeals] = useState([]); // visible journal entries (deletable)
  const [slotsUsed, setSlotsUsed] = useState(0); // sticky meal counter of the day
  const [fedToday, setFedToday] = useState(false); // sticky hasLog
  const [plate, setPlate] = useState(EMPTY_PLATE); // day plate in units, sticky
  const [result, setResult] = useState(null); // last scoreMeal() output
  const [owned, setOwned] = useState([]);
  const [equipped, setEquipped] = useState({});

  const theme = themeOverride ?? equipped.theme ?? 'tavern';

  const feed = ({ presetId, portion }) => {
    const preset = MEAL_PRESETS.find((p) => p.id === presetId) ?? MEAL_PRESETS[0];
    const r = scoreMeal(plate, preset, portion, slotsUsed);
    setResult(r);
    if (r.kind === 'meal') {
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMeals((ms) => [...ms, { emoji: preset.emoji, title: preset.title, time }]);
      setSlotsUsed((n) => n + 1);
      setFedToday(true);
      setPlate(r.plateAfter);
      setCoins((c) => c + r.coins);
    }
    setScreen('result');
  };

  // delete is allowed, roll-back is not: plate, coins, slot and streak stay
  const deleteMeal = (idx) => setMeals((ms) => ms.filter((_, i) => i !== idx));

  const buy = (item) => {
    if (coins < item.cost) return;
    setCoins((c) => c - item.cost);
    setOwned((o) => [...o, item.id]);
  };

  const equip = (item) => {
    setEquipped((eq) => {
      const key = item.kind;
      const current = key === 'theme' ? eq.theme : eq[key];
      const next = { ...eq };
      if (key === 'theme') next.theme = current === item.theme ? undefined : item.theme;
      else next[key] = current === item.id ? undefined : item.id;
      return next;
    });
  };

  const toCamp = () => setScreen('camp');

  // hero on the hub: echo of the last reaction beats hunger beats idle
  const heroStatus = result?.reaction === 'happy' ? 'happy' : fedToday ? 'idle' : 'hungry';
  const mood = result?.kind === 'meal' ? result.reaction : 'idle';
  const streak = initialStreak + (fedToday ? 1 : 0);
  // full journey for the path: older days assumed lit, last week from the demo
  // mock, today's fire driven by whether the hero was fed
  const recent = WEEK_LIVE.map((d) => (d.today ? { ...d, fire: fedToday ? 'lit' : 'ember' } : d));
  const days = [
    ...Array.from({ length: Math.max(0, totalDaysLogged - recent.length) }, () => ({ fire: 'lit' })),
    ...recent,
  ];

  switch (screen) {
    case 'onboarding':
      return (
        <OnboardingScreen
          onDone={({ name }) => {
            setHeroName(name);
            toCamp();
          }}
        />
      );
    case 'analyze':
      return <AnalyzeScreen theme={theme} presets={MEAL_PRESETS} onFeed={feed} onBack={toCamp} />;
    case 'result':
      return <ResultScreen result={result} onCollect={toCamp} />;
    case 'journal':
      return (
        <JournalScreen
          heroName={heroName}
          meals={meals}
          plate={plateFractions(plate)}
          mood={mood}
          onDelete={deleteMeal}
          onClose={toCamp}
          onPath={() => setScreen('path')}
        />
      );
    case 'path':
      return <PathScreen streak={streak} record={Math.max(streakRecord, streak)} days={days} onClose={toCamp} />;
    case 'backpack':
      return (
        <BackpackScreen coins={coins} owned={owned} equipped={equipped} onBuy={buy} onEquip={equip} onClose={toCamp} />
      );
    default:
      return (
        <HomeScreen
          status={heroStatus}
          meals={meals}
          plate={plateFractions(plate)}
          coins={coins}
          fedToday={fedToday}
          equipped={equipped}
          onAddFood={() => setScreen('analyze')}
          onJournal={() => setScreen('journal')}
          onPath={() => setScreen('path')}
          onBackpack={() => setScreen('backpack')}
        />
      );
  }
}
