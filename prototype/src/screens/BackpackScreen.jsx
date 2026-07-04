import { PhoneFrame } from '../components/PhoneFrame.jsx';
import { Hero } from '../components/Hero.jsx';
import { WoodBanner, ChunkyButton, CampBackdrop, CoinBadge } from '../components/chrome.jsx';
import { ITEMS, KIND_BADGE } from '../data/game.js';

/**
 * BackpackScreen — cosmetics as an open backpack, hero as the mannequin.
 * Buy with coins, equip toggles; equipped items appear in the camp scene
 * and themes reskin the analysis screen.
 */
export function BackpackScreen({ coins = 0, owned = [], equipped = {}, onBuy, onEquip, onClose }) {
  return (
    <PhoneFrame>
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CampBackdrop blur={4} dim={0.3} />

        <div style={{ position: 'relative', zIndex: 1, paddingTop: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <WoodBanner>BACKPACK</WoodBanner>
          <CoinBadge coins={coins} />
        </div>

        {/* hero showcase — outfits come after the D7 signal, he just keeps you company */}
        <div style={{ position: 'relative', zIndex: 1, display: 'grid', placeItems: 'center', height: 190 }}>
          <div style={{ transform: 'scale(.45)', position: 'relative' }}>
            <Hero status="idle" showBubble={false} />
          </div>
          {equipped.pet && (
            <span style={{ position: 'absolute', bottom: 8, right: 60, fontSize: 34 }}>
              {ITEMS.find((it) => it.id === equipped.pet)?.emoji}
            </span>
          )}
          {equipped.decor && (
            <span style={{ position: 'absolute', bottom: 8, left: 60, fontSize: 30 }}>
              {ITEMS.find((it) => it.id === equipped.decor)?.emoji}
            </span>
          )}
        </div>

        {/* leather pockets grid */}
        <div style={{ position: 'relative', zIndex: 1, flex: 1, overflowY: 'auto', padding: '0 16px' }}>
          <div
            style={{
              background: 'linear-gradient(180deg, #6b4a2b, #4e351d)',
              border: '3px solid var(--chewy-ink)',
              borderRadius: 16,
              boxShadow: 'inset 0 4px 12px rgba(0,0,0,.4)',
              padding: 12,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
            }}
          >
            {[...ITEMS].sort((a, b) => a.cost - b.cost).map((item) => {
              const isOwned = owned.includes(item.id);
              const isEquipped = equipped[item.kind] === item.id || (item.kind === 'theme' && equipped.theme === item.theme);
              return (
                <div
                  key={item.id}
                  style={{
                    background: 'rgba(0,0,0,.25)',
                    border: `2px solid ${isEquipped ? 'var(--chewy-orange)' : 'rgba(255,255,255,.15)'}`,
                    borderRadius: 12,
                    padding: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    color: '#fff',
                    font: '600 12px var(--font-round)',
                  }}
                >
                  <span style={{ fontSize: 28 }}>{item.emoji}</span>
                  <span>
                    {KIND_BADGE[item.kind]} {item.name}
                  </span>
                  {isOwned ? (
                    <ChunkyButton small color={isEquipped ? '#7a6a55' : 'var(--chewy-green)'} colorDark={isEquipped ? '#5d4f3e' : 'var(--chewy-green-dark)'} onClick={() => onEquip?.(item)}>
                      {isEquipped ? 'Unequip' : 'Equip'}
                    </ChunkyButton>
                  ) : (
                    <ChunkyButton small disabled={coins < item.cost} onClick={() => onBuy?.(item)}>
                      🪙 {item.cost}
                    </ChunkyButton>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 1, display: 'grid', placeItems: 'center', padding: '12px 0 30px' }}>
          <ChunkyButton onClick={onClose}>Back to camp</ChunkyButton>
        </div>
      </div>
    </PhoneFrame>
  );
}
