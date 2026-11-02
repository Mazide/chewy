"""Editable vector tracing of camp-v3-flat/fire.png (1312 × 1199).

Coordinates retain the source canvas. ``build_art`` returns shapes in visual
back-to-front order and the three editable flame contours. The caller owns
animation, artboard scale and the reversal of Rive's front-first draw order.
No bitmap, stone ring or additional decoration is introduced.
"""

from math import atan2, hypot
import xml.etree.ElementTree as ET


WIDTH, HEIGHT = 1312, 1199
INK = "110B07"


def _el(tag, **attrs):
    return ET.Element(tag, {key: str(value) for key, value in attrs.items()})


def build_art():
    """Return ``(layers, [{shape, vertices, name}, ...])`` in source units."""
    next_id = 1000
    layers = []
    flames = []

    def curve(name, start, segments, color=None, stroke=10.5, closed=True,
              gradient=None, shape_id=None):
        nonlocal next_id
        shape = _el("Shape", name=name, x=0, y=0)
        if shape_id:
            shape.set("id", shape_id)
        path = ET.SubElement(shape, "PointsPath", isClosed=str(closed).lower(),
                             isClockwise="true")
        anchors = [start] + [segment[2] for segment in segments]
        if closed:
            assert anchors[-1] == start, name
            anchors.pop()
        vertices = []
        for index, point in enumerate(anchors):
            incoming = segments[(index - 1) % len(segments)][1] if closed or index else point
            outgoing = segments[index][0] if index < len(segments) else point
            ix, iy = incoming[0] - point[0], incoming[1] - point[1]
            ox, oy = outgoing[0] - point[0], outgoing[1] - point[1]
            vertex = _el("CubicDetachedVertex", id=f"0:{next_id}",
                         x=point[0], y=point[1],
                         inRotation=atan2(iy, ix), inDistance=hypot(ix, iy),
                         outRotation=atan2(oy, ox), outDistance=hypot(ox, oy))
            next_id += 1
            path.append(vertex)
            vertices.append(vertex)
        if color:
            fill = ET.SubElement(shape, "Fill")
            if gradient:
                start_x, start_y, end_x, end_y, end_color = gradient
                paint = _el("LinearGradient", startX=start_x, startY=start_y,
                            endX=end_x, endY=end_y)
                paint.append(_el("GradientStop", colorValue="FF" + color, position=0))
                paint.append(_el("GradientStop", colorValue="FF" + end_color, position=1))
                fill.append(paint)
            else:
                fill.append(_el("SolidColor", colorValue="FF" + color))
        if stroke:
            outline = ET.SubElement(shape, "Stroke", thickness=str(stroke),
                                    cap="round", join="round")
            outline.append(_el("SolidColor", colorValue="FF" + INK))
        return shape, vertices

    def body(name, start, segments, color, gradient=None, stroke=10.5):
        shape, _ = curve(name, start, segments, color, stroke, gradient=gradient)
        layers.append(shape)
        return shape

    def grain(name, start, segments, width=7.3):
        shape, _ = curve(name, start, segments, stroke=width, closed=False)
        layers.append(shape)

    # Rear-left wood sits behind the fire. Its exposed left end has the exact
    # narrow, upright silhouette of the source rather than a generic circle.
    body("Rear left log bark", (329, 706), [
        ((367, 699), (432, 719), (493, 744)),
        ((565, 766), (637, 788), (704, 815)),
        ((726, 831), (710, 891), (673, 924)),
        ((574, 919), (448, 890), (329, 873)),
        ((284, 863), (274, 738), (329, 706)),
    ], "865735", (330, 711, 698, 928, "74472B"))

    # A short right-facing trunk is visible above the front crossing.
    body("Rear right log bark", (645, 802), [
        ((734, 777), (876, 755), (947, 761)),
        ((974, 762), (993, 789), (997, 819)),
        ((1002, 855), (983, 884), (942, 902)),
        ((848, 890), (736, 862), (645, 836)),
        ((634, 827), (634, 812), (645, 802)),
    ], "865735", (660, 785, 954, 901, "794A2C"))

    outer, vertices = curve("Outer orange flame", (675, 826), [
        ((594, 809), (489, 778), (430, 725)),
        ((379, 681), (371, 632), (386, 570)),
        ((397, 510), (432, 456), (464, 402)),
        ((484, 368), (494, 329), (505, 319)),
        ((518, 315), (540, 358), (527, 413)),
        ((570, 370), (588, 307), (604, 236)),
        ((618, 173), (643, 129), (688, 103)),
        ((678, 170), (704, 207), (750, 251)),
        ((814, 315), (844, 399), (820, 494)),
        ((850, 486), (872, 441), (887, 406)),
        ((915, 440), (943, 534), (947, 599)),
        ((951, 679), (916, 730), (849, 776)),
        ((802, 793), (735, 810), (675, 826)),
    ], "E8602A", 10.6, gradient=(650, 115, 665, 822, "E65C27"), shape_id="0:70")
    layers.append(outer)
    flames.append({"shape": outer, "vertices": vertices, "name": "Outer orange flame"})

    gold, vertices = curve("Golden flame", (707, 829), [
        ((630, 811), (552, 781), (507, 725)),
        ((474, 684), (467, 644), (475, 599)),
        ((482, 561), (504, 519), (522, 503)),
        ((526, 529), (537, 553), (557, 560)),
        ((569, 507), (601, 469), (630, 430)),
        ((656, 394), (672, 365), (673, 332)),
        ((706, 358), (733, 409), (747, 479)),
        ((757, 537), (784, 557), (790, 610)),
        ((811, 599), (829, 578), (841, 558)),
        ((861, 593), (865, 641), (856, 676)),
        ((844, 739), (797, 788), (733, 824)),
        ((725, 830), (717, 832), (707, 829)),
    ], "FFBF3E", 9.0, gradient=(669, 337, 690, 822, "F7BB3D"), shape_id="0:71")
    layers.append(gold)
    flames.append({"shape": gold, "vertices": vertices, "name": "Golden flame"})

    heart, vertices = curve("Cream flame heart", (704, 816), [
        ((675, 807), (648, 799), (619, 790)),
        ((582, 758), (569, 728), (581, 690)),
        ((591, 656), (616, 637), (634, 608)),
        ((652, 577), (665, 541), (676, 533)),
        ((683, 579), (692, 606), (711, 634)),
        ((736, 669), (751, 698), (750, 730)),
        ((751, 767), (729, 797), (704, 816)),
    ], "FFF0CF", 9.2, gradient=(670, 539, 670, 818, "FAE9C5"), shape_id="0:72")
    layers.append(heart)
    flames.append({"shape": heart, "vertices": vertices, "name": "Cream flame heart"})

    # The front crossing follows the original outline and masks the flame root.
    # The small exposed stroke at left belongs to this same continuous log.
    body("Front right log bark", (451, 766), [
        ((520, 781), (606, 783), (660, 801)),
        ((763, 844), (879, 885), (979, 925)),
        ((1016, 941), (1018, 1017), (979, 1069)),
        ((962, 1088), (938, 1088), (912, 1075)),
        ((811, 1029), (732, 1003), (674, 969)),
        ((578, 924), (458, 893), (329, 873)),
        ((350, 858), (364, 829), (366, 793)),
        ((368, 759), (350, 716), (329, 707)),
        ((368, 700), (411, 714), (435, 720)),
        ((465, 746), (488, 764), (513, 778)),
        ((487, 774), (466, 770), (451, 766)),
    ], "835332", (405, 740, 947, 1071, "79492C"), stroke=9.8)

    # Upright left cut, the low front-right cut, then the largest tilted cut at
    # front-left. They intentionally differ in size, tilt and growth rings.
    body("Rear left log cut", (329, 710), [
        ((354, 717), (374, 754), (374, 793)),
        ((374, 832), (357, 869), (333, 870)),
        ((303, 871), (285, 834), (286, 794)),
        ((286, 755), (307, 711), (329, 710)),
    ], "EDBA60", (292, 748, 372, 850, "E4AD52"), stroke=10.2)
    grain("Left cut growth ring", (325, 748), [
        ((308, 775), (310, 806), (325, 831)),
    ])
    grain("Rear left bark grain", (405, 816), [
        ((430, 826), (453, 836), (469, 845)),
    ])
    grain("Rear right bark upper grain", (860, 831), [
        ((876, 825), (894, 816), (907, 804)),
    ])
    grain("Rear right bark end grain", (940, 855), [
        ((954, 851), (964, 844), (973, 835)),
    ])

    body("Front right log cut", (981, 922), [
        ((1011, 919), (1030, 953), (1029, 987)),
        ((1028, 1023), (1007, 1065), (978, 1079)),
        ((947, 1092), (920, 1072), (911, 1044)),
        ((898, 1006), (918, 956), (950, 932)),
        ((961, 926), (972, 923), (981, 922)),
    ], "EDBA61", (920, 954, 1019, 1050, "E6AF54"), stroke=10.4)
    grain("Right cut left growth ring", (978, 966), [
        ((951, 991), (947, 1026), (959, 1050)),
    ])
    grain("Right cut right growth ring", (998, 990), [
        ((999, 1005), (993, 1024), (980, 1037)),
    ])
    grain("Front right bark grain", (834, 953), [
        ((850, 963), (868, 972), (885, 978)),
    ])

    body("Front left log bark", (369, 925), [
        ((466, 880), (580, 820), (657, 799)),
        ((705, 816), (768, 844), (821, 864)),
        ((768, 912), (721, 939), (680, 969)),
        ((603, 1025), (526, 1060), (445, 1097)),
        ((417, 1108), (389, 1099), (367, 1073)),
        ((330, 1039), (321, 991), (341, 951)),
        ((348, 939), (356, 929), (369, 925)),
    ], "875736", (405, 930, 800, 880, "78492C"), stroke=10.4)
    grain("Front left upper bark grain", (501, 958), [
        ((525, 947), (545, 933), (559, 920)),
    ])
    grain("Front left long bark grain", (568, 994), [
        ((599, 972), (625, 939), (647, 921)),
        ((657, 913), (665, 907), (672, 905)),
    ], width=7.9)

    body("Front left log cut", (369, 925), [
        ((408, 926), (447, 965), (460, 1007)),
        ((474, 1052), (457, 1093), (431, 1098)),
        ((394, 1105), (351, 1077), (330, 1038)),
        ((310, 1003), (315, 960), (336, 937)),
        ((344, 928), (356, 925), (369, 925)),
    ], "EFBF68", (336, 947, 454, 1087, "E4AD52"), stroke=10.7)
    grain("Front cut upper growth ring", (365, 966), [
        ((391, 965), (416, 999), (419, 1031)),
    ], width=7.6)
    grain("Front cut lower growth ring", (355, 997), [
        ((354, 1022), (369, 1049), (395, 1058)),
    ], width=7.6)

    return layers, flames
