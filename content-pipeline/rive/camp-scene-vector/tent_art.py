"""Editable vector tracing of the base camp tent (1563 × 1006).

``build_tent`` returns back-to-front ET layers and property tracks for a
six-second 60 fps loop. The cloth and open doorway follow the source artwork;
stakes, guy ropes, the front ridge pole and rolled canopy remain fixed.
All motion deforms path vertices and their Bezier handles, not a raster or a
whole-object scale. The assembly owns the artboard and Rive's layer reversal.
"""

from math import atan2, cos, exp, hypot, pi, sin
import xml.etree.ElementTree as ET


WIDTH, HEIGHT = 1563, 1006
FPS, DURATION = 60, 360
INK = "140D08"


def _el(tag, **attrs):
    return ET.Element(tag, {key: str(value) for key, value in attrs.items()})


def _warp(x, y, frame, mode):
    if frame in (0, DURATION):
        return x, y
    t = 2 * pi * frame / DURATION
    if mode == "flap-left":
        # The roll fixes the upper edge; the long free hem moves more below it.
        depth = max(0, min(1, (y - 458) / 330))
        wave = sin(2 * t) * .72 + sin(3 * t) * .28
        return x + 5.2 * depth ** 1.5 * wave, y + 2.2 * depth * sin(2 * t)
    if mode == "flap-right":
        depth = max(0, min(1, (y - 446) / 296))
        wave = sin(2 * t) * .65 - sin(3 * t) * .35
        return x + 4.3 * depth ** 1.4 * wave, y + 1.7 * depth * sin(3 * t)
    # Broad canvas breathes between the taut ridge and pegged corners.
    # Smooth pin envelopes keep shared corners and the straight ridge fixed.
    pins = ((1017, 175, 85), (598, 241, 95), (218, 727, 85),
            (674, 803, 110), (1390, 711, 95))
    weight = 1.0
    for px, py, radius in pins:
        weight *= 1 - exp(-((x - px) ** 2 + (y - py) ** 2) / radius ** 2)
    # Distance from the front pole's line; its seam stays taut.
    pole_x = 1017 - (y - 175) * 343 / 628
    weight *= 1 - exp(-((x - pole_x) / 62) ** 2)
    field = sin(2 * t) * .75 + sin(3 * t) * .25
    return x + 3.4 * weight * field, y + 2.7 * weight * sin(2 * t)


def build_tent():
    """Return ``(layers, tracks)`` using IDs in the ``2:`` namespace."""
    layers, tracks = [], []
    next_id = 100

    def curve(name, start, segments, color=None, stroke=4.4, closed=True,
              gradient=None, motion=None):
        nonlocal next_id
        shape = _el("Shape", name=name, x=0, y=0, id=f"2:{next_id}")
        next_id += 1
        path = ET.SubElement(shape, "PointsPath", isClosed=str(closed).lower(),
                             isClockwise="true")
        anchors = [start] + [segment[2] for segment in segments]
        if closed:
            assert anchors[-1] == start, name
            anchors.pop()
        for index, point in enumerate(anchors):
            incoming = segments[(index - 1) % len(segments)][1] if closed or index else point
            outgoing = segments[index][0] if index < len(segments) else point
            ix, iy = incoming[0] - point[0], incoming[1] - point[1]
            ox, oy = outgoing[0] - point[0], outgoing[1] - point[1]
            vertex = _el("CubicDetachedVertex", id=f"2:{next_id}",
                         x=point[0], y=point[1],
                         inRotation=atan2(iy, ix), inDistance=hypot(ix, iy),
                         outRotation=atan2(oy, ox), outDistance=hypot(ox, oy))
            next_id += 1
            path.append(vertex)
            if motion:
                values = {key: [] for key in ("x", "y", "inRotation", "inDistance", "outRotation", "outDistance")}
                for frame in range(0, DURATION + 1, 6):
                    px, py = _warp(*point, frame, motion)
                    values["x"].append((frame, px))
                    values["y"].append((frame, py))
                    for side, control in (("in", incoming), ("out", outgoing)):
                        qx, qy = _warp(*control, frame, motion)
                        angle = atan2(qy - py, qx - px)
                        reference = float(vertex.get(side + "Rotation"))
                        angle = reference + (angle - reference + pi) % (2 * pi) - pi
                        values[side + "Rotation"].append((frame, angle))
                        values[side + "Distance"].append((frame, hypot(qx - px, qy - py)))
                for prop, keys in values.items():
                    rounded = [(frame, round(value, 6)) for frame, value in keys]
                    if len({value for _, value in rounded}) > 1:
                        tracks.append({"id": vertex.get("id"), "property": prop, "keys": rounded})
        if color:
            fill = ET.SubElement(shape, "Fill")
            if gradient:
                sx, sy, ex, ey, end = gradient
                paint = _el("LinearGradient", startX=sx, startY=sy, endX=ex, endY=ey)
                paint.append(_el("GradientStop", colorValue="FF" + color, position=0))
                paint.append(_el("GradientStop", colorValue="FF" + end, position=1))
                fill.append(paint)
            else:
                fill.append(_el("SolidColor", colorValue="FF" + color))
        if stroke:
            outline = ET.SubElement(shape, "Stroke", thickness=str(stroke), cap="round", join="round")
            outline.append(_el("SolidColor", colorValue="FF" + INK))
        layers.append(shape)
        return shape

    def line(name, start, segments, width=4.1, motion=None):
        return curve(name, start, segments, stroke=width, closed=False, motion=motion)

    # Guy ropes are behind the canvas and never receive animation keys.
    line("Tent left guy rope", (336, 612), [
        ((270, 668), (201, 708), (132, 739)),
    ], 4.2)
    line("Tent right guy rope", (1299, 610), [
        ((1350, 653), (1405, 691), (1452, 711)),
    ], 4.2)

    curve("Tent orange canvas silhouette", (598, 241), [
        ((718, 248), (913, 224), (1013, 176)),
        ((1023, 166), (1043, 200), (1054, 229)),
        ((1080, 291), (1121, 345), (1167, 409)),
        ((1224, 491), (1261, 555), (1304, 600)),
        ((1334, 633), (1366, 676), (1389, 708)),
        ((1396, 716), (1370, 718), (1350, 721)),
        ((1306, 727), (1269, 737), (1227, 742)),
        ((1117, 758), (1034, 762), (946, 772)),
        ((851, 787), (751, 789), (674, 803)),
        ((565, 774), (512, 758), (425, 749)),
        ((354, 742), (268, 742), (220, 729)),
        ((210, 726), (230, 710), (242, 697)),
        ((336, 604), (414, 510), (475, 422)),
        ((530, 346), (573, 279), (592, 245)),
        ((594, 242), (595, 241), (598, 241)),
    ], "F98932", 5.0, gradient=(700, 240, 830, 800, "F67F2D"), motion="canvas")

    # The dark opening is an interior, not a black patch painted over a closed
    # tent. Its silhouette is covered by the independently animated cloth hems.
    curve("Tent open doorway interior", (952, 445), [
        ((998, 448), (1044, 444), (1090, 443)),
        ((1113, 548), (1145, 671), (1214, 730)),
        ((1220, 736), (1227, 739), (1232, 741)),
        ((1132, 757), (995, 762), (879, 782)),
        ((916, 687), (938, 557), (952, 445)),
    ], "493024", 3.8, gradient=(958, 460, 1100, 757, "4F3326"))

    curve("Tent left doorway canvas flap", (916, 449), [
        ((929, 451), (947, 453), (963, 450)),
        ((945, 548), (927, 650), (905, 726)),
        ((899, 751), (892, 774), (873, 783)),
        ((852, 794), (813, 796), (788, 787)),
        ((842, 693), (888, 563), (916, 449)),
    ], "EFBB7D", 4.4, gradient=(927, 463, 817, 789, "EDB677"), motion="flap-left")

    curve("Tent right doorway canvas flap", (1086, 443), [
        ((1098, 441), (1112, 441), (1125, 440)),
        ((1163, 554), (1216, 657), (1284, 732)),
        ((1268, 741), (1238, 749), (1214, 737)),
        ((1154, 695), (1117, 558), (1086, 443)),
    ], "EDB578", 4.4, gradient=(1090, 447, 1258, 734, "EAB171"), motion="flap-right")

    # Front ridge/pole is fixed to the visible central ground peg.
    line("Tent taut front ridge", (1017, 177), [
        ((939, 322), (812, 547), (675, 796)),
    ], 5.0)
    line("Tent lower ridge seam", (733, 697), [
        ((712, 735), (694, 771), (677, 802)),
    ], 3.5)

    # Tapered hand-drawn folds retain the line character of the source.
    curve("Tent left long canvas fold", (580, 342), [
        ((548, 419), (499, 518), (450, 575)),
        ((498, 508), (543, 414), (580, 342)),
    ], INK, 0, motion="canvas")
    curve("Tent upper long canvas fold", (871, 298), [
        ((849, 360), (804, 431), (765, 474)),
        ((803, 421), (842, 352), (871, 298)),
    ], INK, 0, motion="canvas")
    curve("Tent left hem fold", (404, 642), [
        ((376, 672), (313, 704), (266, 718)),
        ((315, 697), (369, 669), (404, 642)),
    ], INK, 0, motion="canvas")
    curve("Tent front lower canvas fold", (804, 642), [
        ((797, 679), (784, 711), (770, 734)),
        ((781, 700), (792, 669), (804, 642)),
    ], INK, 0, motion="canvas")
    curve("Tent peak fold", (1028, 218), [
        ((1042, 246), (1056, 294), (1063, 333)),
        ((1047, 298), (1037, 257), (1028, 218)),
    ], INK, 0, motion="canvas")
    curve("Tent right canvas fold", (1241, 585), [
        ((1256, 607), (1272, 627), (1290, 649)),
        ((1267, 633), (1250, 610), (1241, 585)),
    ], INK, 0, motion="canvas")
    curve("Tent left flap fold", (883, 660), [
        ((870, 691), (844, 728), (818, 758)),
        ((843, 721), (866, 685), (883, 660)),
    ], INK, 0, motion="flap-left")
    curve("Tent right flap fold", (1192, 635), [
        ((1205, 650), (1224, 678), (1236, 693)),
        ((1218, 679), (1201, 653), (1192, 635)),
    ], INK, 0, motion="flap-right")

    # The tied-up entrance cover is a separate stable assembly.
    curve("Tent rolled entrance cover", (935, 389), [
        ((995, 386), (1061, 387), (1125, 381)),
        ((1144, 378), (1153, 387), (1154, 411)),
        ((1155, 433), (1146, 444), (1130, 445)),
        ((1069, 453), (1004, 457), (943, 455)),
        ((929, 447), (923, 407), (935, 389)),
    ], "F1C082", 4.6, gradient=(975, 388, 1001, 453, "E7AE70"))
    curve("Tent roll left binding", (937, 386), [
        ((947, 376), (958, 387), (962, 408)),
        ((966, 424), (966, 448), (957, 458)),
        ((950, 463), (944, 457), (939, 455)),
        ((947, 435), (944, 404), (937, 386)),
    ], "C48E56", 4.1, gradient=(941, 389, 959, 452, "B67D48"))
    curve("Tent roll right binding", (1097, 379), [
        ((1104, 371), (1114, 376), (1118, 385)),
        ((1126, 406), (1127, 429), (1117, 446)),
        ((1112, 453), (1105, 451), (1099, 446)),
        ((1109, 429), (1110, 401), (1097, 379)),
    ], "C38C53", 4.1, gradient=(1104, 381, 1118, 446, "B27B47"))
    curve("Tent rolled cover left end", (927, 391), [
        ((940, 387), (947, 405), (948, 424)),
        ((949, 445), (942, 460), (927, 461)),
        ((910, 462), (904, 445), (906, 423)),
        ((906, 406), (913, 392), (927, 391)),
    ], "F2C587", 4.4, gradient=(911, 396, 944, 452, "ECC084"))
    line("Tent rolled cover spiral", (916, 431), [
        ((910, 416), (915, 402), (921, 402)),
        ((928, 402), (931, 421), (928, 437)),
        ((926, 451), (918, 448), (918, 435)),
        ((918, 429), (919, 424), (921, 421)),
    ], 3.7)

    # Three grounded stakes. Geometry, attachment loops and ropes are static.
    curve("Tent left stake", (97, 723), [
        ((103, 718), (115, 713), (124, 713)),
        ((129, 733), (137, 758), (141, 783)),
        ((136, 788), (129, 790), (121, 788)),
        ((114, 768), (105, 745), (97, 723)),
    ], "86603E", 4.5, gradient=(101, 719, 138, 787, "725336"))
    curve("Tent left stake rope wrap", (104, 745), [
        ((115, 752), (127, 747), (137, 739)),
        ((143, 738), (146, 741), (142, 747)),
        ((129, 756), (117, 759), (107, 751)),
        ((103, 750), (102, 747), (104, 745)),
    ], "9B754D", 4.0)
    curve("Tent front stake", (628, 777), [
        ((634, 771), (647, 767), (655, 767)),
        ((661, 788), (667, 819), (673, 844)),
        ((668, 849), (659, 852), (650, 849)),
        ((644, 829), (636, 801), (628, 777)),
    ], "8A6242", 4.5, gradient=(630, 778, 671, 846, "745336"))
    curve("Tent front stake rope loop", (631, 802), [
        ((638, 810), (656, 806), (668, 795)),
        ((670, 789), (678, 791), (675, 799)),
        ((664, 815), (643, 819), (633, 810)),
        ((628, 806), (628, 804), (631, 802)),
    ], "A07950", 4.0)
    curve("Tent right stake", (1457, 679), [
        ((1465, 677), (1476, 681), (1485, 687)),
        ((1479, 708), (1468, 738), (1459, 753)),
        ((1453, 756), (1447, 756), (1441, 753)),
        ((1446, 727), (1451, 698), (1457, 679)),
    ], "87613E", 4.5, gradient=(1464, 682, 1453, 750, "725236"))
    curve("Tent right stake rope wrap", (1447, 708), [
        ((1457, 716), (1467, 720), (1476, 713)),
        ((1479, 715), (1476, 721), (1472, 723)),
        ((1464, 728), (1452, 721), (1446, 715)),
        ((1443, 712), (1444, 708), (1447, 708)),
    ], "9E774E", 4.0)

    return layers, tracks
