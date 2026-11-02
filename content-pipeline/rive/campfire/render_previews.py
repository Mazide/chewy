#!/usr/bin/env python3
"""Render the real Rive campfire into review artifacts, without changing its art.

Run from any directory:
    python content-pipeline/rive/campfire/render_previews.py --rive /path/to/rive

Requires the Rive CLI, Pillow, ffmpeg, and a font with Cyrillic glyphs. The
temporary preview scene adds a pale green background; scene.rml and the
transparent production export are never modified. Every video frame replays
the same sequence through the actual state machine, including transitions.
"""

from __future__ import annotations

import argparse
import concurrent.futures
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading
import xml.etree.ElementTree as ET

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
LABELS = ("Спящее", "Начало", "Активное", "Живое", "Профицит")
SEQUENCE = (0, 1, 2, 3, 4, 0)
PAPER = "#F6F1E7"
GREEN = "#DDE7D1"
INK = "#3D3026"
MUTED = "#756C5E"
CROP = (75, 65, 335, 355)
THREAD_LOCAL = threading.local()


def run(command: list[str]) -> str:
    result = subprocess.run(command, text=True, capture_output=True, check=False)
    if result.returncode:
        raise RuntimeError(f"Command failed: {' '.join(command)}\n{result.stdout}\n{result.stderr}")
    return result.stdout


def font_path(bold: bool = False) -> str:
    family = "NotoSans:style=Bold" if bold else "NotoSans"
    result = run(["fc-match", "-f", "%{file}", family]).strip()
    if not result:
        raise RuntimeError("A Cyrillic font is required; install Noto Sans or DejaVu Sans.")
    return result


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(font_path(bold), size)


def centered(draw: ImageDraw.ImageDraw, x: float, y: float, text: str,
             face: ImageFont.FreeTypeFont, fill: str = INK) -> None:
    draw.text((x, y), text, font=face, fill=fill, anchor="mt")


def prepare_project(destination: Path, scene: bytes) -> None:
    destination.mkdir(parents=True)
    shutil.copyfile(ROOT / "rive.yaml", destination / "rive.yaml")
    tree = ET.fromstring(scene)
    artboard = tree.find("Artboard")
    if artboard is None:
        raise RuntimeError("Campfire scene has no Artboard.")
    # Rive draws earlier sibling shapes over later siblings.
    background = ET.SubElement(artboard, "Shape", {
        "name": "Preview backdrop only", "x": "200", "y": "200",
    })
    ET.SubElement(background, "Rectangle", {"width": "400", "height": "400"})
    fill = ET.SubElement(background, "Fill")
    ET.SubElement(fill, "SolidColor", {"colorValue": "FFDDE7D1"})
    ET.indent(tree, space="  ")
    (destination / "scene.rml").write_text(ET.tostring(tree, encoding="unicode") + "\n")


def state_sequence(frame: int, fps: int) -> list[str]:
    """Replay all preceding stages, then advance to this frame (60 Hz Rive)."""
    segment, frame_in_segment = divmod(frame, fps * 2)
    commands: list[str] = []
    for previous in range(segment):
        commands.append(f"--data=stage={SEQUENCE[previous]}")
        # Mid-sequence --data advances one frame itself; initial --data does not.
        commands.append(f"--advance={120 if previous == 0 else 119}")
    commands.append(f"--data=stage={SEQUENCE[segment]}")
    target = round(frame_in_segment * 60 / fps) + 1
    remaining = target if segment == 0 else target - 1
    if remaining:
        commands.append(f"--advance={remaining}")
    return commands


def make_contact_sheet(images: list[Path], output: Path) -> None:
    page = Image.new("RGB", (1500, 540), PAPER)
    draw = ImageDraw.Draw(page)
    draw.text((43, 28), "Пять состояний костра", font=font(38, True), fill=INK)
    draw.text((45, 85), "Векторная проба · Rive", font=font(22), fill=MUTED)
    for index, source in enumerate(images):
        left = 42 + index * 286
        draw.rounded_rectangle((left, 140, left + 270, 483), radius=24, fill=GREEN)
        tile = Image.open(source).convert("RGB").crop(CROP).resize((244, 272), Image.Resampling.LANCZOS)
        page.paste(tile, (left + 13, 150))
        centered(draw, left + 135, 436, LABELS[index], font(25, True))
    draw.text((45, 505), "Ступени различаются и без движения", font=font(17), fill=MUTED)
    page.save(output)


def compose_video_frame(source: Path, stage: int, output: Path) -> None:
    page = Image.new("RGB", (800, 700), PAPER)
    draw = ImageDraw.Draw(page)
    draw.text((42, 30), "Костёр", font=font(34, True), fill=INK)
    draw.text((44, 80), "Векторная проба · Rive", font=font(20), fill=MUTED)
    draw.rounded_rectangle((40, 126, 760, 610), radius=28, fill=GREEN)
    crop = Image.open(source).convert("RGB").crop(CROP)
    crop = crop.resize((400, 446), Image.Resampling.LANCZOS)
    page.paste(crop, (200, 142))
    centered(draw, 400, 636, LABELS[stage], font(30, True))
    # Five quiet markers communicate position, without numeric product UI.
    for index in range(5):
        x = 638 + index * 24
        draw.ellipse((x, 60, x + 10, 70), fill=INK if index == stage else "#D5CDBF")
    page.save(output)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--rive", default=shutil.which("rive") or "/tmp/chewy-rive-cli/bin/rive")
    parser.add_argument("--fps", type=int, choices=(12, 15, 20, 24, 30), default=15)
    parser.add_argument("--workers", type=int, choices=(1, 2, 3), default=3)
    args = parser.parse_args()
    outputs = ROOT / "exports"
    outputs.mkdir(exist_ok=True)
    scene = (ROOT / "scene.rml").read_bytes()
    with tempfile.TemporaryDirectory(prefix="chewy-campfire-preview-") as temp_name:
        temp = Path(temp_name)
        project = temp / "review"
        prepare_project(project, scene)
        print(run([args.rive, str(project), "--verify"]), flush=True)
        print(run([args.rive, "inspect", str(project), "--summary"]), flush=True)
        stills: list[Path] = []
        for stage in range(5):
            still = temp / f"stage-{stage}.png"
            run([args.rive, str(project), f"--data=stage={stage}", "--advance=1s", f"--screenshot={still}"])
            stills.append(still)
        make_contact_sheet(stills, outputs / "contact-sheet.png")
        print(f"Contact sheet: {outputs / 'contact-sheet.png'}", flush=True)

        def initialize_worker() -> None:
            worker = temp / f"worker-{threading.get_ident()}"
            prepare_project(worker, scene)
            THREAD_LOCAL.project = worker

        def capture(index: int) -> int:
            raw = temp / f"raw-{index:04d}.png"
            run([args.rive, str(THREAD_LOCAL.project), *state_sequence(index, args.fps), f"--screenshot={raw}"])
            stage = SEQUENCE[index // (args.fps * 2)]
            compose_video_frame(raw, stage, temp / f"frame-{index:04d}.png")
            raw.unlink()
            return index

        total = args.fps * 12
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers, initializer=initialize_worker) as pool:
            for count, _ in enumerate(pool.map(capture, range(total)), start=1):
                if count % 30 == 0 or count == total:
                    print(f"Rendered {count}/{total} frames", flush=True)

        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-framerate", str(args.fps),
             "-i", str(temp / "frame-%04d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p",
             "-crf", "19", "-movflags", "+faststart", str(outputs / "preview.mp4")])
        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-framerate", str(args.fps),
             "-i", str(temp / "frame-%04d.png"), "-vf", "scale=640:560", "-c:v", "libwebp_anim",
             "-quality", "82", "-loop", "0", str(outputs / "preview.webp")])
    for name in ("contact-sheet.png", "preview.mp4", "preview.webp"):
        artifact = outputs / name
        print(f"{artifact}: {artifact.stat().st_size:,} bytes", flush=True)


if __name__ == "__main__":
    main()
