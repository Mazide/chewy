"""Pure-vector Chewy dog, traced from camp-v3-flat/dog.png.

All coordinates retain the 1312 x 1199 source canvas. Returned layers are in
visual back-to-front order; nested Nodes already use Rive's front-first order.
The seated body and feet stay fixed. Tail, head, floppy ear and eyelids have
independent six-second periodic tracks. No raster assets are embedded.
"""

from math import atan2, hypot, pi, sin
import xml.etree.ElementTree as ET


WIDTH, HEIGHT = 1312, 1199
SOURCE_BOUNDS = (294, 48, 781, 1100)
INK = "17120B"
GOLD = "D7A657"
CREAM = "F2E1BE"
BROWN = "78573C"


def _el(tag, **attrs):
    return ET.Element(tag, {key: str(value) for key, value in attrs.items()})


class _Drawing:
    def __init__(self):
        self.serial = 1000

    def ident(self):
        self.serial += 1
        return f"3:{self.serial}"

    def curve(self, name, start, segments, fill=None, stroke=5.8,
              closed=True, origin=(0, 0), gradient=None):
        """Create a cubic contour; segment tuples are (control1, control2, end)."""
        shape = _el("Shape", name=name, x=0, y=0)
        path = ET.SubElement(shape, "PointsPath", isClosed=str(closed).lower(),
                             isClockwise="true")
        anchors = [start] + [segment[2] for segment in segments]
        if closed:
            assert anchors[-1] == start, name
            anchors.pop()
        for index, (x, y) in enumerate(anchors):
            incoming = segments[(index - 1) % len(segments)][1] if closed or index else (x, y)
            outgoing = segments[index][0] if index < len(segments) else (x, y)
            ix, iy = incoming[0] - x, incoming[1] - y
            ox, oy = outgoing[0] - x, outgoing[1] - y
            path.append(_el("CubicDetachedVertex", id=self.ident(),
                            x=x-origin[0], y=y-origin[1],
                            inRotation=atan2(iy, ix), inDistance=hypot(ix, iy),
                            outRotation=atan2(oy, ox), outDistance=hypot(ox, oy)))
        if fill:
            paint = ET.SubElement(shape, "Fill")
            if gradient:
                x1, y1, x2, y2, color2 = gradient
                grad = ET.SubElement(paint, "LinearGradient", startX=str(x1-origin[0]),
                                     startY=str(y1-origin[1]), endX=str(x2-origin[0]),
                                     endY=str(y2-origin[1]))
                grad.append(_el("GradientStop", colorValue="FF"+fill, position=0))
                grad.append(_el("GradientStop", colorValue="FF"+color2, position=1))
            else:
                paint.append(_el("SolidColor", colorValue="FF"+fill))
        if stroke:
            line = ET.SubElement(shape, "Stroke", thickness=str(stroke),
                                 cap="round", join="round")
            line.append(_el("SolidColor", colorValue="FF"+INK))
        return shape

    def line(self, name, start, segments, origin=(0, 0), stroke=5.2):
        return self.curve(name, start, segments, stroke=stroke, closed=False,
                          origin=origin)

    def ellipse(self, name, cx, cy, rx, ry, color, origin=(0, 0)):
        k = .55228475
        return self.curve(name, (cx+rx, cy), [
            ((cx+rx, cy+k*ry), (cx+k*rx, cy+ry), (cx, cy+ry)),
            ((cx-k*rx, cy+ry), (cx-rx, cy+k*ry), (cx-rx, cy)),
            ((cx-rx, cy-k*ry), (cx-k*rx, cy-ry), (cx, cy-ry)),
            ((cx+k*rx, cy-ry), (cx+rx, cy-k*ry), (cx+rx, cy)),
        ], color, stroke=0, origin=origin)

    def node(self, name, ident, pivot, children, parent_origin=(0, 0)):
        node = _el("Node", name=name, id=ident,
                   x=pivot[0]-parent_origin[0], y=pivot[1]-parent_origin[1],
                   rotation=0, scaleX=1, scaleY=1)
        node.extend(reversed(children))
        return node


def build_dog():
    """Return (vector layers, tracks) with a namespace reserved under ``3:``."""
    d = _Drawing()
    layers = []
    tracks = []

    # The tail root is hidden under the seated haunch, so a wag cannot open a seam.
    tail_origin = (470, 1015)
    tail = d.curve("Dog golden tail", (481, 1027), [
        ((432, 1013), (389, 996), (355, 963)),
        ((334, 945), (324, 919), (313, 904)),
        ((302, 899), (298, 943), (308, 966)),
        ((311, 975), (320, 982), (326, 988)),
        ((311, 983), (300, 971), (297, 975)),
        ((289, 990), (311, 1016), (348, 1028)),
        ((338, 1029), (327, 1026), (325, 1028)),
        ((342, 1051), (394, 1058), (431, 1052)),
        ((453, 1049), (477, 1043), (481, 1027)),
    ], "DEB566", origin=tail_origin,
       gradient=(321, 943, 458, 1051, "D1A255"))
    layers.append(d.node("Dog tail pivot", "3:10", tail_origin, [tail]))

    # Far hind paw and far front leg, behind the larger body and near foreleg.
    layers.append(d.curve("Dog rear foot", (648, 1043), [
        ((693, 1037), (746, 1035), (794, 1031)),
        ((826, 1033), (842, 1053), (833, 1068)),
        ((794, 1077), (720, 1073), (657, 1071)),
        ((645, 1067), (639, 1055), (648, 1043)),
    ], GOLD))
    layers.append(d.curve("Dog far foreleg", (779, 627), [
        ((804, 628), (836, 627), (847, 649)),
        ((834, 776), (821, 938), (848, 1050)),
        ((875, 1042), (900, 1046), (912, 1068)),
        ((921, 1082), (923, 1097), (915, 1100)),
        ((892, 1112), (841, 1109), (802, 1101)),
        ((786, 1096), (791, 1060), (785, 1013)),
        ((772, 905), (769, 753), (779, 627)),
    ], GOLD, gradient=(794, 660, 861, 1097, "DFB26B")))
    layers.append(d.curve("Dog far cream paw", (844, 1050), [
        ((873, 1042), (900, 1048), (912, 1068)),
        ((922, 1083), (923, 1096), (915, 1100)),
        ((891, 1110), (843, 1110), (801, 1099)),
        ((807, 1079), (824, 1060), (844, 1050)),
    ], CREAM, stroke=0))
    layers.append(d.line("Dog far paw outline", (844, 1050), [
        ((873, 1042), (900, 1048), (912, 1068)),
        ((922, 1083), (923, 1096), (915, 1100)),
        ((891, 1110), (843, 1110), (801, 1099)),
    ]))
    layers.append(d.line("Dog far toe one", (860, 1075), [((868, 1081), (873, 1091), (873, 1107))]))
    layers.append(d.line("Dog far toe two", (888, 1072), [((897, 1081), (900, 1092), (899, 1106))]))

    # Entire seated torso is one grounded silhouette, with the front chest patch
    # and a distinct thigh. No body scale key can dislodge its contact points.
    layers.append(d.curve("Dog seated torso", (713, 420), [
        ((749, 423), (806, 438), (835, 466)),
        ((843, 493), (845, 518), (861, 543)),
        ((855, 544), (848, 537), (840, 527)),
        ((854, 562), (871, 609), (861, 637)),
        ((859, 649), (855, 657), (849, 663)),
        ((845, 656), (844, 641), (840, 632)),
        ((836, 696), (803, 751), (754, 806)),
        ((739, 823), (735, 833), (738, 849)),
        ((776, 857), (781, 888), (771, 924)),
        ((759, 965), (727, 1004), (688, 1044)),
        ((668, 1060), (644, 1073), (615, 1083)),
        ((581, 1091), (520, 1087), (484, 1068)),
        ((450, 1049), (435, 1016), (436, 966)),
        ((438, 879), (473, 780), (525, 698)),
        ((559, 646), (594, 610), (620, 572)),
        ((653, 524), (676, 462), (713, 420)),
    ], GOLD, gradient=(462, 771, 845, 575, "DCAE64")))

    layers.append(d.curve("Dog cream chest", (757, 466), [
        ((784, 470), (813, 472), (837, 470)),
        ((843, 497), (845, 518), (861, 543)),
        ((855, 544), (848, 537), (840, 527)),
        ((854, 562), (871, 609), (861, 637)),
        ((859, 649), (855, 657), (849, 663)),
        ((845, 656), (844, 641), (840, 632)),
        ((836, 697), (803, 751), (754, 806)),
        ((724, 839), (691, 873), (677, 905)),
        ((690, 864), (686, 822), (674, 789)),
        ((657, 806), (642, 829), (630, 850)),
        ((625, 828), (650, 795), (666, 775)),
        ((689, 743), (716, 701), (739, 659)),
        ((752, 628), (775, 603), (758, 565)),
        ((777, 582), (783, 569), (776, 548)),
        ((768, 522), (756, 498), (757, 466)),
    ], CREAM, stroke=0, gradient=(767, 498, 679, 827, "ECD7B0")))
    layers.append(d.line("Dog chest contour", (837, 470), [
        ((843, 497), (845, 518), (861, 543)),
        ((855, 544), (848, 537), (840, 527)),
        ((854, 562), (871, 609), (861, 637)),
        ((859, 649), (855, 657), (849, 663)),
        ((845, 656), (844, 641), (840, 632)),
        ((836, 697), (803, 751), (754, 806)),
    ]))
    layers.append(d.line("Dog shoulder fold", (663, 678), [
        ((682, 714), (680, 754), (675, 784)),
        ((671, 801), (681, 802), (684, 793)),
    ]))
    layers.append(d.line("Dog haunch crease", (571, 812), [
        ((547, 822), (529, 844), (515, 874)),
    ]))
    layers.append(d.curve("Dog near haunch and paw", (475, 931), [
        ((494, 881), (545, 850), (593, 844)),
        ((633, 837), (655, 855), (660, 885)),
        ((671, 942), (623, 1023), (545, 1070)),
        ((580, 1062), (606, 1055), (636, 1062)),
        ((658, 1068), (675, 1090), (667, 1105)),
        ((653, 1125), (565, 1117), (506, 1106)),
        ((480, 1102), (472, 1095), (475, 1078)),
        ((471, 1063), (464, 1051), (465, 1036)),
        ((464, 1018), (468, 997), (471, 981)),
        ((460, 1002), (463, 1030), (464, 1041)),
        ((448, 1015), (453, 968), (475, 931)),
    ], "D8A95D", gradient=(491, 943, 663, 1090, "DCAF64")))
    layers.append(d.line("Dog near heel fold", (475, 1078), [
        ((483, 1058), (499, 1037), (507, 1025)),
    ]))
    layers.append(d.line("Dog hind toe one", (615, 1091), [((622, 1100), (623, 1109), (621, 1115))]))
    layers.append(d.line("Dog hind toe two", (641, 1089), [((650, 1097), (652, 1106), (649, 1116))]))

    layers.append(d.curve("Dog near foreleg", (751, 626), [
        ((764, 666), (747, 717), (745, 770)),
        ((739, 858), (743, 976), (760, 1074)),
        ((784, 1068), (803, 1082), (814, 1103)),
        ((821, 1115), (824, 1131), (813, 1139)),
        ((791, 1153), (737, 1149), (716, 1136)),
        ((699, 1126), (706, 1096), (703, 1056)),
        ((701, 961), (690, 861), (683, 794)),
        ((673, 799), (672, 797), (676, 782)),
        ((681, 747), (679, 711), (663, 678)),
        ((688, 645), (721, 628), (751, 626)),
    ], GOLD, stroke=0, gradient=(691, 726, 756, 1083, "DFB36B")))
    # Two open leg edges avoid inventing a visible line across the shoulder.
    layers.append(d.line("Dog near foreleg left edge", (663, 678), [
        ((679, 711), (681, 747), (676, 782)),
        ((672, 797), (673, 799), (683, 794)),
        ((690, 861), (701, 961), (703, 1056)),
        ((706, 1096), (699, 1126), (716, 1136)),
    ]))
    layers.append(d.line("Dog near foreleg right edge", (751, 626), [
        ((764, 666), (747, 717), (745, 770)),
        ((739, 858), (743, 976), (760, 1074)),
    ]))
    layers.append(d.curve("Dog near cream paw", (708, 1105), [
        ((722, 1089), (743, 1072), (767, 1072)),
        ((788, 1071), (805, 1087), (814, 1103)),
        ((821, 1115), (824, 1131), (813, 1139)),
        ((791, 1153), (737, 1149), (716, 1136)),
        ((708, 1130), (706, 1118), (708, 1105)),
    ], CREAM, stroke=0))
    layers.append(d.line("Dog near paw outline", (760, 1074), [
        ((784, 1068), (803, 1082), (814, 1103)),
        ((821, 1115), (824, 1131), (813, 1139)),
        ((791, 1153), (737, 1149), (716, 1136)),
        ((708, 1130), (705, 1120), (708, 1105)),
    ]))
    layers.append(d.line("Dog front toe one", (748, 1105), [((756, 1114), (757, 1128), (751, 1146))]))
    layers.append(d.line("Dog front toe two", (784, 1096), [((794, 1109), (797, 1124), (791, 1146))]))

    # The head includes the short neck and overlaps beneath the fixed collar.
    # The origin is at the collar, preventing a floating or sliding head.
    head_origin = (760, 437)
    head = []
    head.append(d.curve("Dog far folded ear", (823, 107), [
        ((845, 87), (871, 61), (893, 51)),
        ((913, 42), (939, 66), (961, 87)),
        ((983, 109), (1004, 115), (1010, 124)),
        ((1015, 136), (995, 154), (978, 160)),
        ((944, 177), (916, 153), (908, 126)),
        ((899, 139), (889, 145), (876, 147)),
        ((858, 138), (841, 118), (823, 107)),
    ], "DBAE63", origin=head_origin))
    head.append(d.line("Dog far ear fold", (892, 94), [
        ((901, 109), (907, 121), (908, 126)),
    ], origin=head_origin))

    head.append(d.curve("Dog head and neck", (710, 403), [
        ((715, 382), (719, 355), (724, 331)),
        ((716, 336), (705, 333), (708, 320)),
        ((711, 304), (720, 283), (725, 267)),
        ((715, 282), (705, 290), (703, 278)),
        ((707, 241), (711, 206), (711, 176)),
        ((710, 157), (714, 130), (729, 118)),
        ((738, 95), (755, 70), (768, 65)),
        ((775, 62), (768, 85), (758, 107)),
        ((777, 87), (801, 69), (814, 71)),
        ((820, 77), (801, 95), (788, 107)),
        ((831, 97), (871, 115), (891, 151)),
        ((902, 170), (906, 191), (917, 202)),
        ((953, 218), (1008, 218), (1047, 234)),
        ((1066, 239), (1074, 248), (1068, 267)),
        ((1059, 292), (1040, 325), (1020, 339)),
        ((984, 363), (925, 350), (852, 343)),
        ((840, 357), (835, 382), (837, 409)),
        ((837, 420), (838, 429), (840, 438)),
        ((800, 443), (749, 427), (710, 403)),
    ], GOLD, origin=head_origin, gradient=(750, 142, 825, 432, "D9AD64")))

    head.append(d.curve("Dog cream muzzle and throat", (874, 191), [
        ((884, 197), (901, 203), (917, 202)),
        ((953, 218), (1008, 218), (1047, 234)),
        ((1066, 239), (1074, 248), (1068, 267)),
        ((1059, 292), (1040, 325), (1020, 339)),
        ((984, 363), (925, 350), (852, 343)),
        ((840, 357), (835, 382), (837, 409)),
        ((837, 420), (838, 429), (840, 438)),
        ((814, 439), (789, 433), (770, 429)),
        ((776, 419), (781, 407), (780, 398)),
        ((762, 418), (770, 373), (783, 350)),
        ((790, 338), (793, 332), (799, 329)),
        ((777, 320), (783, 294), (799, 279)),
        ((816, 261), (849, 259), (864, 245)),
        ((879, 233), (869, 204), (874, 191)),
    ], CREAM, stroke=0, origin=head_origin,
       gradient=(841, 248, 1032, 325, "F3E5CA")))
    head.append(d.line("Dog muzzle outline", (917, 202), [
        ((953, 218), (1008, 218), (1047, 234)),
        ((1066, 239), (1074, 248), (1068, 267)),
        ((1059, 292), (1040, 325), (1020, 339)),
        ((984, 363), (925, 350), (852, 343)),
    ], origin=head_origin))
    head.append(d.line("Dog neck cream edge", (852, 343), [
        ((840, 357), (835, 382), (837, 409)),
        ((837, 420), (838, 429), (840, 438)),
    ], origin=head_origin))
    head.append(d.line("Dog friendly smile", (863, 291), [
        ((872, 308), (890, 317), (910, 318)),
    ], origin=head_origin, stroke=5.6))
    head.append(d.curve("Dog dark nose", (1010, 245), [
        ((1024, 233), (1050, 230), (1064, 239)),
        ((1077, 247), (1069, 265), (1055, 277)),
        ((1035, 294), (1019, 284), (1012, 271)),
        ((1005, 259), (1005, 251), (1010, 245)),
    ], "624A38", origin=head_origin,
       gradient=(1018, 242, 1059, 278, "4E3E31")))

    ear_origin = (726, 145)
    ear = d.curve("Dog soft brown ear", (741, 133), [
        ((719, 114), (683, 112), (660, 129)),
        ((636, 145), (629, 169), (615, 194)),
        ((603, 216), (585, 233), (578, 247)),
        ((570, 264), (580, 269), (602, 253)),
        ((592, 281), (590, 310), (599, 334)),
        ((605, 354), (618, 369), (634, 369)),
        ((659, 369), (681, 338), (694, 304)),
        ((708, 268), (709, 225), (713, 181)),
        ((715, 158), (723, 146), (741, 133)),
    ], BROWN, origin=ear_origin, gradient=(613, 206, 708, 293, "8B6949"))
    head.append(d.node("Dog floppy ear pivot", "3:12", ear_origin, [ear], head_origin))

    for ident, name, cx, cy, rx, ry in [
        ("3:13", "Dog near eye", 813, 205, 8.5, 14.2),
        ("3:14", "Dog far eye", 882, 184, 7.6, 12.7),
    ]:
        eye = d.ellipse(name, cx, cy, rx, ry, "11120E", origin=(cx, cy))
        head.append(d.node(name+" blink pivot", ident, (cx, cy), [eye], head_origin))
    head.append(d.line("Dog forehead detail", (852, 120), [
        ((863, 121), (872, 125), (874, 129)),
    ], origin=head_origin, stroke=4.4))
    layers.append(d.node("Dog head pivot", "3:11", head_origin, head))

    # A fixed collar covers the moving neck root without changing the silhouette.
    layers.append(d.curve("Dog green collar", (706, 399), [
        ((738, 421), (794, 440), (840, 433)),
        ((848, 440), (849, 460), (842, 474)),
        ((806, 486), (738, 468), (699, 441)),
        ((686, 433), (688, 415), (698, 402)),
        ((700, 400), (703, 399), (706, 399)),
    ], "6E8160", gradient=(711, 408, 830, 473, "607355")))

    def periodic(ident, prop, fn, step=6):
        keys = [(frame, round(fn(frame / 360 * 2*pi), 7))
                for frame in range(0, 361, step)]
        keys[-1] = (360, keys[0][1])
        tracks.append({"id": ident, "property": prop, "keys": keys})

    # Two short bouts of tail activity inside a calm six-second resting loop.
    periodic("3:10", "rotation", lambda t: .105*sin(6*t)*(.62+.38*sin(t)**2))
    periodic("3:11", "rotation", lambda t: .014*sin(t) + .004*sin(2*t))
    periodic("3:12", "rotation", lambda t: .034*sin(2*t-.35) + .012*sin(3*t))
    # The neutral art pose remains the original source pose at the loop boundary.
    ear_track = tracks[-1]
    offset = ear_track["keys"][0][1]
    ear_track["keys"] = [(frame, round(value-offset, 7)) for frame, value in ear_track["keys"]]
    blink = [(0, 1), (94, 1), (99, .07), (104, .07), (111, 1),
             (255, 1), (260, .07), (265, .07), (272, 1), (360, 1)]
    for ident in ("3:13", "3:14"):
        tracks.append({"id": ident, "property": "scaleY", "keys": blink.copy()})
    return layers, tracks
