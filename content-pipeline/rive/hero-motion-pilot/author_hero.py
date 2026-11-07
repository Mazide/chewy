#!/usr/bin/env python3
"""Explicit bootstrap for a Chewy greeting study; never invoked by the build.

The existing hand-edited artwork is copied, never changed at source. The saved
chewy/scene.rml is the editable master after this one-time authoring operation.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent / "hero-wardrobe/references/hero-from-editor.rml"
SERIAL = 1000


def add(parent, tag, **attrs):
    global SERIAL
    attrs.setdefault("id", f"92:{SERIAL}")
    SERIAL += 1
    return ET.SubElement(parent, tag, {k: str(v) for k, v in attrs.items()})


def point(v):
    return float(v.get("x", 0)), float(v.get("y", 0))


def handle(v, kind):
    p = point(v)
    a, d = float(v.get(kind + "Rotation", 0)), float(v.get(kind + "Distance", 0))
    return p[0] + math.cos(a) * d, p[1] + math.sin(a) * d


def mix(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def split(curve, t):
    a, b, c, d = curve
    ab, bc, cd = mix(a, b, t), mix(b, c, t), mix(c, d, t)
    abc, bcd = mix(ab, bc, t), mix(bc, cd, t)
    m = mix(abc, bcd, t)
    return (a, ab, abc, m), (m, bcd, cd, d)


def packed(influences):
    raw = [round(x * 255) for x in influences]
    raw[max(range(len(raw)), key=raw.__getitem__)] += 255 - sum(raw)
    active = [(i + 1, w) for i, w in enumerate(raw) if w]
    return sum(w << (8 * slot) for slot, (_, w) in enumerate(active)), sum(i << (8 * slot) for slot, (i, _) in enumerate(active))


def sleeve_weight(segment, t):
    # Tendons: fixed torso anchor, upper arm, forearm. Pin both shoulder-seam
    # endpoints and their closing edge; blend around the elbow instead of a cut.
    controls = {
        0: [(0, (1, 0, 0)), (.22, (.18, .82, 0)), (.70, (0, 1, 0)), (1, (0, .48, .52))],
        1: [(0, (0, .48, .52)), (.35, (0, 0, 1)), (1, (0, 0, 1))],
        2: [(0, (0, 0, 1)), (1, (0, 0, 1))],
        3: [(0, (0, 0, 1)), (.65, (0, 0, 1)), (1, (0, .48, .52))],
        4: [(0, (0, .48, .52)), (.30, (0, 1, 0)), (.78, (.18, .82, 0)), (1, (1, 0, 0))],
        5: [(0, (1, 0, 0)), (1, (1, 0, 0))],
    }[segment]
    for (a, wa), (b, wb) in zip(controls, controls[1:]):
        if t <= b:
            return packed(mix(wa, wb, (t - a) / (b - a)))
    return packed(controls[-1][1])


def skin_sleeve(path, bones, bind_origin, shoulder, elbow, upper_angle, fore_angle):
    old = list(path)
    curves = []
    for i, v in enumerate(old):
        following = old[(i + 1) % len(old)]
        curve = (point(v), handle(v, "out"), handle(following, "in"), point(following))
        left, right = split(curve, 1 / 3)
        mid, end = split(right, .5)
        curves.extend([(left, i, 0), (mid, i, 1), (end, i, 2)])
    for v in old:
        path.remove(v)
    for i, (curve, segment, third) in enumerate(curves):
        p, out = curve[:2]
        incoming, previous_segment, previous_third = curves[i - 1]
        incoming = incoming[2]
        def polar(q):
            dx, dy = q[0] - p[0], q[1] - p[1]
            return math.atan2(dy, dx), math.hypot(dx, dy)
        ir, il = polar(incoming)
        ora, ol = polar(out)
        v = add(path, "CubicDetachedVertex", x=p[0], y=p[1],
                inRotation=ir, inDistance=il, outRotation=ora, outDistance=ol)
        pv, pi = sleeve_weight(segment, third / 3)
        iv, ii = sleeve_weight(previous_segment, (previous_third + 2 / 3) / 3)
        ov, oi = sleeve_weight(segment, (third + 1 / 3) / 3)
        add(v, "CubicWeight", values=pv, indices=pi, inValues=iv, inIndices=ii, outValues=ov, outIndices=oi)
    bx, by = bind_origin
    skin = add(path, "Skin", name="Original sleeve continuous skin", tx=bx, ty=by)
    for bone, position, angle in zip(bones, [(0, 0), shoulder, elbow], [0, upper_angle, fore_angle]):
        add(skin, "Tendon", name=bone.get("name") + " bind", boneId=bone.get("id"),
            xx=math.cos(angle), xy=math.sin(angle), yx=-math.sin(angle), yy=math.cos(angle),
            tx=bx + position[0], ty=by + position[1])


def animation(board, name, duration, loop):
    return add(board, "LinearAnimation", name=name, duration=duration, fps=60, loopValue="loop" if loop else "oneShot")


def track(anim, element, prop_name, values, hold=False):
    obj = add(anim, "KeyedObject", objectId=element.get("id") if hasattr(element, "get") else element)
    prop = add(obj, "KeyedProperty", property=prop_name)
    for frame, value in values:
        k = add(prop, "KeyFrameDouble", frame=frame, value=round(value, 9), interpolationType="hold" if hold else "cubic")
        if not hold:
            add(k, "CubicEaseInterpolator", x1=.36, y1=0, x2=.60, y2=1)


def condition(parent, target, value, duration=0):
    t = add(parent, "StateTransition", stateToId=target, duration=duration)
    c = add(t, "TransitionViewModelCondition", opValue="equal")
    comp = add(c, "TransitionPropertyViewModelComparator")
    prop = add(comp, "BindablePropertyNumber")
    add(prop, "DataBindContext", sourcePathIds="92:3-92:5", propertyKey=636)
    add(c, "TransitionValueNumberComparator", value=value)
    if duration:
        add(t, "CubicEaseInterpolator", x1=.42, y1=0, x2=.58, y2=1)


def base_document():
    root = ET.parse(SOURCE).getroot()
    board = root.find("Artboard")
    board.set("name", "ChewyMotion")
    board.set("width", "760")
    board.set("height", "1120")
    board.set("defaultStateMachineId", "92:2")
    board.set("viewModelId", "92:3")
    board.set("viewModelInstanceId", "92:4")
    board.attrib.pop("spaceId", None)
    for s in list(root):
        if s.tag == "Space":
            root.remove(s)
    originals = []
    for child in list(board):
        if child.tag in ["StateMachine", "LinearAnimation"]:
            board.remove(child)
        elif child.tag != "LayoutComponentStyle":
            board.remove(child)
            originals.append(child)
    placement = add(board, "Node", name="Hero placement", x=127, y=30)
    placement.extend(originals)
    vm = add(root, "ViewModel", id="92:3", name="ChewyMotion", defaultInstanceId="92:4")
    add(vm, "ViewModelPropertyNumber", id="92:5", name="action")
    instance = add(vm, "ViewModelInstance", id="92:4", name="Default", exports="true")
    add(instance, "ViewModelInstanceNumber", viewModelPropertyId="92:5", propertyValue=0)
    machine = add(board, "StateMachine", name="ChewyMotion", id="92:2")
    return root, board, placement, machine


def machine_states(machine, idle, wave):
    layer = add(machine, "StateMachineLayer", name="Greeting")
    entry = add(layer, "EntryState", x=0, y=100)
    add(layer, "AnyState", x=0, y=-100)
    add(layer, "ExitState", x=380, y=-100)
    is_ = add(layer, "AnimationState", animationId=idle.get("id"), reset="true", x=180, y=100)
    ws = add(layer, "AnimationState", animationId=wave.get("id"), reset="true", x=380, y=100)
    condition(entry, is_.get("id"), 0)
    condition(entry, ws.get("id"), 1)
    condition(is_, ws.get("id"), 1, 120)
    condition(ws, is_.get("id"), 0, 180)


def palm(parent):
    # An explicit draft alternate hand pose. Original fist remains untouched.
    node = add(parent, "Node", name="Draft greeting palm", opacity=0)
    shape = add(node, "Shape", name="Draft open hand - same palette")
    path = add(shape, "PointsPath", isClosed="true")
    pts = [(3, -12), (-16, -14), (-29, -30), (-38, -29), (-37, -17),
           (-58, -20), (-65, -16), (-65, -10), (-70, -8), (-71, -1),
           (-66, 4), (-70, 10), (-66, 17), (-58, 19), (-53, 24), (-30, 23), (1, 13)]
    for i, p in enumerate(pts):
        before, after = pts[i - 1], pts[(i + 1) % len(pts)]
        dx, dy = (after[0] - before[0]) * .18, (after[1] - before[1]) * .18
        distance = math.hypot(dx, dy)
        angle = math.atan2(dy, dx)
        add(path, "CubicDetachedVertex", x=p[0], y=p[1], inRotation=angle + math.pi,
            inDistance=distance, outRotation=angle, outDistance=distance)
    fill = add(shape, "Fill")
    add(fill, "SolidColor", colorValue="FFF2C9A3")
    stroke = add(shape, "Stroke", thickness=3.8, cap="round", join="round")
    add(stroke, "SolidColor", colorValue="FF24241B")
    # Short palm crease echoes the original two unobtrusive finger marks.
    crease = add(node, "Shape", name="Draft palm crease")
    path = add(crease, "PointsPath")
    add(path, "CubicDetachedVertex", x=-22, y=-7, outRotation=2.3, outDistance=8)
    add(path, "CubicDetachedVertex", x=-25, y=10, inRotation=-2.3, inDistance=7)
    stroke = add(crease, "Stroke", thickness=2.6, cap="round", join="round")
    add(stroke, "SolidColor", colorValue="FF24241B")
    # Front-to-back: place the crease before its filled hand.
    node.remove(crease)
    node.insert(0, crease)
    return node


def write(root, directory):
    directory.mkdir(parents=True, exist_ok=True)
    tree = ET.ElementTree(root)
    ET.indent(tree, space="  ")
    tree.write(directory / "scene.rml", encoding="unicode")
    (directory / "rive.yaml").write_text("name: chewy\nlogs:\n  file: build/rive.log\n  problems: build/problems.log\n")


def bootstrap(replace=False):
    if (HERE / "chewy/scene.rml").exists() and not replace:
        raise SystemExit("Editable master exists; compile it directly. --replace-master discards pilot authoring edits.")
    baseline, bb, _, bm = base_document()
    bi, bw = animation(bb, "Idle", 240, True), animation(bb, "Wave", 288, False)
    machine_states(bm, bi, bw)
    write(baseline, HERE / "baseline")

    root, board, placement, machine = base_document()
    upper = placement.find("Node[@id='5:10']")
    pivot = add(placement, "Node", name="Upper body expression pivot", x=260, y=610)
    geom = add(pivot, "Node", name="Preserved upper coordinates", x=-260, y=-610)
    placement.remove(upper)
    geom.append(upper)
    placement.remove(pivot)
    placement.insert(0, pivot)
    shoulder, elbow, wrist_point = (322, 394), (461, 465), (402, 548)
    upper_angle = math.atan2(elbow[1] - shoulder[1], elbow[0] - shoulder[0])
    fore_angle = math.atan2(wrist_point[1] - elbow[1], wrist_point[0] - elbow[0])
    upper_len = math.dist(shoulder, elbow)
    fore_len = math.dist(elbow, wrist_point)
    anchor = add(upper, "RootBone", name="Pinned shoulder seam", length=0, x=0, y=0)
    arm = add(upper, "RootBone", name="Right upper arm", x=shoulder[0], y=shoulder[1], length=upper_len, rotation=upper_angle)
    forearm = add(arm, "Bone", name="Right forearm", length=fore_len, rotation=fore_angle - upper_angle)
    wrist = add(forearm, "Node", name="Right wrist", x=fore_len, y=0, rotation=-fore_angle)
    fist = add(wrist, "Node", name="Preserved original fist", x=-wrist_point[0], y=-wrist_point[1])
    for child in list(upper):
        if child.get("name") in ["Right fingers", "Right knuckles", "Right hand"]:
            upper.remove(child)
            fist.append(child)
    open_hand = palm(wrist)
    # The waving hand remains in front of sleeve; face/hair remain foreground.
    upper.remove(arm)
    upper.insert(1, arm)
    skin_sleeve(upper.find("Shape[@name='Right sleeve']/PointsPath"), [anchor, arm, forearm],
                (127 + float(upper.get("x", 0)), 30 + float(upper.get("y", 0))),
                shoulder, elbow, upper_angle, fore_angle)
    head = upper.find("Node[@id='5:20']")
    idle, wave = animation(board, "Idle", 240, True), animation(board, "Wave", 288, False)
    # Sparse pose-to-pose authoring: prepare, raise, two unequal waves, lower,
    # small overshoot, return exactly to the source stance, then hold.
    frames = [0, 18, 38, 66, 82, 102, 121, 144, 166, 196, 226, 250, 288]
    arms = [upper_angle, upper_angle + .035, -.05, -.80, -.83, -.77, -.80, -.765, -.78, -.18, upper_angle + .018, upper_angle, upper_angle]
    elbows = [fore_angle - upper_angle, fore_angle - upper_angle + .035, 1.25, .24, .16, .34, .20, .315, .27, 1.10, fore_angle - upper_angle - .025, fore_angle - upper_angle, fore_angle - upper_angle]
    wrists = [0, .015, -.15, -1.18, -1.40, -1.12, -1.30, -1.18, -1.18, -.35, .018, 0, 0]
    tilts = [0, -.008, .006, .020, .025, .017, .023, .018, .014, .004, -.005, 0, 0]
    body = [0, -.004, .004, .010, .012, .009, .011, .008, .006, .002, -.003, 0, 0]
    tracks = [(arm, "rotation", list(zip(frames, arms)), upper_angle),
              (forearm, "rotation", list(zip(frames, elbows)), fore_angle - upper_angle),
              (wrist, "rotation", [(f, -fore_angle + d) for f, d in zip(frames, wrists)], -fore_angle),
              (head, "rotation", list(zip(frames, tilts)), 0),
              (pivot, "rotation", list(zip(frames, body)), 0),
              (pivot, "scaleY", [(0, 1), (18, .996), (62, 1.002), (168, 1), (225, .998), (250, 1), (288, 1)], 1)]
    for target, prop, keys, neutral in tracks:
        track(wave, target, prop, keys)
        if target is pivot and prop == "scaleY":
            track(idle, target, prop, [(0, 1), (100, 1.003), (240, 1)])
        elif target is head:
            track(idle, target, prop, [(0, 0), (112, .0035), (240, 0)])
        else:
            track(idle, target, prop, [(0, neutral), (240, neutral)])
    for target in ["5:21", "5:22"]:
        track(wave, target, "scaleY", [(0, 1), (12, 1), (17, .08), (24, 1), (242, 1), (247, .08), (254, 1), (288, 1)])
        track(idle, target, "scaleY", [(0, 1), (163, 1), (168, .08), (176, 1), (240, 1)])
    for target, inverse in [(fist, False), (open_hand, True)]:
        track(wave, target, "opacity", [(0, int(not inverse)), (52, int(inverse)), (190, int(not inverse)), (288, int(not inverse))], hold=True)
        track(idle, target, "opacity", [(0, int(not inverse)), (240, int(not inverse))], hold=True)
    machine_states(machine, idle, wave)
    write(root, HERE / "chewy")
    brief = {
        "status": "draft motion and alternate palm for owner review",
        "source": str(SOURCE.relative_to(HERE.parent.parent.parent)),
        "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        "master": "chewy/scene.rml", "baseline": "baseline/scene.rml",
        "artboard": "ChewyMotion", "stateMachine": "ChewyMotion", "viewModel": "ChewyMotion",
        "canvas": [760, 1120], "placement": {"name": "Hero placement", "x": 127, "y": 30},
        "action": {"0": "Idle", "1": "Wave"}, "fps": 60,
        "animations": {"Idle": {"frames": 240, "seconds": 4, "loop": True}, "Wave": {"frames": 288, "seconds": 4.8, "loop": False}},
        "replay": "Set action=0, advance at least one frame, set action=1. Wave holds its original neutral stance at the end until action=0.",
        "intent": "Friendly, readable greeting: anticipate, raise connected arm, two asymmetric diminishing wrist/forearm waves, lower and settle to original stance.",
        "rig": "Original right sleeve subdivided exactly and skinned to torso anchor/upper arm/forearm. Hand is rigid on wrist. Original shoulder seam stays pinned.",
        "artChanges": "Original face/hair/torso/legs/boots/fist preserved. One explicitly draft alternate open palm appears only during greeting; no baseline replacement.",
        "feet": "All trouser/boot/wrap shapes unchanged and unkeyed. Lower region y>=720 remains still.",
        "motionAuthoring": "Sparse selected poses with cubic interpolation. No sine generation or per-frame keyframe bake.",
        "sourceOfTruth": "Saved RML; bootstrap is explicit only and never part of build.",
        "reducedMotion": "Show Idle at t=0 without autoplay.",
    }
    (HERE / "motion-brief.json").write_text(json.dumps(brief, ensure_ascii=False, indent=2) + "\n")
    print("Created isolated Chewy master and static baseline; source artwork unchanged.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bootstrap", action="store_true")
    parser.add_argument("--replace-master", action="store_true")
    args = parser.parse_args()
    if not args.bootstrap:
        parser.error("--bootstrap required; normal builds compile saved RML directly")
    bootstrap(args.replace_master)
