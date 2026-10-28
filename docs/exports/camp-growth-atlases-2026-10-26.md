# Слои двух стадий лагеря · 2026-10-26

Созданы встроенным ImageGen по одобренной сравнительной иллюстрации `chewy-camp-growth-v1-2026-10-26.png`. Герой и пёс переиспользованы из существующего пака; их пиксели не менялись.

Оба исходника: RGBA PNG, 1536 × 1024, прозрачный фон. Сохранены целиком; `camp-growth-bounds.js` задаёт видимые границы каждой группы для CSS. Генерация дала неравные квадранты, поэтому границы измерены по альфа-каналу каждого объекта, а не по равным половинам.

- Начальный: `prototype/public/assets/camp-growth/initial-v1.png`; источник `exec-b2cf508b-736c-402d-8ad2-a48f92f3e215.png`.
- Обжитый: `prototype/public/assets/camp-growth/developed-v1.png`; источник `exec-cdfc49f7-d653-46c0-9745-9ab110cbff82.png`.
- Каталог источников: `/home/ndemidov/.codex/generated_images/01a173b6-be08-7f21-9113-495810f6e459/`.
- Референс в обоих запросах: `/home/ndemidov/Projects/chewy/docs/exports/chewy-camp-growth-v1-2026-10-26.png`.
- `transparent_background: true`.

## Начальный лагерь — точный промпт

```text
Use case: precise-object-edit, game sprite atlas.
Reference: the approved Chewy two-screen camp comparison. Make ONE transparent 2-by-2 sprite atlas of the FOUR SCENERY GROUPS for a single stage, retaining their illustrated identity. This is a production layer for a layered app scene, not a screenshot and not a comparison.
Transparent background with real alpha. Four isolated groups, each centered wholly inside its own equal-size quadrant, with a generous transparent gutter between all quadrants and clear margins at the atlas edges. No objects cross the center horizontal or vertical dividing lines. NO visible grid lines, labels, text, phone, interface, forest backdrop, ground slab, people, hero, dog, or background. Bare transparent space around the props. The groups touch imaginary ground at the bottom of their own cell. Keep original front three-quarter storybook angle, thin warm brown outlines and flat simple fills; modest subtle contact shadows only. Moss green lantern, orange tent, wooden crate, blue kettle, terracotta garden pot. Same flat cozy art as reference, not 3D or painterly.
Quadrant positions MUST be: upper-left shelter/workshop; upper-right lantern; lower-left campfire/fuel/kettle; lower-right garden. Every group must remain fully inside its cell.
Use ONLY the LEFT initial camp as the stage reference.
UPPER LEFT: orange A-frame tent with a small open crate of boards, wooden pegs and rolled cream canvas in front of the left side. No platform or awning. One compact group, tent and crate both fully visible.
UPPER RIGHT: plain slender wooden pole with one hanging green oil lantern, a small green oil flask at its base. Lantern and flask fully visible; no oversized glow.
LOWER LEFT: a low basket of twigs beside a small stone-ring campfire, and the blue kettle resting on the ground to its right. Entire group modest and low, no tripod.
LOWER RIGHT: one small terracotta pot with a healthy two-leaf sprout, and a little wooden seed box with seed envelopes. Keep these two adjacent, no flowers.
No other objects. Preserve simple silhouettes and clear edges for small-screen rendering.
```

## Обжитый лагерь — точный промпт

```text
Use case: precise-object-edit, game sprite atlas.
Reference: the approved Chewy two-screen camp comparison. Make ONE transparent 2-by-2 sprite atlas of the FOUR SCENERY GROUPS for a single stage, retaining their illustrated identity. This is a production layer for a layered app scene, not a screenshot and not a comparison.
Transparent background with real alpha. Four isolated groups, each centered wholly inside its own equal-size quadrant, with a generous transparent gutter between all quadrants and clear margins at the atlas edges. No objects cross the center horizontal or vertical dividing lines. NO visible grid lines, labels, text, phone, interface, forest backdrop, ground slab, people, hero, dog, or background. Bare transparent space around the props. The groups touch imaginary ground at the bottom of their own cell. Keep original front three-quarter storybook angle, thin warm brown outlines and flat simple fills; modest subtle contact shadows only. Moss green lantern, orange tent, wooden crate, blue kettle, terracotta garden pot. Same flat cozy art as reference, not 3D or painterly.
Quadrant positions MUST be: upper-left shelter/workshop; upper-right lantern; lower-left campfire/fuel/kettle; lower-right garden. Every group must remain fully inside its cell.
Use ONLY the RIGHT developed camp as the stage reference.
UPPER LEFT: original orange A-frame tent on a low wooden platform with a simple cream canvas awning, small crate of materials at front-left and compact shelf with one mug. This is a modest upgraded campsite, not a house. Keep all tent pegs, platform edges and canopy inside the quadrant.
UPPER RIGHT: crafted slender wooden lantern hanger with one green oil lantern and a charming golden shade, softly lit amber glass, small green oil flask at the base. No broad glow beyond the silhouette.
LOWER LEFT: neat low log pile beside the small stone-ring campfire, a wooden kettle support with the BLUE kettle hanging over the flame, and one small wooden stool on the right. Fully isolated and low composition.
LOWER RIGHT: one compact wood planter containing varied leaves and small white/purple flowers, with the original terracotta pot alongside, fully contained inside the cell. No bushes sprawling outside the cell.
No other objects. Match the initial reference style and scale of individual objects.
```

