#!/usr/bin/env python3
"""Explicit, one-time bootstrap of the editable plant motion master.

The build/preview pipeline MUST compile plants/scene.rml directly. This script
is an authoring recipe, not a build step; subsequent RML/Editor edits are master.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent / "camp-daily-states/plants/scene.rml"
MASTER = HERE / "plants/scene.rml"
NEXT_ID = 1000


def add(parent, tag, **attrs):
    global NEXT_ID
    attrs.setdefault("id", f"91:{NEXT_ID}")
    NEXT_ID += 1
    return ET.SubElement(parent, tag, {k: str(v) for k, v in attrs.items()})


def lerp(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def split(curve, t):
    a, b, c, d = curve
    ab, bc, cd = lerp(a, b, t), lerp(b, c, t), lerp(c, d, t)
    abc, bcd = lerp(ab, bc, t), lerp(bc, cd, t)
    mid = lerp(abc, bcd, t)
    return (a, ab, abc, mid), (mid, bcd, cd, d)


def point(vertex):
    return float(vertex.get("x", 0)), float(vertex.get("y", 0))


def handle(vertex, kind):
    x, y = point(vertex)
    angle = float(vertex.get(kind + "Rotation", 0))
    distance = float(vertex.get(kind + "Distance", 0))
    return x + math.cos(angle) * distance, y + math.sin(angle) * distance


def weights(p):
    # Four bind pivots: y=0,-64,-128,-192. Exact 255-byte total.
    h = max(0.0, min(3.0, -p[1] / 64))
    low = min(2, int(h))
    upper_weight = round((h - low) * 255)
    if upper_weight == 0:
        return 255, low + 1
    if upper_weight == 255:
        return 255, low + 2
    return (255 - upper_weight) | (upper_weight << 8), (low + 1) | ((low + 2) << 8)


def transform_matrix(node):
    r = float(node.get("rotation", 0))
    sx, sy = float(node.get("scaleX", 1)), float(node.get("scaleY", 1))
    return dict(xx=math.cos(r) * sx, xy=math.sin(r) * sx,
                yx=-math.sin(r) * sy, yy=math.cos(r) * sy,
                tx=float(node.get("x", 0)), ty=float(node.get("y", 0)))


def skin_stem(plant, bones):
    path = plant.find("Shape[@name='Daisy stem']/PointsPath")
    vertices = list(path)
    segments = []
    for index, vertex in enumerate(vertices):
        following = vertices[(index + 1) % len(vertices)]
        curve = (point(vertex), handle(vertex, "out"), handle(following, "in"), point(following))
        if index < 2:
            left, right = split(curve, 1 / 3)
            middle, end = split(right, 1 / 2)
            segments.extend((left, middle, end))
        else:
            segments.append(curve)
    # de Casteljau subdivision preserves the original silhouette exactly.
    for vertex in vertices:
        path.remove(vertex)
    for index, segment in enumerate(segments):
        p, outgoing = segment[0], segment[1]
        incoming = segments[index - 1][2]
        def polar(q):
            dx, dy = q[0] - p[0], q[1] - p[1]
            return math.atan2(dy, dx), math.hypot(dx, dy)
        ir, il = polar(incoming)
        ora, ol = polar(outgoing)
        vertex = add(path, "CubicDetachedVertex", x=p[0], y=p[1],
                     inRotation=ir, inDistance=il, outRotation=ora, outDistance=ol)
        pv, pi = weights(p)
        iv, ii = weights(incoming)
        ov, oi = weights(outgoing)
        add(vertex, "CubicWeight", values=pv, indices=pi,
            inValues=iv, inIndices=ii, outValues=ov, outIndices=oi)
    matrix = transform_matrix(plant)
    skin = add(path, "Skin", name=plant.get("name") + " stem skin", **matrix)
    for index, bone in enumerate(bones):
        # World bind = plant matrix * translate(0,-64*i) * rotate(-pi/2).
        add(skin, "Tendon", name=bone.get("name") + " bind", boneId=bone.get("id"),
            xx=-matrix["yx"], xy=-matrix["yy"], yx=matrix["xx"], yy=matrix["xy"],
            tx=matrix["tx"] - 64 * index * matrix["yx"],
            ty=matrix["ty"] - 64 * index * matrix["yy"])


def rotation_track(animation, element, base, amplitude, delay):
    keyed = add(animation, "KeyedObject", objectId=element.get("id"))
    prop = add(keyed, "KeyedProperty", property="rotation")
    # Intentional asymmetric breeze: load -> release -> weaker return -> settle.
    poses = [(0, 0), (24, 0), (88, 1), (144, -.30),
             (206, -.65), (250, .26), (296, -.08), (326, 0), (360, 0)]
    for index, (frame, factor) in enumerate(poses):
        frame = frame if frame in (0, 360) else min(359, frame + delay)
        key = add(prop, "KeyFrameDouble", frame=frame,
                  value=round(base + amplitude * factor, 9), interpolationType="cubic")
        # Each authored segment has zero endpoint velocity, including loop seam.
        # Release is brisker than wind loading; no sampled sine or per-frame bake.
        curve = (.24, 0, .52, 1) if index in (2, 4) else (.42, 0, .58, 1)
        add(key, "CubicEaseInterpolator", x1=curve[0], y1=curve[1], x2=curve[2], y2=curve[3])


def bootstrap(replace_master=False):
    if MASTER.exists() and not replace_master:
        raise SystemExit("Master already exists. Compile it directly; use --replace-master only to intentionally discard authoring edits.")
    tree = ET.parse(SOURCE)
    root = tree.getroot()
    artboard = root.find("Artboard")
    # Daily poses retain the existing art/state contract; remove generic rigid sway.
    for animation in artboard.findall("LinearAnimation"):
        animation.set("duration", "1")
        animation.set("loopValue", "oneShot")
        for keyed in animation:
            for prop in list(keyed):
                if prop.get("property") == "rotation":
                    keyed.remove(prop)
    breeze = add(artboard, "LinearAnimation", name="Breeze", fps=60, duration=360, loopValue="loop")
    rig_info = []
    plants = sorted((n for n in artboard.findall("Node") if n.get("name", "").startswith("Plant ")),
                    key=lambda n: int(n.get("name").split()[-1]))
    for plant_index, plant in enumerate(plants):
        prefix = plant.get("name")
        bone_root = add(plant, "RootBone", name=f"{prefix} Root", x=0, y=0, length=64, rotation=-math.pi / 2)
        bones = [bone_root]
        for segment_index in range(1, 4):
            bones.append(add(bones[-1], "Bone", name=f"{prefix} Stem {segment_index}",
                             length=64 if segment_index < 3 else 0, rotation=0))
        # Put hierarchy at the old flower position; the source stem stays above it.
        plant.remove(bone_root)
        plant.insert(0, bone_root)
        skin_stem(plant, bones)
        phase = [0, 5, 10, 2, 8][plant_index]
        strength = [1, .9, 1.08, .78, .88][plant_index]
        for joint, bone in enumerate(bones):
            rotation_track(breeze, bone, -math.pi / 2 if joint == 0 else 0,
                           [.012, .055, .085, .035][joint] * strength, phase + [0, 3, 7, 11][joint])
        for child in list(plant):
            if child.tag != "Node":
                continue
            old_y = float(child.get("y", 0))
            height = -old_y
            joint = min(3, int(height // 64))
            old_rotation = float(child.get("rotation", 0))
            child.set("x", str(height - 64 * joint))
            child.set("y", "0")
            child.set("rotation", str(math.pi / 2 + old_rotation))
            plant.remove(child)
            bones[joint].append(child)
            if child.get("name") == "Daisy":
                child.set("name", f"{prefix} Flower")
                rotation_track(breeze, child, math.pi / 2 + old_rotation,
                               -.10 * strength, phase + 17)
            else:
                child.set("name", f"{prefix} Leaf {int(height)}")
                handedness = float(child.get("scaleX", 1))
                rotation_track(breeze, child, math.pi / 2 + old_rotation,
                               .10 * strength * handedness, phase + 8 + joint * 3)
        rig_info.append({"plant": prefix, "root": dict(plant.attrib),
                         "bones": [bone.get("name") for bone in bones],
                         "stemVertices": 7, "phaseFrames": phase})
    machine = artboard.find("StateMachine")
    # Avoid a startup crossfade from full artwork into Morning when stage=1/2.
    daily = machine.find("StateMachineLayer")
    entry = daily.find("EntryState")
    for child in list(entry):
        entry.remove(child)
    any_state = daily.find("AnyState")
    import copy
    for transition in any_state:
        initial = copy.deepcopy(transition)
        initial.set("duration", "0")
        for node in initial.iter():
            node.attrib.pop("id", None)
        entry.append(initial)
        # These are appearance blends, not an authored grow/celebrate action.
        add(transition, "CubicEaseInterpolator", x1=.42, y1=0, x2=.58, y2=1)
    motion_layer = add(machine, "StateMachineLayer", name="Authored breeze")
    motion_state = add(motion_layer, "AnimationState", animationId=breeze.get("id"), x=200, y=100)
    motion_entry = add(motion_layer, "EntryState", x=0, y=100)
    add(motion_entry, "StateTransition", stateToId=motion_state.get("id"))
    add(motion_layer, "AnyState", x=0, y=-100)
    add(motion_layer, "ExitState", x=200, y=-100)
    MASTER.parent.mkdir(parents=True, exist_ok=True)
    ET.indent(tree, space="  ")
    tree.write(MASTER, encoding="unicode")
    (MASTER.parent / "rive.yaml").write_text("name: plants\nlogs:\n  file: build/rive.log\n  problems: build/problems.log\n")
    brief = {
        "status": "draft for owner review", "master": "plants/scene.rml",
        "sourceArtwork": str(SOURCE.relative_to(HERE.parent.parent.parent)),
        "artboard": "PlantStates", "stateMachine": "PlantStates", "viewModel": "PlantStates",
        "stage": {"0": "Morning", "1": "Growing", "2": "Full"},
        "poseFrames": 1, "motion": "Breeze", "fps": 60, "durationFrames": 360,
        "intent": "A soft directional breeze loads the stems, flowers lag, a weaker counter-sway settles into a quiet pause.",
        "sourceOfTruth": "Editable RML. author_plants.py is explicit bootstrap only, never a build dependency.",
        "rig": "Native vector Skin/Tendon/CubicWeight, four bones per plant; source silhouette subdivided exactly with de Casteljau.",
        "motionKeys": "Nine authored pose keys per rotation track, per-segment cubic interpolation; no sine sampling.",
        "layers": {"Daily state": "scale/opacity only", "Authored breeze": "bone/flower/leaf rotation only"},
        "anchor": "Plant container x/y and root bone x/y are never keyed; Grass does not move within a stage.",
        "stageTransition": "550ms cubic appearance blend. No claim of a custom growth action.",
        "reducedMotion": "Apply stage pose at 0 and Breeze at 0; do not autoplay the state machine.",
        "rigs": rig_info,
    }
    (HERE / "motion-brief.json").write_text(json.dumps(brief, indent=2, ensure_ascii=False) + "\n")
    print(f"Bootstrapped editable master: {MASTER}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bootstrap", action="store_true", help="Explicitly create the initial editable master")
    parser.add_argument("--replace-master", action="store_true", help="Intentionally discard existing master edits")
    args = parser.parse_args()
    if not args.bootstrap:
        parser.error("Authoring only: --bootstrap is required. Normal builds compile plants/scene.rml directly.")
    bootstrap(args.replace_master)
