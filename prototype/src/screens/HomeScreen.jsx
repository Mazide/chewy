import { PhoneFrame } from '../components/PhoneFrame.jsx';
import { Hero } from '../components/Hero.jsx';
import { AddFoodButton } from '../components/AddFoodButton.jsx';
import { MealLogRow } from '../components/MealLogRow.jsx';

/**
 * HomeScreen — mirrors HomeView.swift.
 * Animated atlas background, hero on top, meal log, then the add-food FAB.
 * Laid out as a flex column so nothing overlaps regardless of content.
 */
export function HomeScreen({ status = 'idle', meals = [], onAddFood }) {
  return (
    <PhoneFrame background="#2e9e4f">
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Animated background from the native atlas */}
        <video
          src="/assets/background.webm"
          autoPlay
          loop
          muted
          playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }}
        />

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

        {/* Meal log */}
        <div style={{ position: 'relative', zIndex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
