#!/usr/bin/env python3
"""Author editable RML geometry and five deterministic campfire timelines."""

from math import atan2, hypot, pi, sin
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
INK = "473124"
WOOD = "96623D"
GOLD = "FFC557"
STAGES = ["Sleeping", "Beginning", "Active", "Lively", "Surplus"]
uid = 1000


def el(tag, **attrs):
    return ET.Element(tag, {k: str(v) for k, v in attrs.items()})


def ident():
    global uid
    uid += 1
    return f"0:{uid}"


def paint(shape, color, stroke=0, outline=INK):
    if color:
        fill = ET.SubElement(shape, "Fill")
        fill.append(el("SolidColor", colorValue="FF" + color))
    if stroke:
        line = ET.SubElement(shape, "Stroke", thickness=str(stroke), cap="round", join="round")
        line.append(el("SolidColor", colorValue="FF" + outline))
    return shape


def ellipse(name, x, y, w, h, color, stroke=0, **attrs):
    shape = el("Shape", name=name, x=x, y=y, **attrs)
    shape.append(el("Ellipse", width=w, height=h))
    return paint(shape, color, stroke)


def polygon(name, points, color, stroke=0, radius=0, **attrs):
    shape = el("Shape", name=name, **attrs)
    path = ET.SubElement(shape, "PointsPath", isClosed="true", isClockwise="true")
    for x, y in points:
        path.append(el("StraightVertex", x=x, y=y, radius=radius))
    return paint(shape, color, stroke)


def curve(name, start, segments, color=None, stroke=0, closed=True, **attrs):
    """SVG-like cubic segments → Rive's polar detached handles."""
    shape = el("Shape", name=name, **attrs)
    path = ET.SubElement(shape, "PointsPath", isClosed=str(closed).lower(), isClockwise="true")
    anchors = [start] + [s[2] for s in segments]
    if closed:
        anchors.pop()  # last segment returns to the first vertex
    vertices = []
    for i, point in enumerate(anchors):
        incoming = segments[(i - 1) % len(segments)][1] if closed or i else point
        outgoing = segments[i][0] if i < len(segments) else point
        a, b = incoming[0] - point[0], incoming[1] - point[1]
        c, d = outgoing[0] - point[0], outgoing[1] - point[1]
        vertex = el("CubicDetachedVertex", id=ident(), x=point[0], y=point[1],
                    inRotation=atan2(b, a), inDistance=hypot(a, b),
                    outRotation=atan2(d, c), outDistance=hypot(c, d))
        path.append(vertex)
        vertices.append(vertex)
    return paint(shape, color, stroke), vertices


def line(name, start, segments, color=INK, width=2):
    shape, _ = curve(name, start, segments, stroke=width, closed=False)
    shape.find("Stroke/SolidColor").set("colorValue", "FF" + color)
    return shape


def group(name, children, **attrs):
    node = el("Node", name=name, **attrs)
    node.extend(reversed(children))  # Rive siblings draw front first.
    return node


def log(name, x, y, length, angle, size=1):
    children = []
    children.append(polygon("Bark", [(-length/2, -12), (length/2-8, -12),
                       (length/2+1, -4), (length/2, 9), (-length/2, 13)], WOOD, 3.2, 7))
    children.append(polygon("Bark light", [(-length/2+6, -9), (length/2-12, -9),
                       (length/2-7, -3), (-length/2+6, -3)], "B17C47", 0, 3))
    children.append(line("Grain 1", (-length*.25, 4), [((-10, 1), (0, 4), (12, 1))], width=1.8))
    children.append(line("Grain 2", (length*.25, -2), [((length*.28, -1), (length*.32, -2), (length*.36, -4))], width=1.8))
    children.append(ellipse("Cut end", -length/2, 0, 20, 28, "E7B464", 3))
    children.append(line("Growth ring", (-length/2+2, -7), [((-length/2-6, -8), (-length/2-6, 7), (-length/2+1, 8))], color="936038", width=1.8))
    return group(name, children, x=x, y=y, rotation=angle, scaleX=size, scaleY=size)


root = el("Rive", version="1", kind="fragment")
board = ET.SubElement(root, "Artboard", width="400", height="400", name="Campfire", id="0:1",
                      styleId="0:5", defaultStateMachineId="0:7", viewModelId="0:40", viewModelInstanceId="0:41")
board.append(el("LayoutComponentStyle", id="0:5", name="Campfire Style"))
layers = []
layers.append(ellipse("Ground shadow", 202, 307, 214, 33, "314831", opacity=.08))
glow = ellipse("Warm ground", 198, 293, 217, 69, "FFCA65", opacity=.16, id="0:60")
layers.append(glow)
layers.append(ellipse("Hearth", 192, 291, 151, 48, "62513D", 3))

def stone(name, x, y, w, h, color, angle=0):
    p = [(-w*.48, -h*.1), (-w*.32, -h*.48), (w*.18, -h*.5),
         (w*.48, -h*.08), (w*.35, h*.4), (-w*.28, h*.48)]
    return polygon(name, p, color, 2.8, 7, x=x, y=y, rotation=angle)

for n, args in enumerate([(134,280,39,25,"9D9C84",-.2),(171,274,37,23,"ADAD90",.15),
                          (212,275,39,24,"9C9B83",-.1),(251,284,36,27,"A5A38B",.2)]):
    layers.append(stone(f"Rear stone {n+1}", *args))
layers.append(log("Rear log", 193, 283, 115, -.21, .9))
reserve = group("Surplus reserve", [log("Reserve lower", 284, 301, 60, -.12, .8),
                                   log("Reserve upper", 289, 284, 48, .12, .8)], id="0:61", opacity=0)
layers.append(reserve)
coals = group("Embers", [ellipse("Ember left", 163, 285, 17, 7, "E67C3A"),
                         ellipse("Ember middle", 190, 289, 24, 9, "F5A343"),
                         ellipse("Ember right", 222, 285, 15, 7, "E67C3A")], id="0:62", opacity=.6)
layers.append(coals)

# Twelve asymmetric anchors. The root stays fixed while each upper vertex sways.
start = (0, 8)
segments = [
    ((-17, 10), (-42, 4), (-51, -10)),
    ((-68, -31), (-65, -54), (-54, -74)),
    ((-47, -87), (-40, -99), (-41, -113)),
    ((-27, -103), (-27, -89), (-31, -73)),
    ((-4, -94), (-8, -148), (18, -172)),
    ((12, -137), (40, -122), (44, -91)),
    ((47, -78), (45, -69), (43, -61)),
    ((57, -67), (62, -80), (63, -92)),
    ((78, -70), (81, -40), (70, -19)),
    ((59, 5), (26, 11), (0, 8)),
]
flames = []
for index, (name, color, sx, sy, ox, oy) in enumerate([
        ("Outer flame", "EC7633", 1, 1, 0, 0),
        ("Golden flame", GOLD, .67, .67, -1, 4),
        ("Cream heart", "FFF0BF", .33, .36, 2, 5)]):
    layer_segments = segments
    if index == 2:
        # A single soft tongue stays legible at the actual size in camp.
        layer_segments = [
            ((-24, 9), (-48, -4), (-54, -27)),
            ((-64, -53), (-30, -91), (-17, -116)),
            ((-8, -133), (-3, -155), (1, -172)),
            ((6, -134), (19, -112), (35, -89)),
            ((58, -58), (65, -27), (43, -7)),
            ((30, 6), (15, 9), (0, 8)),
        ]
    shape, vertices = curve(name, start, layer_segments, color, 3 if index == 0 else 2.1,
                            x=192, y=283, id=f"0:{70+index}")
    layers.append(shape)
    flames.append((shape, vertices, sx, sy, ox, oy))

layers.append(log("Cross log back", 192, 300, 128, .28))
layers.append(log("Cross log front", 192, 303, 127, -.32))
for n, args in enumerate([(123,299,34,27,"92937F",-.2),(148,317,39,26,"B5B29A",.06),
                          (191,324,42,25,"A09F88",-.06),(234,317,40,27,"BBB69B",-.15),
                          (266,302,33,26,"969781",.15)]):
    layers.append(stone(f"Front stone {n+1}", *args))

# Only two slow, independently travelling sparks in the liveliest states.
for i in range(2):
    layers.append(ellipse(f"Spark {i+1}", 191+i*27, 100, 4, 7, "F4AE48", id=f"0:{80+i}", opacity=0))
board.extend(reversed(layers))

machine = ET.SubElement(board, "StateMachine", name="Campfire", id="0:7")
layer = ET.SubElement(machine, "StateMachineLayer", name="Contribution stage", id="0:8")
any_state = ET.SubElement(layer, "AnyState", x="0", y="-120")
for stage in range(5):
    transition = ET.SubElement(any_state, "StateTransition", stateToId=f"0:{200+stage}", duration="400")
    condition = ET.SubElement(transition, "TransitionViewModelCondition", opValue="equal")
    comparator = ET.SubElement(condition, "TransitionPropertyViewModelComparator")
    bindable = ET.SubElement(comparator, "BindablePropertyNumber")
    bindable.append(el("DataBindContext", sourcePathIds="0:40-0:45", propertyKey="636"))
    condition.append(el("TransitionValueNumberComparator", value=stage))
layer.append(el("ExitState", x=200, y=-120))
entry = ET.SubElement(layer, "EntryState", x="0", y="120")
entry.append(el("StateTransition", stateToId="0:200"))
for stage in range(5):
    layer.append(el("AnimationState", x=160+stage*160, y=120, animationId=f"0:{100+stage}", id=f"0:{200+stage}"))


def keys(animation, object_id, props):
    obj = ET.SubElement(animation, "KeyedObject", objectId=object_id)
    for prop, samples in props.items():
        keyed = ET.SubElement(obj, "KeyedProperty", property=prop)
        for frame, value in samples:
            keyed.append(el("KeyFrameDouble", frame=frame, value=round(value, 5), interpolationType="linear"))


for stage, name in enumerate(STAGES):
    animation = ET.SubElement(board, "LinearAnimation", name=name, id=f"0:{100+stage}", fps="60", duration="240", loopValue="loop")
    # Contribution changes the silhouette. Motion never moves the base or logs.
    width, height = [(0.3, .22), (.40, .34), (.72, .72), (.95, .95), (1.02, 1.0)][stage]
    keys(animation, "0:60", {"opacity": [(0, [0, .08, .13, .18, .22][stage])]})
    keys(animation, "0:61", {"opacity": [(0, int(stage == 4))]})
    keys(animation, "0:62", {"opacity": [(0, [.10, .45, .7, .9, .9][stage])]})
    for index, (shape, vertices, sx, sy, ox, oy) in enumerate(flames):
        keys(animation, shape.get("id"), {"opacity": [(0, 0 if stage == 0 else (0 if index == 2 and stage == 1 else 1))]})
        for vertex_index, vertex in enumerate(vertices):
            x, y = float(vertex.get("x")), float(vertex.get("y"))
            amplitude = max(0, -y-10) / 172
            phase = vertex_index * .91 + index * 1.7
            props = {"x": [], "y": []}
            for frame in range(0, 241, 15):
                time = frame / 240 * 2*pi
                sway = (sin(time*2+phase)*3.5 + sin(time+phase)*2) * amplitude
                rise = sin(time*3+phase)*3.2 * amplitude
                props["x"].append((frame, (x+sway)*width*sx+ox))
                props["y"].append((frame, (y+rise)*height*sy+oy))
            # Handle lengths and directions track the independently sized layers.
            for side in ("in", "out"):
                from math import cos
                rotation = float(vertex.get(side+"Rotation"))
                distance = float(vertex.get(side+"Distance"))
                dx, dy = cos(rotation)*distance*width*sx, sin(rotation)*distance*height*sy
                props[side+"Rotation"] = [(0, atan2(dy, dx))]
                props[side+"Distance"] = [(0, hypot(dx, dy))]
            keys(animation, vertex.get("id"), props)
    for spark in range(2):
        offset = spark*120
        props = {"x": [], "y": [], "opacity": []}
        for frame in range(0, 241, 15):
            phase = ((frame+offset) % 240) / 240
            props["x"].append((frame, 184+spark*36+sin(phase*pi*2)*7))
            props["y"].append((frame, 174-phase*85))
            props["opacity"].append((frame, max(0, sin(phase*pi))*0.75 if stage >= 3 else 0))
        keys(animation, f"0:{80+spark}", props)

vm = ET.SubElement(root, "ViewModel", defaultInstanceId="0:41", name="Campfire", id="0:40")
vm.append(el("ViewModelPropertyNumber", name="stage", id="0:45"))
instance = ET.SubElement(vm, "ViewModelInstance", exports="true", name="Default", id="0:41")
instance.append(el("ViewModelInstanceNumber", propertyValue=2, viewModelPropertyId="0:45"))
ET.indent(root, space="  ")
(ROOT / "scene.rml").write_text(ET.tostring(root, encoding="unicode") + "\n")
print("Authored scene.rml: 5 stages, 3 editable flame contours, 4-second loops.")
