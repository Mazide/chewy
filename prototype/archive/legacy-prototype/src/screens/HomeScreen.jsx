import { PhoneFrame } from '../components/PhoneFrame.jsx';
import { Hero } from '../components/Hero.jsx';
import { AddFoodButton } from '../components/AddFoodButton.jsx';
import { MealLogRow } from '../components/MealLogRow.jsx';
import { CoinBadge, IconOrb, CampBackdrop } from '../components/chrome.jsx';
import { PlateRing } from '../components/PlateRing.jsx';
import { ITEMS } from '../data/game.js';

/**
 * HomeScreen — the camp hub. Animated camp, hero, meal log, mini day plate,
 * add-food FAB, plus coins and world-object nav (journal / path / backpack).
 * Equipped cosmetics render inside the scene (decor + pet; outfits are
 * post-signal). The campfire chip reads the day: fed today or dozing.
 */
export function HomeScreen({ status = 'idle', meals = [], plate, coins, fedToday = false, equipped = {}, onAddFood, onJournal, onPath, onBackpack }) {
  const pet = ITEMS.find((it) => it.id === equipped.pet);
  const decor = ITEMS.find((it) => it.id === equipped.decor);

  return (
    <PhoneFrame background="#2e9e4f">
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CampBackdrop />

        {/* top chrome: coins + world-object nav */}
        {coins != null && (
          <div style={{ position: 'absolute', top: 44, left: 14, zIndex: 3 }}>
            <CoinBadge coins={coins} />
          </div>
        )}
        {onJournal && (
          <div style={{ position: 'absolute', top: 44, right: 12, zIndex: 3, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <IconOrb icon="/assets/gen/packA/orb_map.png" onClick={onJournal} />
            <IconOrb icon="/assets/gen/packA/orb_compass.png" onClick={onPath} />
            <IconOrb icon="/assets/gen/packA/orb_backpack.png" onClick={onBackpack} />
          </div>
        )}

        {/* campfire chip: the day's state at a glance, zero numbers */}
        <div
          style={{
            position: 'absolute',
            top: 44,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 3,
            padding: '4px 12px',
            borderRadius: 999,
            background: 'rgba(0,0,0,.35)',
            color: '#fff',
            font: '700 12px var(--font-round)',
            textShadow: '0 1px 2px rgba(0,0,0,.5)',
          }}
        >
          {fedToday ? '🔥 fire is bright' : '🟠 fire is dozing'}
        </div>

        {/* equipped cosmetics live in the scene */}
        {pet && (
          <img
            src={pet.img}
            alt=""
            style={{ position: 'absolute', bottom: 175, left: 20, zIndex: 2, width: 62, filter: 'drop-shadow(0 3px 3px rgba(0,0,0,.4))' }}
          />
        )}
        {decor && (
          <img
            src={decor.img}
            alt=""
            style={{ position: 'absolute', top: 108, left: 16, zIndex: 2, width: 60, filter: 'drop-shadow(0 3px 3px rgba(0,0,0,.35))' }}
          />
        )}

        {/* Hero */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            flex: 1,
            minHeight: 0,
            display: 'grid',
            placeItems: 'center',
            overflow: 'hidden',
          }}
        >
          <Hero status={status} />
        </div>

        {/* Meal log + mini day plate */}
        <div style={{ position: 'relative', zIndex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {plate && (
            <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 2 }}>
              <PlateRing plate={plate} size={54} />
            </div>
          )}
          {meals.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                color: 'rgba(255,255,255,.9)',
                textShadow: '0 1px 3px rgba(0,0,0,.45)',
                font: '600 14px var(--font-round)',
              }}
            >
              No meals yet — feed your hero!
            </div>
          ) : (
            meals.map((m, i) => <MealLogRow key={i} {...m} />)
          )}
        </div>

        {/* FAB */}
        <div style={{ position: 'relative', zIndex: 2, display: 'grid', placeItems: 'center', padding: '18px 0 30px' }}>
          <AddFoodButton onClick={onAddFood} />
        </div>
      </div>
    </PhoneFrame>
  );
}
