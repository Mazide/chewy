# Обработка видео в спрайты

`video_to_spritesheet.py` извлекает кадры, убирает белый фон и сохраняет PNG-кадры
для SpriteKit либо PNG-спрайтшит с JSON. Это инструмент для существующего видео;
текущий план создания медиа — [ASSETS.md](../docs/ASSETS.md).

## Установка и запуск из корня проекта

```bash
python3 -m venv tools/.venv
tools/.venv/bin/pip install -r tools/requirements.txt

# Отдельные кадры для SpriteKit
tools/.venv/bin/python3 tools/video_to_spritesheet.py assets/idle.mp4 \
  --frames --out chewy/chewy/Assets.xcassets/hero.spriteatlas

# Спрайтшит и метаданные
tools/.venv/bin/python3 tools/video_to_spritesheet.py assets/idle.mp4 --out assets/output
```

## Параметры

| Флаг | По умолчанию | Назначение |
|---|---|---|
| `--out`, `-o` | Папка видео | Каталог результата |
| `--frames`, `-f` | Выключен | Отдельные кадры вместо спрайтшита |
| `--threshold`, `-t` | 20 | Порог удаления белого, 0–255 |
| `--step`, `-s` | 1 | Каждый N-й кадр |
| `--cols`, `-c` | 8 | Колонки спрайтшита |
| `--size` | Без ограничения | Длинная сторона в points; вместе с `--scale` задаёт пиксели, без увеличения |
| `--scale` | 2 | Масштаб ассета: 1, 2 или 3 |
| `--no-bg` | Выключен | Сохранить исходный фон |
| `--stabilize` | Выключен | Стабилизировать положение по центру альфа-маски |
| `--name`, `-n` | Имя видео | Префикс кадров, например `idle` |

При подключении нового атласа сверить `framePrefix` и `frameCount` в
`chewy/chewy/SpriteKitHeroView.swift`, затем проверить сборку и анимацию.
