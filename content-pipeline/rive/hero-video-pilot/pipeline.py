#!/usr/bin/env python3
"""Build the saved raster-frame Rive master in isolation and verify frame fidelity.

No source regeneration, signing, cloud upload, vectorization, retiming, or
background removal. The resulting .riv contains all 121 prepared PNG assets.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
PROJECT = HERE / "chewy"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def command(args):
    result = subprocess.run([str(x) for x in args], text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(f"Command failed: {' '.join(map(str, args))}\n{result.stdout}\n{result.stderr}")
    return result.stdout


def json_command(args):
    return json.loads(command(args))


def source_snapshot():
    files = [PROJECT / "scene.rml", PROJECT / "rive.yaml", HERE / "source-manifest.json"]
    files.extend(sorted((PROJECT / "assets").glob("*.png")))
    return {str(p.relative_to(HERE)): digest(p) for p in files}


def validate_structure():
    root = ET.parse(PROJECT / "scene.rml").getroot()
    board = root.find("Artboard")
    assert board.get("name") == "ChewyVideo"
    assert (int(board.get("width")), int(board.get("height"))) == (253, 530)
    solo = board.find("Solo[@name='Recorded frames']")
    images = list(solo)
    assets = root.findall("ImageAsset")
    assert len(images) == len(assets) == 121
    expected_images = [f"93:{100+i}" for i in range(121)]
    assert [image.get("id") for image in images] == expected_images
    assert solo.get("activeComponentId") == expected_images[0]
    for i, (image, asset) in enumerate(zip(images, assets)):
        assert image.tag == "Image" and image.get("assetId") == asset.get("id")
        assert image.get("originX") == image.get("originY") == image.get("x") == image.get("y") == "0"
        assert asset.get("file") == f"assets/frame-{i:03d}.png"
        assert asset.get("exportTypeValue") == "embedded"
        with Image.open(PROJECT / asset.get("file")) as im:
            assert im.size == (253, 530) and im.mode == "RGBA"
    animations = {n.get("name"): n for n in board.findall("LinearAnimation")}
    for name, count in [("Rest", 1), ("RecordedGesture", 121)]:
        anim = animations[name]
        assert anim.get("fps") == "24" and anim.get("duration") == str(count) and anim.get("loopValue") == "oneShot"
        obj = anim.find("KeyedObject")
        assert obj.get("objectId") == solo.get("id")
        prop = obj.find("KeyedProperty")
        assert prop.get("propertyKey") == "296"
        keys = list(prop)
        assert len(keys) == count
        for i, key in enumerate(keys):
            assert key.tag == "KeyFrameId" and key.get("frame") == str(i)
            assert key.get("value") == expected_images[i] and key.get("interpolationType") == "hold"
    assert all(t.get("duration") == "0" for t in board.findall(".//StateTransition"))
    assert all(s.get("reset") == "true" for s in board.findall(".//AnimationState"))
    return {"image_assets": 121, "solo_images": 121, "source_frame_order_exact": True,
            "discrete_hold_keys": True, "crossfade": False, "recorded_one_shot": True,
            "render_dimensions": [253, 530]}


def run(rive, skip_captures=False):
    before = source_snapshot()
    structure = validate_structure()
    exports = HERE / "exports"
    exports.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="chewy-video-build-") as tempdir:
        temp = Path(tempdir)
        staged = temp / "chewy"
        shutil.copytree(PROJECT, staged, ignore=shutil.ignore_patterns("build", ".DS_Store"))
        verify = json_command([rive, staged, "--verify", "--format=json"])
        inspect = json_command([rive, "inspect", staged, "--json"])
        assert not inspect.get("problems"), inspect.get("problems")
        build = json_command([rive, staged, "--once", "--format=json"])
        artifact = staged / "build/chewy-video.riv"
        binary = artifact.read_bytes()
        frames = [PROJECT / f"assets/frame-{i:03d}.png" for i in range(121)]
        embedded_exact = all(frame.read_bytes() in binary for frame in frames)
        assert embedded_exact, "Some source PNG bytes are not embedded in exported .riv"
        samples = []
        capture_dir = temp / "captures"
        capture_dir.mkdir()
        if not skip_captures:
            for index in [0, 24, 48, 72, 96, 120]:
                output = capture_dir / f"frame-{index:03d}.png"
                # A state-machine entry advances first at t=0. Choose the
                # interior of a video frame, away from float/time boundaries.
                advance = math.floor((index + .5) * 60 / 24) + 1
                command([rive, staged, f"--screenshot={output}", "--data=action=1", f"--advance={advance}"])
                with Image.open(output) as loaded:
                    actual = loaded.convert("RGBA")
                with Image.open(frames[index]) as loaded:
                    source = loaded.convert("RGBA")
                assert source.getpixel((0, 0))[3] == 0, "Proof assumes the transparent source corner"
                background = actual.getpixel((0, 0))
                expected = Image.alpha_composite(Image.new("RGBA", source.size, background), source)
                difference = np.abs(np.asarray(actual).astype(int) - np.asarray(expected).astype(int))
                metrics = {"frame": index, "advance60fps_frames": advance,
                           "max_channel_difference": int(difference.max()),
                           "mean_absolute_channel_difference": float(difference.mean()),
                           "pixels_above_5": int(np.any(difference > 5, axis=2).sum())}
                assert metrics["max_channel_difference"] <= 5 and metrics["mean_absolute_channel_difference"] < 1, metrics
                samples.append(metrics)
        assert before == source_snapshot(), "Authored master/assets changed during build; export cancelled"
        report = {"scope": "Native Rive structure, exact embedded PNG bytes and selected CLI rendered frame fidelity.",
                  "verify": verify, "build": build, "inspect_problems": inspect.get("problems"),
                  "structure": structure, "source_hashes": before, "source_unchanged": True,
                  "all_png_bytes_embedded_exactly": embedded_exact,
                  "prepared_png_bytes": sum(p.stat().st_size for p in frames),
                  "riv_bytes": len(binary), "decoded_rgba_pixel_bytes": 121 * 253 * 530 * 4,
                  "memory_note": "Exact arithmetic sum of prepared RGBA pixels, not measured runtime/GPU residency; other allocations may add overhead.",
                  "render_samples": samples, "capture_checks_skipped": skip_captures,
                  "limitations": ["Raster flipbook: no editable vector rig or new poses.",
                                  "Source wobble, transparency fringes, and non-looping endpoints are preserved.",
                                  "Mobile memory/performance and Apple runtime remain unmeasured."]}
        # Copy artifact only after source/asset invariants and rendering pass.
        staging_riv = exports / ".chewy-video.riv.pending"
        shutil.copyfile(artifact, staging_riv)
        staging_riv.replace(exports / "chewy-video.riv")
        (exports / "native-qa.json").write_text(json.dumps(report, indent=2) + "\n")
        shutil.copyfile(HERE / "source-manifest.json", exports / "source-manifest.json")
        if not skip_captures:
            shutil.copytree(capture_dir, exports / "native-captures", dirs_exist_ok=True)
        manifest = {"schema_version": 1, "rive_file": "chewy-video.riv", "signed": False,
                    "artboard": "ChewyVideo", "state_machine": "ChewyVideo", "view_model": "ChewyVideo",
                    "property": "action", "rest_value": 0, "play_value": 1,
                    "animation": "RecordedGesture", "rest_animation": "Rest",
                    "fps": 24, "frame_count": 121, "width": 253, "height": 530,
                    "duration": 121 / 24, "duration_seconds": 121 / 24, "loop": False,
                    "frames": [f"../reference/frame-{i:03d}.png" for i in range(121)],
                    "source_manifest": "source-manifest.json", "qa_file": "native-qa.json",
                    "riv_sha256": hashlib.sha256(binary).hexdigest(), "source_rml_sha256": before["chewy/scene.rml"],
                    "riv_bytes": len(binary), "decoded_rgba_pixel_bytes": 121 * 253 * 530 * 4,
                    "replay": "Set action=0, advance one frame, set action=1; final image is held."}
        temporary_manifest = exports / ".manifest.json.pending"
        temporary_manifest.write_text(json.dumps(manifest, indent=2) + "\n")
        temporary_manifest.replace(exports / "manifest.json")
        print(json.dumps({"success": True, "manifest": str(exports / "manifest.json"),
                          "riv_bytes": len(binary), "frame_count": 121,
                          "embedded_exactly": embedded_exact, "source_unchanged": True,
                          "native_render_checks": len(samples)}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rive", type=Path, default=Path("/tmp/chewy-rive-cli/bin/rive"))
    parser.add_argument("--skip-captures", action="store_true", help="Build + structure only; mark rendered checks skipped")
    args = parser.parse_args()
    run(args.rive, args.skip_captures)
