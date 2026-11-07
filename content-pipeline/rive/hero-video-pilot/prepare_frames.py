#!/usr/bin/env python3
"""Prepare the existing transparent Chewy sequence without changing its motion.

This is an explicit import step, never invoked by the Rive build.
"""
from pathlib import Path
import hashlib
import io
import json
from PIL import Image

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
SOURCE = REPO / 'chewy/chewy/Assets.xcassets/hero.spriteatlas'
TARGET = ROOT / 'chewy/assets'
SIZE = (253, 530)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def prepare():
    originals = sorted(SOURCE.glob('idle_*.imageset/idle_*@2x.png'))
    expected = [SOURCE / f'idle_{i:03d}.imageset/idle_{i:03d}@2x.png' for i in range(121)]
    if originals != expected:
        raise ValueError('Expected the complete original sequence, frames 000 through 120')
    prepared = []
    for index, source in enumerate(originals):
        original = source.read_bytes()
        with Image.open(io.BytesIO(original)) as frame:
            if frame.size != (506, 1060) or frame.mode != 'RGBA':
                raise ValueError(f'Unexpected original frame: {source}')
            if frame.getchannel('A').getextrema() != (0, 255):
                raise ValueError(f'No useful alpha in {source}')
            output = io.BytesIO()
            frame.resize(SIZE, Image.Resampling.LANCZOS).save(output, format='PNG', optimize=True)
        data = output.getvalue()
        target = TARGET / f'frame-{index:03d}.png'
        if target.exists() and target.read_bytes() != data:
            raise ValueError(f'Refusing to replace changed prepared artwork: {target}')
        prepared.append((source, original, target, data))
    # Validate everything before writing; original media are read-only throughout.
    TARGET.mkdir(parents=True, exist_ok=True)
    records = []
    for index, (source, original, target, data) in enumerate(prepared):
        target.write_bytes(data)
        if source.read_bytes() != original:
            raise ValueError(f'Original changed during import: {source}')
        records.append({'frame': index, 'source': source.relative_to(REPO).as_posix(),
                        'source_sha256': digest(original), 'source_bytes': len(original),
                        'prepared': target.relative_to(ROOT).as_posix(),
                        'prepared_sha256': digest(data), 'prepared_bytes': len(data)})
    videos = []
    for name in ['idle.mov', 'idle_from_mov.mp4', 'kling_20260223_Image_to_Video_2D_cartoon_70_0.mp4']:
        path = REPO / 'assets' / name
        data = path.read_bytes()
        videos.append({'path': path.relative_to(REPO).as_posix(), 'sha256': digest(data), 'bytes': len(data)})
    manifest = {'schema_version': 1, 'fps': 24, 'frame_count': 121, 'duration_seconds': 121 / 24,
                'original_width': 506, 'original_height': 1060, 'width': SIZE[0], 'height': SIZE[1],
                'transform': 'Uniform half-size Lanczos resample; no crop, masking, stabilization, frame removal or retiming.',
                'playback': 'oneShot; original final pose differs from first; replay deliberately starts from frame 0',
                'artistic_approval': False, 'videos': videos, 'frames': records,
                'prepared_total_png_bytes': sum(len(row[3]) for row in prepared),
                'decoded_rgba_pixel_bytes': SIZE[0] * SIZE[1] * 4 * 121,
                'memory_estimate_note': 'Pixel buffer estimate only; not a measured GPU/runtime memory footprint.'}
    (ROOT / 'source-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(f'Prepared {len(records)} frames at {SIZE[0]}x{SIZE[1]}, original 24 fps, all source bytes preserved.')


if __name__ == '__main__':
    prepare()
