# tools

Python scripts for asset processing. All scripts run from a local venv.

## Setup

```bash
python3 -m venv tools/.venv
tools/.venv/bin/pip install -r tools/requirements.txt
```

Or activate the env and run directly:

```bash
source tools/.venv/bin/activate
```

---

## video_to_spritesheet.py

Converts a white-background video into transparent PNG frames.

Removes the white background via chroma key, auto-crops each frame, then either
packs everything into a sprite sheet PNG + JSON metadata, or exports individual
frames ready to drop into a `.spriteatlas` folder for SpriteKit.

**Usage**

```bash
# Export individual frames for SpriteKit (hero.spriteatlas)
tools/.venv/bin/python3 tools/video_to_spritesheet.py assets/idle.mp4 \
  --frames \
  --out chewy/chewy/Assets.xcassets/hero.spriteatlas

# Export sprite sheet PNG + JSON metadata
tools/.venv/bin/python3 tools/video_to_spritesheet.py assets/idle.mp4 \
  --out assets/output
```

**Options**

| Flag | Default | Description |
|------|---------|-------------|
| `--frames` / `-f` | off | Export individual PNGs instead of a sprite sheet |
| `--out` / `-o` | same dir as video | Output directory |
| `--threshold` / `-t` | `20` | White removal aggressiveness (0–255). Increase if white fringe remains. |
| `--step` / `-s` | `1` | Use every Nth frame. `--step 2` halves the frame count. |
| `--cols` / `-c` | `8` | Columns in the sprite sheet (ignored with `--frames`) |
| `--no-crop` | off | Disable per-frame auto-crop |

**Workflow for a new animation**

1. Put the video in `assets/`
2. Run with `--frames --out chewy/chewy/Assets.xcassets/<name>.spriteatlas`
3. Update `framePrefix` and `frameCount` in `SpriteKitHeroView.swift`
4. Build in Xcode — the atlas is picked up automatically
