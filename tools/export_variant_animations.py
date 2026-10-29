"""Export accepted draft motion to the prototype, with fixed all-frame bounds."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'content-pipeline/workspace/batches/variants-2026-10-29/animated-v1'
DEST = ROOT / 'prototype/public/assets/variant-motion'

def main():
    catalog = []
    for item in json.loads((SOURCE / 'manifest.json').read_text()):
        if item['review']['status'] == 'needs-redraw':
            continue
        slug = item['slug']
        folder = SOURCE / 'assets' / slug
        frames, durations = [], []
        with Image.open(folder / 'preview.webp') as image:
            for index in range(image.n_frames):
                image.seek(index)
                frames.append(image.convert('RGBA'))
                durations.append(image.info.get('duration', 42))
        boxes = [frame.getchannel('A').getbbox() for frame in frames]
        assert all(boxes), slug
        crop = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
        frames = [frame.crop(crop) for frame in frames]
        output = DEST / slug
        output.mkdir(parents=True, exist_ok=True)
        frames[0].save(output / 'poster.png')
        frames[0].save(output / 'motion.webp', save_all=True, append_images=frames[1:], duration=durations, loop=0, lossless=True, method=0, exact=True)
        catalog.append({key: item[key] for key in ['slug', 'title', 'group', 'review']} | {'width': frames[0].width, 'height': frames[0].height, 'crop': crop, 'frames': len(frames), 'durationMs': sum(durations)})
        print(slug, flush=True)
    (ROOT / 'prototype/src/core/variant-motion.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n')

if __name__ == '__main__':
    main()
