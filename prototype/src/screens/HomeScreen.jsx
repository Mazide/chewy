import { PhoneFrame } from '../components/PhoneFrame.jsx';
import { Hero } from '../components/Hero.jsx';
import { AddFoodButton } from '../components/AddFoodButton.jsx';
import { MealLogRow } from '../components/MealLogRow.jsx';

/**
 * HomeScreen — mirrors HomeView.swift.
 * Hero centered, meal log at the bottom, FAB floating above.
 */
export function HomeScreen({ status = 'idle', meals = [], onAddFood }) {
  return (
    <PhoneFrame background="linear-gradient(180deg, #35b15a, #218a44)">
      <div
        style={{
          position: 'relative',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Hero zone */}
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', paddingTop: 30 }}>
          <Hero status={status} />
        </div>

        {/* Meal log */}
        <div style={{ padding: '0 16px 116px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {meals.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                color: 'rgba(255,255,255,.7)',
                font: '600 14px var(--font-round)',
                padding: '10px 0',
              }}
            >
              No meals yet — feed your hero!
            </div>
          ) : (
            meals.map((m, i) => <MealLogRow key={i} {...m} />)
          )}
        </div>

        {/* FAB */}
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          <AddFoodButton onClick={onAddFood} />
        </div>
      </div>
    </PhoneFrame>
  );
}
