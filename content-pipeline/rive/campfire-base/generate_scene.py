#!/usr/bin/env python3
"""Build a script-free Rive loop from the traced Chewy base campfire.

Only flame vertices and their Bezier handles receive keys. Logs and all shape
transforms stay fixed. The analytic motion is periodic; its sampled keys close
position exactly. Rendered neighboring frames verify the exported loop seam.
"""

from math import atan2, cos, exp, hypot, pi, sin
from pathlib import Path
import xml.etree.ElementTree as ET

from art import build_art

ROOT = Path(__file__).resolve().parent
WIDTH, HEIGHT = 1312, 1199
FPS, DURATION, KEY_STEP = 60, 360, 4


def element(tag, **attributes):
    return ET.Element(tag, {key: str(value) for key, value in attributes.items()})


def warp(x, y, frame, layer):
    """Rising, tapering tongues with independent pulses and a pinned root.

    All contours share a gentle flow; their tips then stretch and curl on
    different rhythms. Height is normalized per contour, so the inner heart
    moves visibly too. This deforms curves, never the entire flame as a sprite.
    """
    root = 790.0
    top = (103.0, 332.0, 533.0)[layer]
    height = max(0.0, min(1.0, (root - y) / (root - top)))
    if height == 0:
        return x, y
    phase = layer * 0.83
    t = 2 * pi * frame / DURATION

    def wave(frequency, offset=0):
        # A bounded wave, neutral at the reference pose and at every loop seam.
        return (sin(frequency * t + offset) - sin(offset)) / (1 + abs(sin(offset)))

    strength = height ** 1.35
    common_flow = 17 * strength * wave(3, -height * 3.3)
    curl = (48, 33, 24)[layer] * height ** 1.8 * wave(5 + layer, -height * 2.4 + phase)
    # The two side tongues breathe out of phase with the tall centre tongue.
    left = exp(-((x - (510, 525, 625)[layer]) / (95, 68, 45)[layer]) ** 2)
    right = exp(-((x - (885, 840, 725)[layer]) / (85, 60, 45)[layer]) ** 2)
    side_flow = (22, 15, 8)[layer] * strength * (
        left * wave(7, 0.6 + phase) - right * wave(6, -0.4 + phase)
    )
    # Broadening at mid-height and tapering above it reads as combustion,
    # rather than a rigid left/right sway or a whole-object squash.
    taper = 0.075 * strength * (x - 670) * wave(4 + layer, -height * 4 + phase)
    dx = common_flow + curl + side_flow + taper
    dy = -(58, 42, 34)[layer] * height ** 1.5 * wave(4 + layer, -height * 1.9 + phase)
    dy += (24, 18, 12)[layer] * strength * (
        left * wave(6, 0.8 + phase) + right * wave(7, 1.6 + phase)
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
    animation = ET.SubElement(board, "LinearAnimation", name="Living fire",
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
