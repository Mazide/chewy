#!/usr/bin/env python3
"""Isolated controllable rig proof; never writes to the source hero or cloud.

The imported face, hair and torso keep their authored geometry. Limbs below are
draft articulated replacements, with both outfits under the same joint nodes.
Run only once; --replace-draft explicitly replaces this proof's generated RML.
"""
import argparse
from copy import deepcopy
import hashlib
import json
import math
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parent / "hero-wardrobe/references/hero-from-editor.rml"
sys.path.insert(0, str(ROOT.parent / "camp-scene-vector"))
sys.path.insert(0, str(ROOT.parent / "hero-wardrobe"))
from vector_utils import el, group, path
from wardrobe_art import build_trail_outfit


def make_draft(replace=False):
    destination = ROOT / "scene.rml"
    if destination.exists() and not replace:
        raise SystemExit("scene.rml exists; edit the saved rig or explicitly use --replace-draft.")
    original_bytes = SOURCE.read_bytes()
    source = ET.fromstring(original_bytes).find("Artboard")
    upper = source.find("Node[@id='5:10']")
    root = el("Rive", version=1, kind="fragment")
    board = el("Artboard", name="HeroActions", id="60:1", width=1400, height=1120,
               defaultStateMachineId="60:2", viewModelId="60:3", viewModelInstanceId="60:4", styleId="60:5")
    root.append(board)
    board.append(el("LayoutComponentStyle", id="60:5", name="Hero actions style"))
    pairs = []
    joints = {}
    next_ident = 100

    def ident():
        nonlocal next_ident
        value = f"60:{next_ident}"
        next_ident += 1
        return value

    def joint(name, children, **attributes):
        node = group(name, children, id=ident(), **attributes)
        joints[name] = node.get("id")
        return node

    def clothing(name, camp, trail):
        first = group(f"Camp {name}", camp, id=ident(), opacity=1)
        second = group(f"Trail {name}", trail, id=ident(), opacity=0)
        pairs.append((first.get("id"), second.get("id")))
        return [first, second]

    def limb(name, length, width, camp_color, trail_color):
        d = f"M {-width} -12 Q 0 -22 {width} -12 L {width-3} {length} Q 0 {length+15} {-width+3} {length} Z"
        camp = [path(name, d, camp_color)]
        trail = [path(f"Trail {name}", d, trail_color)]
        if "shin" in name:
            trail.append(path(f"Trail {name} patch", f"M -16 35 L 16 35 L 15 78 L -15 78 Z", "A88A64", stroke=2.6))
        return clothing(name, camp, trail)

    def boot(side):
        # Both variants share the ankle and silhouette; all details move with it.
        d = "M -25 -18 Q 1 -10 24 -18 L 26 55 Q 60 64 67 84 Q 70 94 55 94 L -25 94 Q -37 93 -35 78 L -29 32 Z"
        camp = [path(f"{side} boot", d, "C3C1A0"),
                path(f"{side} upper boot wrap", "M -29 19 Q 0 35 25 18", stroke=3)]
        camp.append(path(f"{side} lower boot wrap", "M -28 42 Q 0 55 26 38", stroke=3))
        trail = [path(f"Trail {side} boot", d, "705037"),
                 path(f"Trail {side} cuff", "M -28 -13 Q 0 -5 24 -13 L 25 11 Q 0 20 -29 9 Z", "94704B", stroke=3),
                 path(f"Trail {side} sole", "M -31 84 L 59 84", stroke=3.5)]
        return joint(f"{side} ankle", clothing(f"{side} boot", camp, trail), y=158)

    def leg(side, x):
        shin = joint(f"{side} knee", limb(f"{side} shin", 160, 24, "477B98", "9A7956") + [boot(side)], y=158)
        return joint(f"{side} hip", limb(f"{side} thigh", 162, 29, "477B98", "9A7956") + [shin], x=x, y=20)

    # Upper-body source transforms are preserved in their geometry container.
    head = deepcopy(upper.find("Node[@id='5:20']"))
    camp_top = [deepcopy(node) for node in upper if node.get("name") in {"Linen shirt", "Shirt hem left", "Shirt hem right"}]
    # `upper` is front-to-back, while group() accepts back-to-front.
    camp_top.reverse()
    trail_top = build_trail_outfit()["top"]
    trail_parts = [deepcopy(node) for node in reversed(list(trail_top))
                   if node.get("name") not in {"Trail left sleeve", "Trail right sleeve", "Trail left cuff", "Trail right cuff"}]
    torso_geometry = group("Preserved torso geometry", clothing("torso", camp_top, trail_parts) + [head],
                           x=-260+float(upper.get("x", 0)), y=-620+float(upper.get("y", 0)))
    pelvis = clothing("pelvis", [path("Camp hip fabric", "M -98 -26 Q 0 -8 98 -26 L 93 59 Q 55 79 0 66 Q -58 79 -96 59 Z", "477B98")],
                       [path("Trail hip fabric", "M -98 -26 Q 0 -8 98 -26 L 93 59 Q 55 79 0 66 Q -58 79 -96 59 Z", "9A7956")])

    def hand(side):
        offset = (140, 555) if side == "Left" else (380, 555)
        names = {f"{side} hand", f"{side} fingers", f"{side} knuckles"}
        parts = [deepcopy(node) for node in reversed(list(upper)) if node.get("name") in names]
        art = group(f"{side} preserved fist", parts, x=-offset[0], y=-offset[1])
        children = [art]
        if side == "Right":
            stick = group("Marshmallow stick", [
                path("Stick", "M 0 0 Q 2 100 -5 231", stroke=5, ink="79583B"),
                path("Marshmallow", "M -19 202 Q -17 195 -7 196 L 8 199 Q 16 201 14 211 L 9 233 Q 7 240 -3 238 L -20 234 Q -27 232 -24 223 Z", "F4E2BB", stroke=2.7),
                path("Marshmallow toasted edge", "M -21 231 Q -5 233 8 229", stroke=2.7, ink="C49A61"),
            ], id=ident(), opacity=0)
            joints["stick"] = stick.get("id")
            children.insert(0, stick)
        return joint(f"{side} hand socket", children, y=108)

    def arm(side, x):
        forearm = joint(f"{side} elbow", limb(f"{side} forearm", 105, 20, "EDEBD1", "65794F") + [hand(side)], y=102)
        return joint(f"{side} shoulder", limb(f"{side} upper sleeve", 106, 23, "EDEBD1", "65794F") + [forearm], x=x, y=-228)

    upper_body = joint("Upper body", [arm("Left", -77), arm("Right", 77), torso_geometry])
    # Draw order is intentionally front-to-back: hands and sleeves sit above the
    # torso except the shoulder caps, which are hidden by overlapping fabric.
    for child in list(upper_body):
        if child.get("name") in {"Left shoulder", "Right shoulder"}:
            upper_body.remove(child)
            upper_body.insert(0, child)
    body = joint("Body", [leg("Left", -58), leg("Right", 58)] + pelvis + [upper_body], y=-398)
    placement = joint("Program placement", [body], x=700, y=1040)
    for name, key in [("rootX", 13), ("rootY", 14), ("facing", 16)]:
        prop = {"rootX": "60:10", "rootY": "60:11", "facing": "60:12"}[name]
        placement.append(el("DataBindContext", sourcePathIds=f"60:3-{prop}", propertyKey=key))
    board.append(placement)

    # Independent view-model axes. Outfit/prop transitions never key rig joints.
    vm = el("ViewModel", name="HeroControls", id="60:3", defaultInstanceId="60:4")
    instance = el("ViewModelInstance", name="Default", id="60:4", exports="true")
    enums = {}
    for name, keys in [("action", ["idle", "walk", "sit", "reach"]), ("outfit", ["camp", "trail"]), ("prop", ["none", "stick"])]:
        enum_id, prop_id = ident(), ident()
        enum = el("DataEnumCustom", name=name.title(), id=enum_id)
        values = {}
        for key in keys:
            values[key] = ident()
            enum.append(el("DataEnumValue", key=key, value=key, id=values[key]))
        root.append(enum)
        vm.append(el("ViewModelPropertyEnumCustom", name=name, id=prop_id, enumId=enum_id))
        instance.append(el("ViewModelInstanceEnum", viewModelPropertyId=prop_id, propertyValue=values[keys[0]]))
        enums[name] = (prop_id, values)
    for name, prop_id, value in [("rootX", "60:10", 700), ("rootY", "60:11", 1040), ("facing", "60:12", 1)]:
        vm.append(el("ViewModelPropertyNumber", name=name, id=prop_id))
        instance.append(el("ViewModelInstanceNumber", viewModelPropertyId=prop_id, propertyValue=value))
    vm.append(instance)
    root.append(vm)
    machine = el("StateMachine", name="HeroActions", id="60:2")
    board.append(machine)

    def animate(name, tracks, duration=60, loop=True):
        anim = el("LinearAnimation", name=name, id=ident(), fps=60, duration=duration,
                  loopValue="loop" if loop else "oneShot")
        for target, property_name, keys in tracks:
            keyed = el("KeyedObject", objectId=joints.get(target, target))
            prop = el("KeyedProperty", property=property_name)
            for frame, value in keys:
                prop.append(el("KeyFrameDouble", frame=frame, value=round(value, 6)))
            keyed.append(prop)
            anim.append(keyed)
        board.append(anim)
        return anim.get("id")

    # Every action keys the complete motion contract, so interrupts cannot leave
    # a leg or arm in an old action. Clothing is an orthogonal animation layer.
    neutral = {
        ("Body", "y"): -398, ("Body", "rotation"): 0,
        ("Upper body", "y"): 0, ("Upper body", "rotation"): 0,
        ("Left hip", "rotation"): .05, ("Right hip", "rotation"): -.05,
        ("Left knee", "rotation"): 0, ("Right knee", "rotation"): 0,
        ("Left ankle", "rotation"): 0, ("Right ankle", "rotation"): 0,
        ("Left shoulder", "rotation"): .18, ("Right shoulder", "rotation"): -.18,
        ("Left elbow", "rotation"): -.22, ("Right elbow", "rotation"): .22,
        ("5:20", "rotation"): 0, ("5:21", "scaleY"): 1, ("5:22", "scaleY"): 1,
    }
    actions = {}
    for action in ["idle", "walk", "sit", "reach"]:
        duration = 48 if action == "walk" else 180
        values = dict(neutral)
        if action == "sit":
            values.update({("Body", "y"): -292, ("Left hip", "rotation"): -1.22,
                ("Right hip", "rotation"): -1.1, ("Left knee", "rotation"): 1.22,
                ("Right knee", "rotation"): 1.1, ("Right shoulder", "rotation"): -.42,
                ("Right elbow", "rotation"): -.92, ("Left shoulder", "rotation"): -.1,
                ("Left elbow", "rotation"): -.65})
        if action == "reach":
            values.update({("Upper body", "rotation"): -.025, ("Right shoulder", "rotation"): -1.08,
                ("Right elbow", "rotation"): -.36, ("5:20", "rotation"): -.035})
        tracks = []
        for (target, prop_name), value in values.items():
            keys = [(0, value), (duration, value)]
            if prop_name == "y" and (target == "Upper body" or (target == "Body" and action == "walk")):
                amplitude = 2 if target == "Upper body" else 5
                cycles = 2 if action == "walk" else 1
                keys = [(i, value - amplitude * math.sin(math.pi*2*i/duration*cycles)) for i in range(0, duration+1, 3)]
            if action == "walk" and prop_name == "rotation":
                amplitude = {"Left hip": .29, "Right hip": -.29, "Left shoulder": -.24, "Right shoulder": .24}.get(target, 0)
                if amplitude:
                    keys = [(i, value + amplitude*math.sin(math.pi*2*i/duration)) for i in range(0, duration+1, 3)]
                if target in {"Left knee", "Right knee"}:
                    phase = 0 if target == "Left knee" else math.pi
                    keys = [(i, .22 * max(0, math.sin(math.pi*2*i/duration+phase))) for i in range(0, duration+1, 3)]
            if target in {"5:21", "5:22"}:
                keys = [(0,1),(duration-15,1),(duration-10,.08),(duration-5,1),(duration,1)]
            tracks.append((target, prop_name, keys))
        actions[action] = animate(action.title(), tracks, duration)

    outfits = {}
    for index, name in enumerate(["camp", "trail"]):
        outfits[name] = animate(f"Outfit {name}", [(target, "opacity", [(0, value)])
            for camp, trail in pairs for target, value in [(camp, 1-index), (trail, index)]], 1)
    props = {name: animate(f"Prop {name}", [("stick", "opacity", [(0, index)])], 1)
             for index, name in enumerate(["none", "stick"])}

    def selection_layer(name, animations, duration):
        prop_id, options = enums[name]
        layer = el("StateMachineLayer", name=name.title())
        layer.append(el("AnyState", x=0, y=-180))
        layer.append(el("ExitState", x=0, y=-360))
        states = {value: ident() for value in animations}
        entry = el("EntryState", x=0, y=80)
        entry.append(el("StateTransition", stateToId=states[next(iter(states))], duration=0))
        layer.append(entry)
        for index, (current, animation) in enumerate(animations.items()):
            state = el("AnimationState", id=states[current], animationId=animation, x=280+index*280, y=80)
            for other in animations:
                if current == other:
                    continue
                transition = el("StateTransition", stateToId=states[other], duration=duration)
                condition = el("TransitionViewModelCondition", opValue="equal")
                comparator = el("TransitionPropertyViewModelComparator")
                bindable = el("BindablePropertyEnum")
                bindable.append(el("DataBindContext", sourcePathIds=f"60:3-{prop_id}", propertyKey=637))
                comparator.append(bindable)
                condition.append(comparator)
                condition.append(el("TransitionValueEnumComparator", value=options[other]))
                transition.append(condition)
                state.append(transition)
            layer.append(state)
        machine.append(layer)

    selection_layer("action", actions, 220)
    selection_layer("outfit", outfits, 0)
    selection_layer("prop", props, 0)
    used = {node.get("id") for node in root.iter() if node.get("id")}
    for node in root.iter():
        if node is root or node.tag == "BindablePropertyEnum" or node.get("id"):
            continue
        fresh = ident()
        while fresh in used:
            fresh = ident()
        node.set("id", fresh)
        used.add(fresh)
    tree = ET.ElementTree(root)
    ET.indent(tree)
    tree.write(destination, encoding="unicode")
    assert SOURCE.read_bytes() == original_bytes
    (ROOT / "manifest.json").write_text(json.dumps({
        "status": "technical proof, not final art",
        "source": str(SOURCE.relative_to(ROOT.parent.parent.parent)),
        "source_sha256": hashlib.sha256(original_bytes).hexdigest(),
        "artboard": "HeroActions", "state_machine": "HeroActions", "view_model": "HeroControls",
        "controls": {"action": list(actions), "outfit": list(outfits), "prop": list(props),
                     "rootX": 700, "rootY": 1040, "facing": [-1, 1]},
        "preview_safe_root_x": [600, 800],
        "joints": joints, "shared_outfit_pairs": len(pairs),
        "limits": ["front-facing technical rig", "new draft limb geometry", "no foot IK", "no native validation", "no gameplay integration"],
    }, indent=2) + "\n")
    print(destination)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--replace-draft", action="store_true")
    make_draft(parser.parse_args().replace_draft)
