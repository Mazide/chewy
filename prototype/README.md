# chewy — Prototype Workbench

Storybook-песочница для быстрого прототипирования UI приложения **Chewy**
(веб-версии на React), чтобы итерироваться по дизайну без пересборки iOS-таргета.

Компоненты повторяют экраны нативного приложения (`chewy/chewy/*.swift`):
Hero с состояниями `idle / eating / happy`, домашний экран, экран добавления еды.

## Запуск

```bash
cd prototype
npm install
npm run storybook   # → http://localhost:6006
```

## Сборка статики

```bash
npm run build-storybook   # → storybook-static/
```

## Структура

```
src/
  theme.css              — дизайн-токены (цвета, радиусы, шрифт)
  components/
    Hero.jsx             — персонаж + состояния
    SpeechBubble.jsx     — реплика под героем
    AddFoodButton.jsx    — оранжевый FAB
    PortionSlider.jsx    — слайдер порции
    MealLogRow.jsx       — строка лога приёма пищи
    PhoneFrame.jsx       — рамка «телефона» для экранов
  screens/
    HomeScreen.jsx       — домашний экран
    AddFoodScreen.jsx    — экран камеры / добавления еды
```

Каждый компонент/экран имеет свой `*.stories.jsx` с состояниями и контролами.

## Ассеты из натива

В `public/assets/` лежат реальные ассеты приложения, чтобы прототип выглядел
как натив:

| Файл | Источник | Как используется |
|------|----------|------------------|
| `hero_idle_sheet.png` (+`.json`) | `hero.spriteatlas` (121 кадр, alpha) | спрайтшит, `Hero` рисует его на canvas |
| `background.webm` | `background.spriteatlas` (242 кадра) | анимированный фон домашнего экрана |
| `add_meal_icon.png` | `add_meal_icon.imageset` | иконка FAB |
| `camera_placeholder.jpg` | `camera_placeholder.imageset` | превью камеры |

Перегенерировать из `chewy/chewy/Assets.xcassets` (нужен `sharp` + ffmpeg):

```bash
npm install --no-save sharp
node scripts/encode-assets.mjs
```

Тайминги анимации героя (idle/eating/happy) в `Hero.jsx` повторяют
`HeroScene.swift` (24 fps, 0.6× на eating + пульс, 1.5× на happy с фиксацией
последнего кадра).

## Скриншоты экранов

```bash
npm install --no-save playwright
node scripts/build-storybook   # если ещё не собран
node scripts/shoot.mjs [storyId ...]   # → shots/*.png
```

## Как прототипировать

1. Открой Storybook, выбери компонент слева.
2. Крути контролы (например `status` у Hero) — состояние меняется вживую.
3. Правишь `.jsx` → HMR обновляет превью мгновенно.
4. Новый компонент = новый `Foo.jsx` + `Foo.stories.jsx`.
