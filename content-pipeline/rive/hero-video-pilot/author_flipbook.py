#!/usr/bin/env python3
"""Explicit bootstrap only: prepared RGBA sequence -> editable native Rive RML.

Normal builds read the saved master and never invoke this file. Source video
and frame normalization belong to source-manifest.json and are not changed.
"""
from pathlib import Path
import argparse
import xml.etree.ElementTree as ET
from PIL import Image

HERE = Path(__file__).resolve().parent
PROJECT = HERE / "chewy"
SERIAL = 1000


def add(parent, tag, **attrs):
    global SERIAL
    attrs.setdefault("id", f"93:{SERIAL}")
    SERIAL += 1
    return ET.SubElement(parent, tag, {k: str(v) for k, v in attrs.items()})


def transition(parent, destination, action):
    change = add(parent, "StateTransition", stateToId=destination, duration=0)
    condition = add(change, "TransitionViewModelCondition", opValue="equal")
    comparator = add(condition, "TransitionPropertyViewModelComparator")
    property_ = add(comparator, "BindablePropertyNumber")
    add(property_, "DataBindContext", sourcePathIds="93:3-93:5", propertyKey=636)
    add(condition, "TransitionValueNumberComparator", value=action)


def bootstrap(replace=False):
    output = PROJECT / "scene.rml"
    if output.exists() and not replace:
        raise SystemExit("Saved master already exists; compile it directly. --replace-master explicitly discards edits.")
    frames = [PROJECT / "assets" / f"frame-{i:03d}.png" for i in range(121)]
    if any(not p.exists() for p in frames):
        raise SystemExit("Prepare all 121 assets/frame-NNN.png first; no frames are generated here.")
    for frame in frames:
        with Image.open(frame) as im:
            if im.size != (253, 530) or im.mode != "RGBA":
                raise SystemExit(f"Unexpected prepared frame dimensions/mode: {frame}")
    root = ET.Element("Rive", version="1", kind="fragment")
    board = add(root, "Artboard", id="93:1", name="ChewyVideo", width=253, height=530,
                defaultStateMachineId="93:2", viewModelId="93:3", viewModelInstanceId="93:4", styleId="93:6")
    add(board, "LayoutComponentStyle", id="93:6", name="Chewy video style")
    solo = add(board, "Solo", id="93:7", name="Recorded frames", activeComponentId="93:100", x=0, y=0)
    for i, path in enumerate(frames):
        add(solo, "Image", id=f"93:{100+i}", name=f"Frame {i:03d}", assetId=f"93:{300+i}",
            x=0, y=0, originX=0, originY=0)
        add(root, "ImageAsset", id=f"93:{300+i}", name=f"frame-{i:03d}", file=f"assets/{path.name}",
            exportTypeValue="embedded", width=253, height=530)
    vm = add(root, "ViewModel", id="93:3", name="ChewyVideo", defaultInstanceId="93:4")
    add(vm, "ViewModelPropertyNumber", id="93:5", name="action")
    instance = add(vm, "ViewModelInstance", id="93:4", name="Default", exports="true")
    add(instance, "ViewModelInstanceNumber", viewModelPropertyId="93:5", propertyValue=0)
    machine = add(board, "StateMachine", name="ChewyVideo", id="93:2")
    layer = add(machine, "StateMachineLayer", name="Recorded playback")
    entry = add(layer, "EntryState", x=0, y=100)
    add(layer, "AnyState", x=0, y=-100)
    add(layer, "ExitState", x=380, y=-100)
    rest_state = add(layer, "AnimationState", animationId="93:10", reset="true", x=180, y=100)
    recorded_state = add(layer, "AnimationState", animationId="93:11", reset="true", x=380, y=100)
    transition(entry, rest_state.get("id"), 0)
    transition(entry, recorded_state.get("id"), 1)
    transition(rest_state, recorded_state.get("id"), 1)
    transition(recorded_state, rest_state.get("id"), 0)
    for name, ident, count in [("Rest", "93:10", 1), ("RecordedGesture", "93:11", 121)]:
        animation = add(board, "LinearAnimation", name=name, id=ident, fps=24, duration=count, loopValue="oneShot")
        target = add(animation, "KeyedObject", objectId=solo.get("id"))
        prop = add(target, "KeyedProperty", propertyKey=296)
        for i in range(count):
            add(prop, "KeyFrameId", frame=i, value=f"93:{100+i}", interpolationType="hold")
    ET.indent(root, space="  ")
    ET.ElementTree(root).write(output, encoding="unicode")
    (PROJECT / "rive.yaml").write_text("name: chewy-video\nlogs:\n  file: build/rive.log\n  problems: build/problems.log\n")
    print(f"Created editable native flipbook master: {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bootstrap", action="store_true")
    parser.add_argument("--replace-master", action="store_true")
    args = parser.parse_args()
    if not args.bootstrap:
        parser.error("--bootstrap is required; normal builds compile the existing master")
    bootstrap(args.replace_master)
