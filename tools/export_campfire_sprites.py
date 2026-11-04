"""Export the existing Runway clip with a stable, supersampled silhouette matte."""
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'content-pipeline/workspace/runway/generations/v-88693b1e774f4052a10744787f9b7574/source.mp4'
OUTPUT = ROOT / 'prototype/public/assets/camp-life/fire'
OUTPUT.mkdir(parents=True, exist_ok=True)
frames, boxes, areas = [], [], []
with tempfile.TemporaryDirectory() as directory:
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(SOURCE), '-vf', 'fps=24', f'{directory}/frame-%03d.png'], check=True)
    for path in sorted(Path(directory).glob('frame-*.png')):
        frame = Image.open(path).convert('RGB')
        # Close ink-width gaps before flood filling. The former seed-at-the-logs
        # filter dropped the whole flame whenever a black line separated it.
        support = Image.fromarray(np.where(np.asarray(frame).max(axis=2) >= 38, 255, 0).astype('uint8'))
        support = support.filter(ImageFilter.MaxFilter(11)).filter(ImageFilter.MinFilter(11)).copy()
        ImageDraw.floodfill(support, (0, 0), 128, thresh=0)
        matte = Image.fromarray(np.where(np.asarray(support) == 128, 0, 255).astype('uint8')).copy()
        # Keep every substantial component, including disconnected flame tongues.
        # No single seed controls whether the flame is retained.
        remaining = matte.copy()
        kept = np.zeros((frame.height, frame.width), dtype='uint8')
        while remaining.getbbox():
            coords = np.argwhere(np.asarray(remaining) == 255)
            y, x = coords[0]
            ImageDraw.floodfill(remaining, (int(x), int(y)), 128, thresh=0)
            pixels = np.asarray(remaining)
            component = pixels == 128
            if component.sum() >= 256:
                kept[component] = 255
            remaining = Image.fromarray(np.where(component, 0, pixels).astype('uint8')).copy()
        frame = frame.convert('RGBA')
        frame.putalpha(Image.fromarray(kept))
        # Premultiplied resizing gives antialiased edges without a black fringe.
        frame = frame.convert('RGBa').resize((512, 512), Image.Resampling.LANCZOS).convert('RGBA')
        frames.append(frame)
        boxes.append(frame.getbbox())
        alpha = np.asarray(frame)[:, :, 3]
        areas.append(int((alpha > 16).sum()))
        assert alpha[0, 0] == 0
crop = [max(0, min(b[0] for b in boxes)-2), max(0, min(b[1] for b in boxes)-2), min(512, max(b[2] for b in boxes)+2), min(512, max(b[3] for b in boxes)+2)]
width, height = crop[2]-crop[0], crop[3]-crop[1]
columns = 8
atlas = Image.new('RGBA', (columns*width, ((len(frames)+columns-1)//columns)*height))
for index, frame in enumerate(frames):
    atlas.paste(frame.crop(crop), ((index % columns)*width, (index // columns)*height))
atlas.save(OUTPUT / 'atlas.webp', lossless=True)
frames[0].crop(crop).save(OUTPUT / 'poster.png')
metadata = ROOT / 'prototype/src/core/camp-life.json'
clips = json.loads(metadata.read_text())
clips['fire'] = dict(fps=24, count=len(frames), columns=columns, width=width, height=height, crop=[0,0,width,height], file='atlas.webp')
metadata.write_text(json.dumps(clips, indent=2)+'\n')
max_drop = max(abs(a-b)/max(a,b) for a,b in zip(areas,areas[1:]))
assert min(areas)/max(areas) > .7, areas
assert max_drop < .12, max_drop
(OUTPUT / 'source.json').write_text(json.dumps(dict(source=str(SOURCE.relative_to(ROOT)), sha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(), processing='960px source; close 11px ink gaps; fill silhouette; keep all components >=256px; premultiplied resize to 512px; fixed union crop; unchanged frame order', frameCount=len(frames), alphaAreas=areas, maxAdjacentAreaChange=max_drop, loopApproved=False), indent=2)+'\n')
print(f'{len(frames)} frames; alpha area {min(areas)}–{max(areas)}; largest adjacent change {max_drop:.2%}', flush=True)
