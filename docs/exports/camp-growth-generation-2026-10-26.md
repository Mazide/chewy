# Начальный и обжитый лагерь · визуальная проба

Дата: 2026-10-26. Создано встроенным imagegen, без CLI/API.

Изображение: [chewy-camp-growth-v1-2026-10-26.png](chewy-camp-growth-v1-2026-10-26.png).

## Назначение

Сравнить два состояния одной лесной стоянки и проверить, помещаются ли четыре
ресурсных предмета рядом с героем. Это нарисованный концепт для ревью; текущие
экраны Storybook и игровые правила не изменены.

Сохранены исходный герой, оранжевая палатка, пёс, общий ракурс и время суток.
Герой уменьшен относительно прежнего главного экрана, чтобы открыть четыре зоны:
обустройство слева у палатки, топливо внизу слева, свет справа, сад внизу справа.
В развитом состоянии добавлены настил и навес, опора чайника, оформленный фонарь,
компактный цветник. Нижние «Сегодня» и «+ Еда» остаются отдельными действиями.

Подписи четырёх зон служат пояснением на этой примерке. Их постоянное присутствие
на главном экране пока не утверждено; возможен показ по нажатию или при знакомстве.

## Референсы

- `prototype/shots/journey-world/camp-forest.jpg` — текущая сцена, палитра, UI.
- `prototype/public/assets/sandbox/archive-reference/hero_idle_sheet.png` — идентичность героя.

## Полный промпт

```text
Use case: ui-mockup, illustration-story.
Create ONE high-quality comparison image showing two mobile app camp screens side by side: the initial Chewy camp and the same camp after gradual development. This is an exploratory visual design, not an advertisement. Both complete portrait screens must be large and clearly readable in one landscape comparison board, with ample quiet margins.

INPUT REFERENCES:
Image 1 is the current Chewy Storybook screenshot. Use only the illustrated phone's forest, orange tent, original blond human hero, little tan dog, palette and approachable flat drawing style. Discard the surrounding browser and inspector.
Image 2 is the original hero sprite sheet: identity reference only. Draw exactly ONE instance of this SAME character per screen: blond tousled hair, simple dot eyes, cream shirt, blue trousers, grey wrapped boots, friendly slight smile, slim original proportions. Never replace the hero with an animal, mascot blob, baby or muscular upgraded person.

COMPARISON INVARIANTS:
The exact same sunny late-afternoon forest clearing, camera angle, tree positions, orange tent location and hero scale in both panels. Elevated frontal storybook view into the clearing, not strict isometric. Same healthy, content hero in both states. Development changes the camp's useful objects and coziness; it does not alter the hero's health or body.
Make the hero smaller than in the reference screenshot to free usable scene space: about a quarter of the screen height, positioned centrally, with clear breathing room and visible full body. The orange tent sits behind him on the left. Keep the simple dog nearby, small and subordinate.
Use thin warm dark outlines, flat soft colored fills, very restrained shadows, simple charming readable silhouettes. Match the existing illustrated app. Muted moss greens, orange tent, cream paper UI, warm brown wood. No photorealism, no 3D rendering, no lush painterly over-detail.

LAYOUT SOLVES FOUR RESOURCES INSIDE THE SCENE:
Four easily distinguished object groups occupy THE SAME footprint in both panels:
1. OBUSTROYSTVO / building: left-middle, at the tent edge. Initial: small open wood crate with a few boards, pegs and a rolled piece of canvas. Developed: a tidy small workbench/crate with materials, a modest wooden tent platform and a simple canvas awning, plus a small shelf with a mug. This must remain a campsite, not turn into a house.
2. TOPLIVO / fuel: lower-left foreground, separated from the building crate. Initial: a modest twig basket next to a small friendly stone-ring campfire and blue kettle. Developed: neat low log stack beside the same campfire, a kettle support and one small sitting stool. The flame stays small and cozy, not huge.
3. SVET / light: right-middle, with a clearly visible lantern pole. Initial: one simple green oil lantern on a plain stake, a small oil flask at its base. Developed: a crafted wooden hanger and the same lantern with a charming decorated shade and gentle amber glow; oil flask still readable. Keep the lantern visible against foliage, not overlapping the hero.
4. SAD / garden: lower-right foreground. Initial: a small terracotta pot with one healthy sprout and a little seed box. Developed: one compact planter with varied leaves and flowers, plus the original pot, all arranged within the same limited area. No sprawling farm, no greenhouse, no huge excess of flowers.

Preserve clear paths and negative space between objects; avoid dense piles of decorations. The upgrade should feel attainable and inhabited, not luxurious. In the developed panel the hero holds a small mug naturally. In the initial panel he stands relaxed. Both faces happy.

MOBILE UI:
Two clean rounded portrait app viewports, no photoreal device hardware. Forest scene dominates.
At top of each screen: small 'chewy' and subtitle 'Лесная стоянка'.
Compact illustrated navigation for 'Путь' and 'Рюкзак' near upper-right, not obstructing resource objects.
At bottom: a small paper journal control 'Сегодня' at lower-left, independent compact dark moss button '+ Еда' at lower-right. Preserve a clear bottom action area in BOTH panels, separate from garden/fire. Do not join these actions into one big dashboard.
NO percentages, calorie numbers, numeric levels, progress HUD, price labels, or red warning states. The objects themselves communicate the resource metaphor.
If adding resource labels, use only very small unobtrusive paper tags next to each of the four groups, with EXACT words: 'Обустройство', 'Топливо', 'Свет', 'Сад'. No leader lines crossing the hero, no extra panels or stat cards.

BOARD TEXT, Russian, exact, legible friendly rounded type:
Above left screen: 'В начале'
Above right screen: 'Со временем'
At bottom of the comparison board: 'Те же места — больше жизни'
No other marketing copy. No watermarks. Both full screens and all bottom controls visible, no cropping.
The key deliverable is convincing spatial composition: a modest beginning and a developed camp that keep the same four useful zones and enough room for the hero.
```

