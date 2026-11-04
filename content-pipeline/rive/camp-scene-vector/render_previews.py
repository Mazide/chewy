#!/usr/bin/env python3
"""Render actual Rive timelines, verify loops, and export portable review media."""
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

from build_scene import ASSETS, ROOT, REPO, WIDTH, HEIGHT, FPS, DURATION

THREAD = threading.local()
PAPER, GREEN, INK = "#F1F3E9", "#E2E8D6", "#263A2E"


def run(command):
    result = subprocess.run(command, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(f"Failed: {command}\n{result.stdout}\n{result.stderr}")
    return result.stdout


def font(size):
    filename = run(["fc-match", "-f", "%{file}", "NotoSans"]).strip()
    return ImageFont.truetype(filename, size)


def compare(a, b, threshold=3):
    delta = np.abs(np.asarray(a.convert("RGB"), dtype=np.int16)-np.asarray(b.convert("RGB"), dtype=np.int16))
    return {"changed_pixels": int((delta.max(axis=2)>threshold).sum()), "mean_channel_delta": float(delta.mean()), "max_channel_delta": int(delta.max())}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rive", default=shutil.which("rive") or "/tmp/chewy-rive-cli/bin/rive")
    parser.add_argument("--fps", type=int, default=30, choices=(15,30))
    parser.add_argument("--workers", type=int, default=3, choices=(1,2,3))
    parser.add_argument("--stills", action="store_true")
    args = parser.parse_args()
    exports = ROOT / "exports"
    exports.mkdir(exist_ok=True)
    run([args.rive, str(ROOT), "--verify"])
    inspect = run([args.rive, "inspect", str(ROOT), "--summary"])
    (exports / "inspect.txt").write_text(inspect)
    run([args.rive, str(ROOT), "--once"])
    shutil.copyfile(ROOT / "build/camp-scene-vector.riv", exports / "camp-scene-vector.riv")
    tree = ET.parse(ROOT / "scene.rml")
    assert not list(tree.iter("ImageAsset")), "Unexpected raster asset"
    assert not list(tree.iter("ScriptAsset")), "Unexpected script"
    authored_deltas = []
    for prop in tree.iter("KeyedProperty"):
        keys = list(prop)
        if len(keys)>1:
            authored_deltas.append(abs(float(keys[0].get("value"))-float(keys[-1].get("value"))))
    assert max(authored_deltas, default=0) < 1e-5
    manifest = json.loads((ROOT / "manifest.json").read_text())
    duration = DURATION/FPS
    frame_count = round(duration*args.fps)
    report = {"renderer": "Rive CLI 1.8.0", "loop_seconds": duration, "frames": frame_count,
              "preview_fps": args.fps, "raster_assets": 0, "scripts": 0,
              "authored_loop_max_key_delta": max(authored_deltas), "native_tested": False,
              "owner_approved": False, "components": {}}
    with tempfile.TemporaryDirectory(prefix="chewy-vector-scene-") as tempdir:
        temporary = Path(tempdir)

        def initialize():
            THREAD.project = temporary / f"worker-{threading.get_ident()}"
            THREAD.project.mkdir()
            shutil.copyfile(ROOT / "scene.rml", THREAD.project / "scene.rml")
            shutil.copyfile(ROOT / "rive.yaml", THREAD.project / "rive.yaml")

        def capture(index):
            target = temporary/f"scene-{index:04d}.png"
            ticks = round(index*60/args.fps)+1
            run([args.rive, str(THREAD.project), "--artboard=CampScene", f"--advance={ticks}",
                 "--viewport=585x1266", "--fit=contain", f"--screenshot={target}"])
            return target

        indices = [0,frame_count//4,frame_count//2,3*frame_count//4,frame_count] if args.stills else range(frame_count+1)
        with ThreadPoolExecutor(max_workers=args.workers, initializer=initialize) as pool:
            captured = {}
            for number, (index, file) in enumerate(zip(indices,pool.map(capture,indices)),1):
                captured[index] = file
                if number%30 == 0 or number == len(indices):
                    print(f"Scene: rendered {number}/{len(indices)}", flush=True)
        first = Image.open(captured[0])
        report["scene_loop"] = compare(first, Image.open(captured[frame_count]))
        report["scene_motion"] = compare(first, Image.open(captured[frame_count//4]))
        assert report["scene_motion"]["changed_pixels"] > 50, "Scene did not animate"
        assert report["scene_loop"]["mean_channel_delta"] < .08, "Scene loop seam differs"
        first.save(exports/"poster.png")
        for i in (0,frame_count//4,frame_count//2,3*frame_count//4):
            shutil.copyfile(captured[i], exports/f"frame-{i:03d}.png")

        # Object renderboards include a review-only solid backdrop, never a
        # bitmap or backdrop in the exported transparent component artboards.
        fixture = temporary/"items"
        fixture.mkdir()
        item_tree = ET.parse(ROOT/"scene.rml")
        for board in item_tree.findall("Artboard"):
            if board.get("name")=="CampScene":
                continue
            shape = ET.SubElement(board,"Shape",x=str(float(board.get("width"))/2),y=str(float(board.get("height"))/2))
            ET.SubElement(shape,"Rectangle",width=board.get("width"),height=board.get("height"))
            fill = ET.SubElement(shape,"Fill")
            ET.SubElement(fill,"SolidColor",colorValue="FFE2E8D6")
        item_tree.write(fixture/"scene.rml",encoding="unicode")
        shutil.copyfile(ROOT/"rive.yaml",fixture/"rive.yaml")
        sheet = Image.new("RGB",(1500,960),PAPER)
        draw = ImageDraw.Draw(sheet)
        draw.text((32,22),"Базовые ассеты и редактируемый вектор Rive",font=font(31),fill=INK)
        draw.text((32,70),"Верхний ряд — исходники. Нижний — реальный рендер Rive. Рисунок упрощён вручную.",font=font(19),fill=INK)
        labels = {"Tent":"Палатка", "Hero":"Герой", "Dog":"Пёс", "Campfire":"Костёр", "Kettle":"Чайник"}
        source_keys = {"Tent":"tent", "Hero":"hero", "Dog":"dog", "Campfire":"fire", "Kettle":"kettle"}
        for column,(name,size,bounds,frame,builder) in enumerate(ASSETS):
            pictures = []
            for ticks in (1,61,361):
                target = temporary/f"{name}-{ticks}.png"
                run([args.rive,str(fixture),f"--artboard={name}",f"--advance={ticks}",f"--viewport={size[0]}x{size[1]}","--fit=contain",f"--screenshot={target}"])
                pictures.append(Image.open(target).convert("RGB"))
            motion = compare(pictures[0],pictures[1])
            seam = compare(pictures[0],pictures[2])
            assert motion["changed_pixels"] > 10, f"{name} did not animate"
            assert seam["mean_channel_delta"] < .08, f"{name} loop seam differs"
            # Lower grounded portions of dog/hero/fire must not move.
            stable = {"Hero": (0,700,size[0],size[1]), "Dog":(0,1080,size[0],size[1]), "Campfire":(0,900,size[0],size[1])}
            static_report = None
            if name in stable:
                static_report = compare(pictures[0].crop(stable[name]),pictures[1].crop(stable[name]))
                assert static_report["changed_pixels"] == 0, f"{name} grounded base moved"
            report["components"][name] = {"motion":motion,"loop":seam,"grounded_region":static_report}
            source_path = REPO/manifest["sources"][source_keys[name]]["path"]
            source = Image.open(source_path).convert("RGBA")
            original = Image.new("RGBA",source.size,GREEN)
            original.alpha_composite(source)
            x,y,w,h = bounds
            crop = (max(0,x-30),max(0,y-30),min(size[0],x+w+30),min(size[1],y+h+30))
            for row,picture in enumerate((original,pictures[0])):
                tile = ImageOps.contain(picture.crop(crop).convert("RGB"),(266,328),Image.Resampling.LANCZOS)
                left,top = column*300+16,142+row*390
                draw.rounded_rectangle((left,top,left+268,top+340),radius=16,fill=GREEN)
                sheet.paste(tile,(left+(268-tile.width)//2,top+(340-tile.height)//2))
            draw.text((column*300+150,900),labels[name],anchor="mm",font=font(23),fill=INK)
        sheet.save(exports/"comparison.png")
        report["riv_bytes"]=(exports/"camp-scene-vector.riv").stat().st_size
        (exports/"qa.json").write_text(json.dumps(report,indent=2)+"\n")
        if not args.stills:
            run(["ffmpeg","-hide_banner","-loglevel","error","-y","-framerate",str(args.fps),"-i",str(temporary/"scene-%04d.png"),"-frames:v",str(frame_count),"-vf","scale=584:1266","-c:v","libx264","-pix_fmt","yuv420p","-crf","17","-movflags","+faststart",str(exports/"scene.mp4")])
            run(["ffmpeg","-hide_banner","-loglevel","error","-y","-framerate",str(args.fps),"-i",str(temporary/"scene-%04d.png"),"-t",str(duration),"-vf","fps=20,scale=390:844","-c:v","libwebp_anim","-quality","86","-loop","0",str(exports/"scene.webp")])
        print(json.dumps(report,indent=2),flush=True)


if __name__=="__main__":
    main()
