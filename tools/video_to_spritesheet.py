#!/usr/bin/env python3
"""
video_to_spritesheet.py

Converts a video with a white background into a PNG sprite sheet with transparency.

Steps:
  1. Extract frames from the video (via OpenCV)
  2. Remove white background using chroma key (color threshold)
  3. Auto-crop each frame to remove empty transparent edges
  4. Pack all frames into a single sprite sheet PNG
  5. Write a JSON metadata file with frame coordinates

Usage:
  python3 video_to_spritesheet.py <video_file> [options]

  python3 video_to_spritesheet.py ../assets/animation.mov
  python3 video_to_spritesheet.py ../assets/animation.mov --threshold 30 --cols 8 --out ../assets/output

Dependencies:
  pip install opencv-python pillow numpy
"""

import argparse
import json
import math
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


# ---------------------------------------------------------------------------
# Background removal
# ---------------------------------------------------------------------------

def remove_white_background(frame_bgr: np.ndarray, threshold: int = 20) -> Image.Image:
    """
    Remove white background using a two-pass approach:
      1. Flood-fill from edges on a white-threshold mask → rough BG estimate
      2. GrabCut initialized with that rough mask → clean segmentation that
         handles open gaps between limbs and light-colored clothing.

    Args:
        frame_bgr: OpenCV frame in BGR uint8 format.
        threshold: Color distance from white used for the flood-fill seed.

    Returns:
        RGBA PIL Image.
    """
    from collections import deque

    rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    h, w = rgb.shape[:2]

    # --- Pass 1: flood-fill rough BG mask ---
    white = np.array([255, 255, 255], dtype=np.float32)
    dist = np.linalg.norm(rgb.astype(np.float32) - white, axis=2)
    near_white = dist <= threshold

    bg_rough = np.zeros((h, w), dtype=bool)
    queue: deque = deque()
    for x in range(w):
        for ye in [0, h - 1]:
            if near_white[ye, x] and not bg_rough[ye, x]:
                bg_rough[ye, x] = True
                queue.append((ye, x))
    for y in range(h):
        for xe in [0, w - 1]:
            if near_white[y, xe] and not bg_rough[y, xe]:
                bg_rough[y, xe] = True
                queue.append((y, xe))
    while queue:
        y, x = queue.popleft()
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not bg_rough[ny, nx] and near_white[ny, nx]:
                bg_rough[ny, nx] = True
                queue.append((ny, nx))

    # --- Pass 2: GrabCut initialized with the rough mask ---
    gc_mask = np.full((h, w), cv2.GC_PR_FGD, dtype=np.uint8)
    gc_mask[bg_rough] = cv2.GC_PR_BGD
    # Border pixels = definite background
    gc_mask[:5, :]  = cv2.GC_BGD
    gc_mask[-5:, :] = cv2.GC_BGD
    gc_mask[:, :5]  = cv2.GC_BGD
    gc_mask[:, -5:] = cv2.GC_BGD

    bgd_model = np.zeros((1, 65), np.float64)
    fgd_model = np.zeros((1, 65), np.float64)
    cv2.grabCut(frame_bgr, gc_mask, None, bgd_model, fgd_model, 10, cv2.GC_INIT_WITH_MASK)

    fg_mask = np.where(
        (gc_mask == cv2.GC_BGD) | (gc_mask == cv2.GC_PR_BGD), 0, 1
    ).astype(np.uint8)

    # Feather the mask edges: erode slightly then gaussian-blur the alpha
    # so ±1-2px GrabCut jitter between frames becomes invisible.
    kernel = np.ones((3, 3), np.uint8)
    fg_mask = cv2.erode(fg_mask, kernel, iterations=1)
    alpha = (fg_mask * 255).astype(np.uint8)
    alpha = cv2.GaussianBlur(alpha, (5, 5), sigmaX=1.5)

    rgba = np.dstack([rgb, alpha])
    return Image.fromarray(rgba, "RGBA")


# ---------------------------------------------------------------------------
# Sprite sheet packing
# ---------------------------------------------------------------------------

def pack_spritesheet(frames: list[Image.Image], cols: int) -> tuple[Image.Image, list[dict]]:
    """
    Pack frames into a sprite sheet with a fixed number of columns.
    All frames are padded to the size of the largest frame.

    Returns:
        (sprite_sheet_image, list of frame metadata dicts)
    """
    if not frames:
        raise ValueError("No frames to pack")

    max_w = max(f.width for f in frames)
    max_h = max(f.height for f in frames)

    rows = math.ceil(len(frames) / cols)
    sheet_w = max_w * cols
    sheet_h = max_h * rows

    sheet = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))
    metadata = []

    for i, frame in enumerate(frames):
        col = i % cols
        row = i // cols
        x = col * max_w
        y = row * max_h

        # Center the frame within its cell
        offset_x = (max_w - frame.width) // 2
        offset_y = (max_h - frame.height) // 2

        sheet.paste(frame, (x + offset_x, y + offset_y), frame)

        metadata.append({
            "frame": i,
            "x": x,
            "y": y,
            "w": max_w,
            "h": max_h,
            "content_x": x + offset_x,
            "content_y": y + offset_y,
            "content_w": frame.width,
            "content_h": frame.height,
        })

    return sheet, metadata


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def extract_frames(
    video_path: Path,
    threshold: int,
    step: int,
    remove_bg: bool = True,
) -> tuple[list[Image.Image], float]:
    """Extract and process frames from video. Returns (frames, fps)."""
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print(f"[ERROR] Cannot open video: {video_path}", file=sys.stderr)
        sys.exit(1)

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    print(f"[INFO] Video: {video_path.name}")
    print(f"[INFO] Total frames: {total_frames}, FPS: {fps:.2f}, Step: {step}")

    frames: list[Image.Image] = []
    frame_idx = 0
    extracted = 0

    while True:
        ret, bgr = cap.read()
        if not ret:
            break

        if frame_idx % step == 0:
            if remove_bg:
                rgba = remove_white_background(bgr, threshold=threshold)
            else:
                rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
                rgba = Image.fromarray(rgb, "RGB").convert("RGBA")
            frames.append(rgba)
            extracted += 1
            print(f"\r[INFO] Processed frame {frame_idx}/{total_frames} ({extracted} kept)", end="")

        frame_idx += 1

    cap.release()
    print()
    return frames, fps





def stabilize_frames(frames: list[Image.Image]) -> list[Image.Image]:
    """
    Shift each frame so that:
      - horizontally: alpha center-of-mass aligns to the median cx
      - vertically:   the BOTTOM edge of content aligns to the median bottom edge

    Aligning by bottom edge keeps feet/legs perfectly still, which is what
    the eye notices most. Canvas grows to fit all shifts without clipping.
    """
    import numpy as np
    import statistics

    def anchor_points(img: Image.Image):
        arr = np.array(img)
        alpha = arr[:, :, 3].astype(float)
        total = alpha.sum()
        # horizontal: center of mass
        cx = (alpha * np.arange(img.width)).sum() / total if total else img.width / 2
        # vertical: lowest non-transparent row (bottom edge of feet)
        rows_with_content = np.where(np.any(alpha > 10, axis=1))[0]
        bottom_y = int(rows_with_content[-1]) if len(rows_with_content) else img.height - 1
        return cx, bottom_y

    anchors = [anchor_points(f) for f in frames]
    target_cx     = statistics.median(a[0] for a in anchors)
    target_bottom = statistics.median(a[1] for a in anchors)

    # Integer shift per frame: move cx → target_cx, bottom → target_bottom
    shifts = [
        (round(target_cx - cx), round(target_bottom - bottom_y))
        for cx, bottom_y in anchors
    ]

    # Canvas large enough to hold all shifted frames without clipping
    max_left  = max(-min(sx for sx, _ in shifts), 0)
    max_right = max( max(sx for sx, _ in shifts), 0)
    max_top   = max(-min(sy for _, sy in shifts), 0)
    max_bot   = max( max(sy for _, sy in shifts), 0)

    base_w, base_h = frames[0].width, frames[0].height
    canvas_w = base_w + max_left + max_right
    canvas_h = base_h + max_top  + max_bot

    result = []
    for frame, (sx, sy) in zip(frames, shifts):
        canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
        canvas.paste(frame, (max_left + sx, max_top + sy), frame)
        result.append(canvas)

    print(f"[INFO] Stabilized {len(frames)} frames: canvas {base_w}x{base_h} → {canvas_w}x{canvas_h}, "
          f"target cx={target_cx:.1f}, target bottom={target_bottom:.0f}")
    return result


def resize_frame(image: Image.Image, max_pt: int, scale: int) -> Image.Image:
    """
    Resize frame so its longest side = max_pt * scale pixels.
    Preserves aspect ratio. No upscaling.
    """
    target_px = max_pt * scale
    w, h = image.size
    longest = max(w, h)
    if longest <= target_px:
        return image
    ratio = target_px / longest
    new_w = max(1, round(w * ratio))
    new_h = max(1, round(h * ratio))
    return image.resize((new_w, new_h), Image.LANCZOS)


def process_video(
    video_path: Path,
    out_dir: Path,
    threshold: int = 20,
    cols: int = 8,
    step: int = 1,
    frames_only: bool = False,
    max_pt: int | None = None,
    scale: int = 2,
    remove_bg: bool = True,
    stabilize: bool = False,
    name: str | None = None,
):
    out_dir.mkdir(parents=True, exist_ok=True)

    frames, fps = extract_frames(video_path, threshold=threshold, step=step, remove_bg=remove_bg)

    if stabilize:
        frames = stabilize_frames(frames)

    if max_pt is not None:
        frames = [resize_frame(f, max_pt, scale) for f in frames]
        sample = frames[0]
        print(f"[INFO] Resized to {sample.width}x{sample.height}px (@{scale}x, {max_pt}pt target)")

    if not frames:
        print("[ERROR] No usable frames extracted. Try increasing --threshold.", file=sys.stderr)
        sys.exit(1)

    stem = name if name else video_path.stem

    if frames_only:
        # ── Export as .spriteatlas (each frame in its own .imageset) ────────
        # Xcode requires: frame.imageset/Contents.json + frame.imageset/frame.png

        # Normalise all frames to a single canvas (max w × max h),
        # content centred — prevents per-frame size jitter in SpriteKit.
        canvas_w = max(f.width for f in frames)
        canvas_h = max(f.height for f in frames)
        normalised = []
        for f in frames:
            if f.size == (canvas_w, canvas_h):
                normalised.append(f)
            else:
                canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
                ox = (canvas_w - f.width) // 2
                oy = (canvas_h - f.height) // 2
                canvas.paste(f, (ox, oy), f)
                normalised.append(canvas)
        frames = normalised
        print(f"[INFO] Canvas size: {canvas_w}x{canvas_h}px (all frames normalised)")

        digits = len(str(len(frames) - 1))
        scale_tag = f"@{scale}x" if scale > 1 else ""
        scale_str = f"{scale}x"
        print(f"[INFO] Saving {len(frames)} imagesets → {out_dir}/")

        # Root Contents.json for the .spriteatlas
        atlas_contents = {"info": {"author": "xcode", "version": 1}}
        with open(out_dir / "Contents.json", "w") as f:
            json.dump(atlas_contents, f, indent=2)

        for i, frame in enumerate(frames):
            name = f"{stem}_{str(i).zfill(digits)}"
            imageset_dir = out_dir / f"{name}.imageset"
            imageset_dir.mkdir(exist_ok=True)

            png_name = f"{name}{scale_tag}.png"
            frame.save(imageset_dir / png_name, "PNG")

            # Build images array: only the target scale has a filename
            images = []
            for s in [1, 2, 3]:
                entry = {"idiom": "universal", "scale": f"{s}x"}
                if s == scale:
                    entry["filename"] = png_name
                images.append(entry)

            contents = {
                "images": images,
                "info": {"version": 1, "author": "xcode"},
            }
            with open(imageset_dir / "Contents.json", "w") as f:
                json.dump(contents, f, indent=2)

            print(f"\r[INFO] Saved {i+1}/{len(frames)}", end="")

        print()
        print(f"[OK]   {len(frames)} imagesets saved → {out_dir}/")
    else:
        # ── Pack into sprite sheet ─────────────────────────────────────────
        print(f"[INFO] Packing {len(frames)} frames into sprite sheet ({cols} columns)…")
        sheet, metadata = pack_spritesheet(frames, cols=cols)

        sheet_path = out_dir / f"{stem}_spritesheet.png"
        json_path = out_dir / f"{stem}_spritesheet.json"

        sheet.save(sheet_path, "PNG", optimize=False)
        print(f"[OK]   Sprite sheet saved → {sheet_path}")

        json_data = {
            "source": video_path.name,
            "fps": fps,
            "frame_step": step,
            "frame_count": len(frames),
            "cols": cols,
            "rows": math.ceil(len(frames) / cols),
            "cell_width": max(f.width for f in frames),
            "cell_height": max(f.height for f in frames),
            "sheet_width": sheet.width,
            "sheet_height": sheet.height,
            "frames": metadata,
        }

        with open(json_path, "w", encoding="utf-8") as fh:
            json.dump(json_data, fh, indent=2)
        print(f"[OK]   Metadata saved      → {json_path}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Convert a white-background video to a transparent PNG sprite sheet."
    )
    parser.add_argument("video", type=Path, help="Path to the input video file")
    parser.add_argument(
        "--out", "-o", type=Path, default=None,
        help="Output directory (default: same directory as video)"
    )
    parser.add_argument(
        "--threshold", "-t", type=int, default=20,
        help="White removal threshold 0–255 (default: 20). Increase if edges have white fringe."
    )
    parser.add_argument(
        "--cols", "-c", type=int, default=8,
        help="Number of columns in the sprite sheet (default: 8)"
    )
    parser.add_argument(
        "--step", "-s", type=int, default=1,
        help="Use every Nth frame (default: 1 = all frames). Use 2 to halve frame count."
    )
    parser.add_argument(
        "--frames", "-f", action="store_true",
        help="Export individual PNG frames instead of a sprite sheet (use for SpriteKit .spriteatlas)"
    )
    parser.add_argument(
        "--size", type=int, default=None, metavar="PT",
        help="Target display size in points (longest side). Combined with --scale to get pixel size. "
             "E.g. --size 180 --scale 2 → max 360px. No upscaling."
    )
    parser.add_argument(
        "--scale", type=int, default=2, choices=[1, 2, 3],
        help="Asset scale: 1, 2 (@2x), or 3 (@3x). Used with --size (default: 2)"
    )
    parser.add_argument(
        "--no-bg", action="store_true",
        help="Skip background removal — keep original colors (use for backgrounds without white BG)"
    )
    parser.add_argument(
        "--stabilize", action="store_true",
        help="Align each frame's alpha center-of-mass to the median position across all frames "
             "(fixes camera drift / jitter from AI-generated video)"
    )
    parser.add_argument(
        "--name", "-n", type=str, default=None,
        help="Frame name prefix (default: video filename stem). E.g. --name idle → idle_000, idle_001…"
    )

    args = parser.parse_args()

    video_path = args.video.resolve()
    if not video_path.exists():
        print(f"[ERROR] File not found: {video_path}", file=sys.stderr)
        sys.exit(1)

    out_dir = args.out.resolve() if args.out else video_path.parent

    process_video(
        video_path=video_path,
        out_dir=out_dir,
        threshold=args.threshold,
        cols=args.cols,
        step=args.step,
        frames_only=args.frames,
        max_pt=args.size,
        scale=args.scale,
        remove_bg=not args.no_bg,
        stabilize=args.stabilize,
        name=args.name,
    )


if __name__ == "__main__":
    main()
