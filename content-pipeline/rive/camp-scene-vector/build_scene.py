#!/usr/bin/env python3
"""Assemble a script-free vector camp from five independently animated rigs."""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

from vector_utils import el
from tent_art import build_tent
from dog_art import build_dog
from environment_art import build_background, build_kettle
from editable_hero import load_editable_hero

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
EDITABLE_HERO = ROOT.parent / "hero-editable"
FPS, DURATION = 60, 360
WIDTH, HEIGHT = 390, 844

# Visible source bounds and screen frame: all placement changes live here.
ASSETS = [
    ("Tent", (1563,1006), (94,171,1395,683), (-18,310,272,133.2), build_tent),
    ("Hero", (506,1060), (37,36,450,981), (159,372,104,226.72), None),
    ("Dog", (1312,1199), (294,48,781,1100), (281,488,76,107.04), build_dog),
    ("Campfire", (1312,1199), (279,95,756,1010), (71,557,77,102.87), None),
    ("Kettle", (1312,1199), (251,141,809,917), (167,622,38,43.07), build_kettle),
]


def add_machine(board, ordinal, name, tracks):
    base = 100 + ordinal * 20
    machine_id, anim_id = f"1:{base}", f"1:{base+1}"
    board.set("defaultStateMachineId", machine_id)
    machine = ET.SubElement(board, "StateMachine", id=machine_id, name=name)
    layer = ET.SubElement(machine, "StateMachineLayer", name="Ambient motion")
    layer.extend([el("AnyState", x=0, y=-120), el("ExitState", x=240, y=-120)])
    entry = ET.SubElement(layer, "EntryState", x="0", y="120")
    entry.append(el("StateTransition", stateToId=f"1:{base+2}"))
    layer.append(el("AnimationState", id=f"1:{base+2}", x=240, y=120, animationId=anim_id))
    animation = ET.SubElement(board, "LinearAnimation", id=anim_id, name=f"{name} loop", fps=str(FPS), duration=str(DURATION), loopValue="loop")
    objects = {}
    for track in tracks:
        if track["id"] not in objects:
            objects[track["id"]] = ET.SubElement(animation, "KeyedObject", objectId=track["id"])
        prop = ET.SubElement(objects[track["id"]], "KeyedProperty", property=track["property"])
        assert track["keys"][0][0] == 0 and track["keys"][-1][0] == DURATION, track
        assert abs(track["keys"][0][1]-track["keys"][-1][1]) < 1e-5, track
        for frame, value in track["keys"]:
            prop.append(el("KeyFrameDouble", frame=frame, value=value, interpolationType="linear"))
    return machine_id, animation


def fire_art():
    source = ROOT.parent / "campfire-base"
    sys.path.insert(0, str(source))
    spec = importlib.util.spec_from_file_location("fire_motion", source / "generate_scene.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    root = el("Rive", version=1, kind="fragment")
    scene = ET.SubElement(root, "Artboard", id="1:1", name="CampScene", width=WIDTH, height=HEIGHT, x=0, y=0)
    components, placements, records = [], [], []
    for index, (name, size, bounds, frame, builder) in enumerate(ASSETS, 1):
        if name == "Hero":
            # This is now an authored document. Never regenerate over manual
            # edits: remap a copy for composition and leave its bytes untouched.
            board = load_editable_hero(EDITABLE_HERO / "scene.rml", EDITABLE_HERO / "namespace-map.json")
            board.set("isComponent", "true")
            board.set("x", str(500+(index-1)*1700))
            board.set("y", "0")
            board_id = board.get("id")
            machine_id = board.get("defaultStateMachineId")
        else:
            board_id = f"1:{10+index}"
            board = el("Artboard", id=board_id, name=name, width=size[0], height=size[1], isComponent="true", x=500+(index-1)*1700, y=0)
            if name == "Campfire":
                fire = fire_art()
                layers, flames = fire.build_art()
                tracks = []
            else:
                layers, tracks = builder()
            board.extend(reversed(layers))
            machine_id, animation = add_machine(board, index, name, tracks)
            if name == "Campfire":
                for flame_index, flame in enumerate(flames):
                    for vertex in flame["vertices"]:
                        fire.keyed_properties(animation, vertex, flame_index)
        scale = frame[2]/bounds[2]
        placement = el("NestedArtboard", name=name, artboardId=board_id,
            x=round(frame[0]-bounds[0]*scale,6), y=round(frame[1]-bounds[1]*scale,6), scaleX=scale, scaleY=scale)
        placement.append(el("NestedStateMachine", name=f"{name} motion", animationId=machine_id))
        placements.append(placement)
        components.extend([board, el("ComponentAsset", name=name, artboardId=board_id)])
        records.append({"name": name, "artboard": name, "state_machine": name, "source_size": size, "source_bounds": bounds, "scene_frame": frame})
    scene.extend(reversed(placements))
    background = el("Node", name="Forest clearing", scaleX=WIDTH/853, scaleY=HEIGHT/1844)
    background.extend(reversed(build_background()))
    scene.append(background)
    add_machine(scene, 0, "CampScene", [])
    root.extend(components)
    for ordinal, board in enumerate(root.findall("Artboard")):
        if board.get("styleId"):
            continue
        style_id = f"1:{500+ordinal}"
        board.set("styleId", style_id)
        board.append(el("LayoutComponentStyle", id=style_id, name=f"{board.get('name')} style"))
    # Give generated objects IDs before CLI write-back. The editable Hero
    # already carries its preserved source identities in remapped namespaces.
    used = {node.get("id") for node in root.iter() if node.get("id")}
    number = 1
    for node in root.iter():
        node.attrib.update({key: str(value) for key, value in node.attrib.items()})
        if node is root or node.get("id"):
            continue
        while f"9:{number}" in used:
            number += 1
        node.set("id", f"9:{number}")
        used.add(f"9:{number}")
        number += 1
    assert not list(root.iter("ImageAsset")) and not list(root.iter("ScriptAsset"))
    ET.indent(root, space="  ")
    (ROOT / "scene.rml").write_text(ET.tostring(root, encoding="unicode") + "\n")
    sources = {
        "background": "prototype/public/assets/sandbox/camp-v3-flat/background.png",
        "tent": "prototype/public/assets/sandbox/camp-v3-flat/tent.png",
        "hero": "chewy/chewy/Assets.xcassets/hero.spriteatlas/idle_000.imageset/idle_000@2x.png",
        "dog": "prototype/public/assets/sandbox/camp-v3-flat/dog.png",
        "fire": "prototype/public/assets/sandbox/camp-v3-flat/fire.png",
        "kettle": "prototype/public/assets/sandbox/camp-v3-flat/kettle.png",
    }
    manifest = {"date": "2026-10-31", "status": "draft-for-owner-review", "format": "pure-vector-rive", "artboard": "CampScene", "state_machine": "CampScene", "size": [WIDTH,HEIGHT], "loop_seconds": DURATION/FPS, "assets": records,
        "sources": {key: {"path": value, "sha256": hashlib.sha256((REPO/value).read_bytes()).hexdigest()} for key,value in sources.items()},
        "raster_assets": 0, "scripts": 0, "native_tested": False, "owner_approved": False,
        "editable_hero": {"path": str((EDITABLE_HERO / "scene.rml").relative_to(REPO)), "sha256": hashlib.sha256((EDITABLE_HERO / "scene.rml").read_bytes()).hexdigest()}}
    (ROOT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+"\n")
    print(f"Assembled {len(ASSETS)} vector rigs + background; {WIDTH}×{HEIGHT}; {DURATION/FPS:g}s loops.")


if __name__ == "__main__":
    main()
