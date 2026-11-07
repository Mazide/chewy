#!/usr/bin/env python3
"""Compile the saved vector rig in isolation; never regenerate the authored master."""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
PROJECT = HERE / "chewy"
SOURCE_ART = HERE.parent / "hero-wardrobe/references/hero-from-editor.rml"
SAMPLE_FRAMES = [0, 36, 38, 39, 40, 41, 42, 43, 44, 45, 48, 60, 72,
                 84, 87, 90, 91, 92, 93, 94, 95, 96, 102, 120]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def command(args):
    result = subprocess.run([str(arg) for arg in args], text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(f"Command failed: {' '.join(map(str, args))}\n{result.stdout}\n{result.stderr}")
    return result.stdout


def json_command(args):
    result = json.loads(command(args))
    if result.get("success") is False:
        raise RuntimeError(json.dumps(result))
    return result


def inputs():
    paths = [PROJECT / "scene.rml", PROJECT / "rive.yaml", SOURCE_ART,
             HERE / "evidence/reference-poses.json", HERE / "evidence/retarget-fit.json"]
    return {os.path.relpath(path, HERE): digest(path) for path in paths}


def inspect_structure():
    root = ET.parse(PROJECT / "scene.rml").getroot()
    counts = Counter(node.tag for node in root.iter())
    # No external dependencies or embedded image assets can enter this project.
    forbidden = [node.tag for node in root.iter()
                 if node.tag in {"Image", "ImageAsset", "FileAssetContents"}
                 or node.tag.endswith("Asset") or node.get("file")]
    assert not forbidden, f"Unexpected asset dependency: {forbidden}"
    board = root.find("Artboard")
    assert board is not None and board.get("name") == "ChewyReference"
    assert (float(board.get("width")), float(board.get("height"))) == (506, 1060)
    animations = {node.get("name"): node for node in board.findall("LinearAnimation")}
    assert set(animations) == {"Rest", "ReferenceGesture"}
    for name, duration in [("Rest", 1), ("ReferenceGesture", 121)]:
        animation = animations[name]
        assert animation.get("fps") == "24" and animation.get("duration") == str(duration)
        assert animation.get("loopValue") == "oneShot"
    machines = board.findall("StateMachine")
    assert len(machines) == 1 and machines[0].get("name") == "ChewyReference"
    assert board.get("defaultStateMachineId") == machines[0].get("id")
    vm = root.find("ViewModel[@name='ChewyReference']")
    assert vm is not None and board.get("viewModelId") == vm.get("id")
    assert {n.get("name") for n in vm.findall("ViewModelPropertyNumber")} == {"action", "lookX", "lookY"}
    bones = [node for node in board.iter() if node.tag in {"RootBone", "Bone"}]
    assert counts["Bone"] >= 2 and counts["RootBone"] >= 2
    assert counts["Shape"] >= 26 and counts["PointsPath"] > 0
    keyed_ids = {node.get("objectId") for node in animations["ReferenceGesture"].findall("KeyedObject")}
    assert sum(bone.get("id") in keyed_ids for bone in bones) >= 4, "Arm bones must have native keys"
    for weight in board.iter("CubicWeight"):
        for attr in ["values", "inValues", "outValues"]:
            packed = int(weight.get(attr, "0"))
            assert sum((packed >> (8 * index)) & 255 for index in range(4)) == 255
    return {"counts": dict(counts), "image_assets": 0, "external_asset_dependencies": 0,
            "native_arm_bones": [{"name": bone.get("name"), "id": bone.get("id")} for bone in bones],
            "native_bone_keys": True, "one_shot": True, "manual_reference_annotation": True}


def run(rive):
    before = inputs()
    structure = inspect_structure()
    cli_version = command([rive, "--version"]).strip()
    exports = HERE / "exports"
    exports.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="chewy-vector-build-") as directory:
        temporary = Path(directory)
        staged = temporary / "chewy"
        staged.mkdir()
        for name in ["scene.rml", "rive.yaml"]:
            shutil.copy2(PROJECT / name, staged / name)
        verify = json_command([rive, staged, "--verify", "--format=json"])
        inspection = json_command([rive, "inspect", staged, "--json"])
        assert not inspection.get("problems"), inspection.get("problems")
        build = json_command([rive, staged, "--once", "--format=json"])
        artifact = staged / "build/chewy-vector.riv"
        binary = artifact.read_bytes()
        captures = temporary / "captures"
        captures.mkdir()
        samples = []
        pixels = {}
        for frame in SAMPLE_FRAMES:
            output = captures / f"frame-{frame:03d}.png"
            # CLI state-machine entry consumes one 60 Hz tick. Sample the
            # interior of each source frame, not a float-sensitive boundary.
            ticks = math.floor((frame + .5) * 60 / 24) + 1
            command([rive, staged, "--data=action=1", f"--advance={ticks}", f"--screenshot={output}"])
            array = np.asarray(Image.open(output).convert("RGBA"))
            assert array.shape == (1060, 506, 4)
            pixels[frame] = array
            background = array[0, 0, :3].astype(int)
            foreground = np.any(np.abs(array[:, :, :3].astype(int) - background) > 4, axis=2)
            ys, xs = np.nonzero(foreground)
            assert len(xs) > 1000, f"Empty vector pose {frame}"
            bounds = [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]
            margin = min(bounds[0], bounds[1], 505 - bounds[2], 1059 - bounds[3])
            assert margin >= 1, f"Clipped vector pose {frame}: {bounds}"
            feet_changed = int(np.any(array[850:] != pixels[0][850:], axis=2).sum())
            assert feet_changed == 0, f"Planted feet changed in frame {frame}"
            samples.append({"reference_frame": frame, "cli_advance_60hz_ticks": ticks,
                            "foreground_bounds": bounds, "minimum_margin": margin,
                            "feet_changed_pixels": feet_changed})
        assert len({hashlib.sha256(value.tobytes()).hexdigest() for value in pixels.values()}) >= 5
        held = []
        for seconds in [6, 10]:
            output = captures / f"held-{seconds}s.png"
            command([rive, staged, "--data=action=1", f"--advance={seconds}s", f"--screenshot={output}"])
            array = np.asarray(Image.open(output).convert("RGBA"))
            assert np.array_equal(array, pixels[120]), f"Final native pose changed after {seconds}s"
            held.append(seconds)
        assert before == inputs(), "Source changed during build; export cancelled"
        report = {"passed": True, "scope": "Vector structure, native CLI build, planted feet, bounds and final hold; not artistic acceptance.",
                  "cli_version": cli_version, "verify": verify, "build": build,
                  "inspect_problems": inspection.get("problems", []), "structure": structure,
                  "source_hashes": before, "source_unchanged": True, "riv_bytes": len(binary),
                  "render_samples": samples, "native_final_hold_seconds": held,
                  "raster_reference_pixel_equality_tested": False,
                  "artistic_approval": False, "apple_runtime_tested": False,
                  "editor_round_trip_tested": False,
                  "limitations": ["Reference joint annotations are manual and approximate.",
                                  "Draft hand/watch and limb transitions require owner review.",
                                  "No universal video-to-rig extractor or wardrobe compatibility certification."]}
        temporary_riv = exports / ".chewy-vector.riv.pending"
        temporary_riv.write_bytes(binary)
        temporary_riv.replace(exports / "chewy-vector.riv")
        shutil.copytree(captures, exports / "native-captures", dirs_exist_ok=True)
        (exports / "native-qa.json").write_text(json.dumps(report, indent=2) + "\n")
        manifest = {"schema_version": 1, "rive_file": "chewy-vector.riv", "signed": False,
                    "artboard": "ChewyReference", "state_machine": "ChewyReference", "view_model": "ChewyReference",
                    "property": "action", "rest_value": 0, "play_value": 1,
                    "animation": "ReferenceGesture", "rest_animation": "Rest",
                    "fps": 24, "frame_count": 121, "width": 506, "height": 1060,
                    "reference_width": 253, "reference_height": 530,
                    "duration": 121 / 24, "duration_seconds": 121 / 24, "loop": False,
                    "frames": [f"../reference/frame-{i:03d}.png" for i in range(121)],
                    "overrides": {"lookX": {"min": -12, "max": 12, "default": 0},
                                  "lookY": {"min": -8, "max": 8, "default": 0}},
                    "qa_file": "native-qa.json", "kind": "vector_rig_from_manual_video_reference",
                    "embedded_images": 0, "riv_bytes": len(binary),
                    "riv_sha256": hashlib.sha256(binary).hexdigest(),
                    "source_rml_sha256": before["chewy/scene.rml"],
                    "reference_annotation_sha256": before["evidence/reference-poses.json"],
                    "replay": "Set action=0, advance one state-machine tick, then action=1; final pose held.",
                    "editor_source": "../chewy/scene.rml (local RML source; .riv is the runtime export)"}
        pending = exports / ".manifest.json.pending"
        pending.write_text(json.dumps(manifest, indent=2) + "\n")
        pending.replace(exports / "manifest.json")
        print(json.dumps({"passed": True, "riv_bytes": len(binary), "raster_assets": 0,
                          "native_samples": len(samples), "source_unchanged": True,
                          "manifest": str(exports / "manifest.json")}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rive", type=Path,
                        default=Path(os.environ.get("RIVE_CLI") or shutil.which("rive") or "/tmp/chewy-rive-cli/bin/rive"))
    run(parser.parse_args().rive)
