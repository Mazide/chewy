#!/usr/bin/env python3
"""Render the actual Rive loop and lay out side-by-side review artifacts."""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

from generate_scene import DURATION, FPS

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parents[2] / "prototype/public/assets/sandbox/camp-v3-flat/fire.png"
PAPER = "#F6F1E7"
GREEN = "#DDE7D1"
INK = "#39291F"
THREAD = threading.local()
CROP = (110, 5, 545, 575)  # Room for rising tips, at half source resolution.


def run(command):
    result = subprocess.run(command, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(f"Failed: {command}\n{result.stdout}\n{result.stderr}")
    return result.stdout


def font(size, bold=False):
    family = "NotoSans:style=Bold" if bold else "NotoSans"
    path = run(["fc-match", "-f", "%{file}", family]).strip()
    return ImageFont.truetype(path, size)


def review_project(destination, backdrop=GREEN):
    destination.mkdir(parents=True)
    shutil.copyfile(ROOT / "rive.yaml", destination / "rive.yaml")
    tree = ET.parse(ROOT / "scene.rml")
    board = tree.getroot().find("Artboard")
    shape = ET.SubElement(board, "Shape", name="Preview background", x="656", y="599.5")
    ET.SubElement(shape, "Rectangle", width="1312", height="1199")
    fill = ET.SubElement(shape, "Fill")
    ET.SubElement(fill, "SolidColor", colorValue="FF" + backdrop.lstrip("#"))
    tree.write(destination / "scene.rml", encoding="unicode")


def reference_tile():
    original = Image.open(SOURCE).convert("RGBA")
    background = Image.new("RGBA", original.size, GREEN)
    background.alpha_composite(original)
    return background.convert("RGB").resize((656, 600), Image.Resampling.LANCZOS).crop(CROP)


def page_frame(reference, frame, output):
    page = Image.new("RGB", (1120, 820), PAPER)
    draw = ImageDraw.Draw(page)
    draw.text((46, 25), "Наш базовый костёр", font=font(32, True), fill=INK)
    draw.text((48, 77), "Живое пламя · рисунок по исходнику", font=font(20), fill="#796A5B")
    for x, label, tile in ((44, "Исходник", reference), (584, "Rive · движение пламени", frame.crop(CROP))):
        draw.rounded_rectangle((x, 129, x + 492, 744), radius=24, fill=GREEN)
        fitted = ImageOps.contain(tile, (415, 550), Image.Resampling.LANCZOS)
        page.paste(fitted, (x + (492 - fitted.width) // 2, 139 + (550 - fitted.height) // 2))
        draw.text((x + 246, 706), label, font=font(21, True), fill=INK, anchor="mm")
    draw.text((48, 777), "Поленья неподвижны · три независимых контура огня", font=font(19), fill="#796A5B")
    page.save(output)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rive", default=shutil.which("rive") or "/tmp/chewy-rive-cli/bin/rive")
    parser.add_argument("--fps", type=int, choices=(15, 20, 30), default=30)
    parser.add_argument("--workers", type=int, choices=(1, 2, 3), default=3)
    parser.add_argument("--stills", action="store_true", help="Render contact sheet only for motion review")
    args = parser.parse_args()
    exports = ROOT / "exports"
    exports.mkdir(exist_ok=True)
    reference = reference_tile()
    loop_seconds = DURATION / FPS
    frames_count = round(args.fps * loop_seconds)
    with tempfile.TemporaryDirectory(prefix="chewy-base-fire-") as directory:
        temporary = Path(directory)

        def initialize():
            THREAD.project = temporary / f"worker-{threading.get_ident()}"
            review_project(THREAD.project)

        def capture(index):
            # First tick enters the animation; only subsequent ticks advance it.
            ticks = round(index * 60 / args.fps) + 1
            raw = temporary / f"raw-{index:04d}.png"
            run([args.rive, str(THREAD.project), f"--advance={ticks}",
                 "--viewport=1312x1199", "--fit=contain", f"--screenshot={raw}"])
            # Match the original reference's downsampling for a fair comparison.
            frame = Image.open(raw).convert("RGB").resize((656, 600), Image.Resampling.LANCZOS)
            frame.save(raw)
            if index < frames_count:
                page_frame(reference, frame, temporary / f"page-{index:04d}.png")
            return raw

        indices = list(range(frames_count + 1))
        if args.stills:
            indices = [round(frames_count * index / 12) for index in range(13)]
        with ThreadPoolExecutor(max_workers=args.workers, initializer=initialize) as pool:
            captures = []
            for number, path in enumerate(pool.map(capture, indices), start=1):
                captures.append(path)
                if number % 30 == 0 or number == len(indices):
                    print(f"Rendered {number}/{len(indices)}", flush=True)
        if args.stills:
            sheet = Image.new("RGB", (1200, 1020), PAPER)
            draw = ImageDraw.Draw(sheet)
            for index, path in enumerate(captures[:12]):
                tile = ImageOps.contain(Image.open(path).crop(CROP), (270, 290), Image.Resampling.LANCZOS)
                x, y = (index % 4) * 300, (index // 4) * 340
                sheet.paste(tile, (x + (300 - tile.width) // 2, y + 5))
                draw.text((x + 150, y + 310), f"{indices[index] / args.fps:g} s", font=font(20), fill=INK, anchor="mm")
            sheet.save(exports / "motion-study.png")
            return
        first = np.asarray(Image.open(captures[0]).convert("RGB"), dtype=np.int16)
        last = np.asarray(Image.open(captures[-1]).convert("RGB"), dtype=np.int16)
        animated_changes, base_changes = [], []
        for path in captures[1:-1]:
            frame = np.asarray(Image.open(path).convert("RGB"), dtype=np.int16)
            difference = np.max(np.abs(frame - first), axis=2)
            animated_changes.append(int((difference > 4).sum()))
            base_changes.append(int((difference[430:, :] > 1).sum()))
        before = np.asarray(Image.open(captures[-2]).convert("RGB"), dtype=np.int16)
        key_deltas = []
        for prop in ET.parse(ROOT / "scene.rml").iter("KeyedProperty"):
            keys = prop.findall("KeyFrameDouble")
            if len(keys) > 1:
                key_deltas.append(abs(float(keys[0].get("value")) - float(keys[-1].get("value"))))
        report = {
            "renderer": "Rive CLI 1.8.0; actual state machine; headless",
            "loop_seconds": loop_seconds,
            "preview_fps": args.fps,
            "frames": frames_count,
            "loop_first_last_max_channel_delta": int(np.abs(first - last).max()),
            "loop_first_last_changed_pixels": int((np.max(np.abs(first-last), axis=2) > 1).sum()),
            "loop_first_last_mean_channel_delta": float(np.abs(first-last).mean()),
            "loop_keyframe_max_value_delta": max(key_deltas, default=0),
            "last_interval_changed_pixels": int((np.max(np.abs(before-last), axis=2) > 4).sum()),
            "max_flame_changed_pixels": max(animated_changes),
            "max_static_base_changed_pixels": max(base_changes),
            "source": str(SOURCE.relative_to(ROOT.parents[2])),
            "ios_runtime_tested": False,
            "art_owner_approved": False,
            "base_art_direction_accepted": True,
            "motion_owner_approved": False,
        }
        (exports / "qa.json").write_text(json.dumps(report, indent=2) + "\n")
        assert max(animated_changes) > 100, "The flame did not animate."
        assert max(base_changes) == 0, "The base moved."
        assert report["loop_keyframe_max_value_delta"] == 0, "Authored loop does not close."
        # Rive's float clock/MSAA can change sparse edge pixels at an exact
        # wrap. Bound the mean error and amplitude as well as the pixel count;
        # a one-frame timing error changes >11,000 pixels on this six-sec loop.
        assert report["loop_first_last_changed_pixels"] < 200, "Loop endpoints differ."
        assert report["loop_first_last_mean_channel_delta"] < .01, "Loop endpoint mean error is too large."
        assert report["loop_first_last_max_channel_delta"] < 32, "Loop endpoint edge error is too large."
        shutil.copyfile(temporary / "page-0000.png", exports / "comparison.png")
        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
             "-framerate", str(args.fps), "-i", str(temporary / "page-%04d.png"),
             "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18",
             "-movflags", "+faststart", str(exports / "preview.mp4")])
        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
             "-framerate", str(args.fps), "-i", str(temporary / "page-%04d.png"),
             "-vf", "fps=15,scale=840:615", "-c:v", "libwebp_anim", "-quality", "84",
             "-loop", "0", str(exports / "preview.webp")])
        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
             "-framerate", str(args.fps), "-i", str(temporary / "raw-%04d.png"),
             "-frames:v", str(frames_count), "-vf", "crop=436:570:110:5,pad=520:640:42:35:color=0xDDE7D1",
             "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "17",
             "-movflags", "+faststart", str(exports / "animation.mp4")])
        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
             "-framerate", str(args.fps), "-i", str(temporary / "raw-%04d.png"),
             "-t", str(loop_seconds), "-vf", "fps=20,crop=436:570:110:5,pad=520:640:42:35:color=0xDDE7D1",
             "-c:v", "libwebp_anim", "-quality", "88", "-loop", "0",
             str(exports / "animation.webp")])
        for old_frame in exports.glob("frame-*.png"):
            old_frame.unlink()
        for index in (0, frames_count // 4, frames_count // 2, 3 * frames_count // 4):
            shutil.copyfile(captures[index], exports / f"frame-{index:03d}.png")
    print(json.dumps(report, indent=2), flush=True)
    for artifact in exports.iterdir():
        print(f"{artifact.name}: {artifact.stat().st_size:,} B")


if __name__ == "__main__":
    main()
