#!/usr/bin/env python3
"""Build a script-free Rive loop from the traced Chewy base campfire.

Only flame vertices and their Bezier handles receive keys. Logs and all shape
transforms stay fixed. The analytic motion is periodic; its sampled keys close
position exactly. Rendered neighboring frames verify the exported loop seam.
"""

from math import atan2, cos, hypot, pi, sin
from pathlib import Path
import xml.etree.ElementTree as ET

from art import build_art

ROOT = Path(__file__).resolve().parent
WIDTH, HEIGHT = 1312, 1199
FPS, DURATION, KEY_STEP = 60, 240, 6


def element(tag, **attributes):
    return ET.Element(tag, {key: str(value) for key, value in attributes.items()})


def warp(x, y, frame, layer):
    """A periodic flame flow with a fully pinned root below y=790."""
    height = max(0.0, min(1.0, (790.0 - y) / 690.0))
    phase = layer * 0.67
    t = 2 * pi * frame / DURATION
    a = -height * 4.8 + phase
    b = height * 2.5 + phase * 1.3
    c = -height * 3.2 + phase
    dx = height ** 1.25 * (
        14 * (sin(2 * t + a) - sin(a))
        + 6 * (sin(3 * t + b) - sin(b))
    )
    dy = height ** 1.4 * (
        13 * (sin(3 * t + c) - sin(c))
        + 5 * (sin(5 * t + phase) - sin(phase))
    )
    return x + dx, y + dy


def keyed_properties(animation, vertex, layer):
    keyed = ET.SubElement(animation, "KeyedObject", objectId=vertex.get("id"))
    x, y = float(vertex.get("x")), float(vertex.get("y"))
    controls = {}
    for side in ("in", "out"):
        angle = float(vertex.get(side + "Rotation"))
        length = float(vertex.get(side + "Distance"))
        controls[side] = (x + cos(angle) * length, y + sin(angle) * length)
    values = {name: [] for name in (
        "x", "y", "inRotation", "inDistance", "outRotation", "outDistance"
    )}
    for frame in range(0, DURATION + 1, KEY_STEP):
        px, py = warp(x, y, frame, layer)
        values["x"].append((frame, px))
        values["y"].append((frame, py))
        for side, (cx, cy) in controls.items():
            qx, qy = warp(cx, cy, frame, layer)
            angle = atan2(qy - py, qx - px)
            reference = float(vertex.get(side + "Rotation"))
            # Avoid interpolating across the -pi/pi discontinuity.
            angle = reference + (angle - reference + pi) % (2 * pi) - pi
            values[side + "Rotation"].append((frame, angle))
            values[side + "Distance"].append((frame, hypot(qx - px, qy - py)))
    for name, samples in values.items():
        if len({round(value, 6) for _, value in samples}) == 1:
            samples = samples[:1]
        prop = ET.SubElement(keyed, "KeyedProperty", property=name)
        for frame, value in samples:
            prop.append(element("KeyFrameDouble", frame=frame,
                                value=round(value, 6), interpolationType="linear"))


def main():
    layers, flames = build_art()
    root = element("Rive", version=1, kind="fragment")
    board = ET.SubElement(root, "Artboard", {
        "name": "CampfireBase", "id": "0:1", "width": str(WIDTH),
        "height": str(HEIGHT), "styleId": "0:5", "defaultStateMachineId": "0:7",
    })
    board.append(element("LayoutComponentStyle", name="Campfire Style", id="0:5"))
    board.extend(reversed(layers))
    machine = ET.SubElement(board, "StateMachine", name="CampfireBase", id="0:7")
    layer = ET.SubElement(machine, "StateMachineLayer", name="Fire loop", id="0:8")
    layer.append(element("AnyState", x=0, y=-120))
    layer.append(element("ExitState", x=240, y=-120))
    entry = ET.SubElement(layer, "EntryState", x="0", y="120")
    entry.append(element("StateTransition", stateToId="0:200"))
    layer.append(element("AnimationState", x=240, y=120,
                         animationId="0:100", id="0:200"))
    animation = ET.SubElement(board, "LinearAnimation", name="Calm fire",
                              id="0:100", fps=str(FPS), duration=str(DURATION),
                              loopValue="loop")
    for index, flame in enumerate(flames):
        for vertex in flame["vertices"]:
            keyed_properties(animation, vertex, index)
    ET.indent(root, space="  ")
    (ROOT / "scene.rml").write_text(ET.tostring(root, encoding="unicode") + "\n")
    print(f"Built scene.rml: {len(flames)} flame contours; static logs; {DURATION/FPS:g}s loop.")


if __name__ == "__main__":
    main()
