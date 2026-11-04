"""Small SVG-path-to-RML authoring helper; output contains editable vectors."""
import math
import re
import xml.etree.ElementTree as ET


def el(tag, **attrs):
    return ET.Element(tag, {key: str(value) for key, value in attrs.items()})


def path(name, data, color=None, stroke=3.8, ink="24241B"):
    """Absolute M/L/C/Q/Z subset, with one subpath per shape."""
    tokens = re.findall(r"[MLCQZ]|-?\d+(?:\.\d+)?", data)
    points, incoming, outgoing = [], [], []
    index, closed = 0, False
    while index < len(tokens):
        command = tokens[index]
        index += 1
        count = {"M": 2, "L": 2, "C": 6, "Q": 4, "Z": 0}[command]
        values = [float(v) for v in tokens[index:index + count]]
        index += count
        if command == "Z":
            closed = True
            break
        target = tuple(values[-2:])
        if command == "M":
            points.append(target); incoming.append(target); outgoing.append(target)
            continue
        source = points[-1]
        if command == "C":
            c1, c2 = tuple(values[:2]), tuple(values[2:4])
        elif command == "Q":
            q = tuple(values[:2])
            c1 = tuple(source[k] + (q[k]-source[k])*2/3 for k in (0, 1))
            c2 = tuple(target[k] + (q[k]-target[k])*2/3 for k in (0, 1))
        else:
            c1, c2 = source, target
        outgoing[-1] = c1
        if target == points[0] and index < len(tokens) and tokens[index] == "Z":
            incoming[0] = c2
        else:
            points.append(target); incoming.append(c2); outgoing.append(target)
    shape = el("Shape", name=name)
    area = sum(points[i][0]*points[(i+1)%len(points)][1] - points[(i+1)%len(points)][0]*points[i][1] for i in range(len(points)))
    geometry = ET.SubElement(shape, "PointsPath", isClosed=str(closed).lower(), isClockwise=str(area >= 0).lower())
    for (x, y), inc, out in zip(points, incoming, outgoing):
        geometry.append(el("CubicDetachedVertex", x=x, y=y,
            inRotation=math.atan2(inc[1]-y, inc[0]-x), inDistance=math.hypot(inc[0]-x, inc[1]-y),
            outRotation=math.atan2(out[1]-y, out[0]-x), outDistance=math.hypot(out[0]-x, out[1]-y)))
    if color:
        fill = ET.SubElement(shape, "Fill")
        fill.append(el("SolidColor", colorValue=("FF"+color if len(color)==6 else color)))
    if stroke:
        outline = ET.SubElement(shape, "Stroke", thickness=str(stroke), cap="round", join="round")
        outline.append(el("SolidColor", colorValue="FF"+ink))
    return shape


def ellipse(name, x, y, width, height, color, ident=None):
    shape = el("Shape", name=name, x=x, y=y)
    if ident:
        shape.set("id", ident)
    shape.append(el("Ellipse", width=width, height=height))
    fill = ET.SubElement(shape, "Fill")
    fill.append(el("SolidColor", colorValue="FF"+color))
    return shape


def group(name, layers, **attrs):
    node = el("Node", name=name, **attrs)
    node.extend(reversed(layers))
    return node


def wave(ident, prop, base, amount, cycles=1):
    return {"id": ident, "property": prop,
            "keys": [(f, round(base + amount * math.sin(2*math.pi*f/360*cycles), 6)) for f in range(0, 361, 6)]}
