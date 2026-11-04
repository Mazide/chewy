#!/usr/bin/env python3
"""Bootstrap an isolated wardrobe draft from the editor snapshot, only once."""
from copy import deepcopy
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / "camp-scene-vector"))
from vector_utils import el
from wardrobe_art import build_trail_outfit


def make_draft():
    destination = ROOT / "scene.rml"
    if destination.exists():
        raise SystemExit("scene.rml already exists; edit that source to retain manual changes.")
    tree = ET.parse(ROOT / "references/hero-from-editor.rml")
    root = tree.getroot()
    board = root.find("Artboard")
    upper = board.find("Node[@id='5:10']")
    board.set("viewModelId", "40:1")
    board.set("viewModelInstanceId", "40:3")
    group_ids = []

    def collect(parent, names, name, ident):
        children = [child for child in parent if child.get("name") in names]
        assert len(children) == len(names), (name, len(children))
        insertion = min(list(parent).index(child) for child in children)
        node = el("Node", name=name, id=ident, opacity=1)
        for child in children:
            parent.remove(child)
            node.append(child)
        parent.insert(insertion, node)
        return node

    camp_top = collect(upper, {"Linen shirt", "Left sleeve", "Right sleeve", "Shirt hem left", "Shirt hem right"}, "Camp top", "40:10")
    camp_shoes = collect(board, {"Left boot", "Right boot", "Left cuff", "Right cuff", "Left wrap upper", "Left wrap lower", "Right wrap upper", "Right wrap lower"}, "Camp shoes", "40:11")
    camp_bottom = collect(board, {"Blue trousers"}, "Camp trousers", "40:12")
    trail = build_trail_outfit()
    for parent, old, new, ident in [(upper, camp_top, trail['top'], '40:13'), (board, camp_shoes, trail['shoes'], '40:14'), (board, camp_bottom, trail['bottom'], '40:15')]:
        new.set("id", ident)
        new.set("opacity", "0")
        parent.insert(list(parent).index(old) + 1, new)
        group_ids.append((old.get('id'), ident))

    enum = el("DataEnumCustom", name="Outfit", id="40:4")
    enum.append(el("DataEnumValue", key="camp", value="Camp", id="40:5"))
    enum.append(el("DataEnumValue", key="trail", value="Trail", id="40:6"))
    root.append(enum)
    vm = el("ViewModel", name="Wardrobe", id="40:1", defaultInstanceId="40:3")
    vm.append(el("ViewModelPropertyEnumCustom", name="outfit", id="40:2", enumId="40:4"))
    for ident, label, value in [('40:3', 'Camp', '40:5'), ('40:7', 'Trail', '40:6')]:
        instance = el("ViewModelInstance", id=ident, name=label, exports="true")
        instance.append(el("ViewModelInstanceEnum", viewModelPropertyId="40:2", propertyValue=value))
        vm.append(instance)
    root.append(vm)

    machine = board.find("StateMachine")
    layer = el("StateMachineLayer", name="Outfit selection")
    layer.append(el("AnyState", x=0, y=-160))
    layer.append(el("ExitState", x=550, y=-160))
    entry = el("EntryState", x=0, y=80)
    entry.append(el("StateTransition", stateToId="40:20", duration=0))
    layer.append(entry)
    for index, (name, value, state_id, anim_id, other_id) in enumerate([
        ('Camp outfit', '40:6', '40:20', '40:30', '40:21'),
        ('Trail outfit', '40:5', '40:21', '40:31', '40:20'),
    ]):
        state = el("AnimationState", id=state_id, animationId=anim_id, x=240+index*270, y=80)
        transition = el("StateTransition", stateToId=other_id, duration=0)
        condition = el("TransitionViewModelCondition", opValue="equal")
        comparator = el("TransitionPropertyViewModelComparator")
        bindable = el("BindablePropertyEnum")
        bindable.append(el("DataBindContext", sourcePathIds="40:1-40:2", propertyKey=637))
        comparator.append(bindable)
        condition.append(comparator)
        condition.append(el("TransitionValueEnumComparator", value=value))
        transition.append(condition)
        state.append(transition)
        layer.append(state)
        animation = el("LinearAnimation", name=name, id=anim_id, fps=60, duration=1)
        for camp_id, trail_id in group_ids:
            for target, opacity in [(camp_id, 1-index), (trail_id, index)]:
                keyed = el("KeyedObject", objectId=target)
                prop = el("KeyedProperty", property="opacity")
                prop.append(el("KeyFrameDouble", frame=0, value=opacity))
                keyed.append(prop)
                animation.append(keyed)
        board.append(animation)
    machine.append(layer)
    # Preserve the authored IDs in the source; allocate only new objects.
    next_id = 100
    for node in root.iter():
        if node is root or node.tag == "BindablePropertyEnum":
            continue
        if not node.get("id"):
            node.set("id", f"40:{next_id}")
            next_id += 1
    ET.indent(tree)
    tree.write(destination, encoding="unicode")
    print(destination)


if __name__ == "__main__":
    make_draft()
