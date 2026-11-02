"""Hand-traced Rive vectors from the existing flat camp PNG silhouettes.

Coordinates retain the original background (853 x 1844) and kettle
(1312 x 1199) canvases. Builders return layers back-to-front; RML assembly
must reverse that order because Rive draws its first sibling on top.
The source artwork's textured paint is reduced to sampled flat colours.
Only the kettle steam animates; every track closes at frame 360 / 60 fps.
"""

import math
import re
import xml.etree.ElementTree as ET


class _Art:
    """Small SVG-command-to-RML helper; no image assets enter the result."""

    def __init__(self, first_id):
        self.next_id = first_id

    def element(self, tag, **attributes):
        attributes = {key: str(value) for key, value in attributes.items()}
        attributes["id"] = f"4:{self.next_id}"
        self.next_id += 1
        return ET.Element(tag, attributes)

    def path(self, name, data, fill=None, stroke="0B1009", width=2.7,
             opacity=1):
        """Accept absolute M/L/C/Z commands and preserve their Bezier handles."""
        tokens = re.findall(r"[MLCZ]|-?(?:\d*\.\d+|\d+)", data)
        vertices = []
        command = None
        closed = False
        cursor = 0
        while cursor < len(tokens):
            if tokens[cursor] in ("M", "L", "C", "Z"):
                command = tokens[cursor]
                cursor += 1
            if command == "Z":
                closed = True
                command = None
                continue
            count = 6 if command == "C" else 2
            values = list(map(float, tokens[cursor:cursor + count]))
            cursor += count
            if command == "C":
                vertices[-1]["out"] = tuple(values[:2])
                vertices.append({"p": tuple(values[4:]),
                                 "in": tuple(values[2:4])})
            else:
                vertices.append({"p": tuple(values)})
                if command == "M":
                    command = "L"

        # A final cubic endpoint equal to the first point closes with its
        # incoming handle instead of leaving a duplicate zero-length edge.
        if closed and vertices[-1]["p"] == vertices[0]["p"]:
            if "in" in vertices[-1]:
                vertices[0]["in"] = vertices[-1]["in"]
            vertices.pop()

        area = sum(a["p"][0] * b["p"][1] - b["p"][0] * a["p"][1]
                   for a, b in zip(vertices, vertices[1:] + vertices[:1]))
        shape = self.element("Shape", name=name, opacity=opacity)
        path = self.element("PointsPath", name=f"{name} contour",
                            isClosed=str(closed).lower(),
                            isClockwise=str(area >= 0).lower())
        for vertex in vertices:
            x, y = vertex["p"]
            if "in" not in vertex and "out" not in vertex:
                point = self.element("StraightVertex", x=x, y=y)
            else:
                attrs = {"x": x, "y": y}
                for direction in ("in", "out"):
                    hx, hy = vertex.get(direction, (x, y))
                    attrs[f"{direction}Rotation"] = math.atan2(hy - y, hx - x)
                    attrs[f"{direction}Distance"] = math.hypot(hx - x, hy - y)
                point = self.element("CubicDetachedVertex", **attrs)
            path.append(point)
        shape.append(path)
        if fill:
            paint = self.element("Fill", name=f"{name} fill")
            paint.append(self.element("SolidColor", colorValue=fill))
            shape.append(paint)
        if stroke:
            paint = self.element("Stroke", name=f"{name} outline",
                                 thickness=width, cap="round", join="round")
            paint.append(self.element("SolidColor", colorValue=stroke))
            shape.append(paint)
        return shape


def build_background():
    """Return the source clearing's static vector layers, back-to-front."""
    art = _Art(1)
    layers = []
    layers.append(art.path("Sky", "M0 0 L853 0 L853 1844 L0 1844 Z",
                           fill="B3D5E9", stroke=None))
    layers.append(art.path("Distant forest hedge", """
        M0 420 C13 403 30 395 44 400
        C50 399 53 403 57 408 C82 381 118 396 116 430
        C125 431 125 441 120 451 C138 443 156 455 157 477
        C164 470 170 467 177 473 C186 439 242 444 238 484
        C252 480 263 495 251 508 C258 507 261 512 260 518
        C268 511 274 516 280 521 C302 487 348 506 342 543
        C356 535 370 546 374 561 C378 558 380 557 384 560
        C381 545 397 535 408 541 C418 519 439 520 451 533
        C457 526 464 525 471 527 C462 500 491 486 509 499
        C513 482 528 475 540 482 C544 452 590 448 602 486
        C613 480 621 487 625 499 C633 479 646 475 661 481
        C651 455 668 438 689 440 C688 409 727 389 751 426
        C756 420 762 422 767 427 C766 401 795 391 811 408
        C825 394 840 406 853 419 L853 690 L0 690 Z
        """, fill="445B41"))
    layers.append(art.path("Grassy clearing", """
        M0 659 C97 645 155 649 212 651 C285 654 354 647 426 647
        C550 645 616 653 684 657 C749 660 794 658 853 665
        L853 1844 L0 1844 Z
        """, fill="96A654", stroke=None))
    layers.append(art.path("Clearing horizon", """
        M0 659 C97 645 155 649 212 651 C285 654 354 647 426 647
        C550 645 616 653 684 657 C749 660 794 658 853 665
        """))

    layers.append(art.path("Left tree trunk", """
        M-15 149 L29 174 C26 219 28 271 31 315
        C52 276 83 214 99 171 L119 169
        C110 220 78 287 52 337 C36 402 33 481 39 548
        C45 624 52 681 74 740 C50 746 21 739 0 746
        L-15 746 Z
        """, fill="9B6E42"))
    layers.append(art.path("Left trunk crown shade", """
        M-3 193 C8 213 18 214 29 214 L29 234
        C15 234 7 229 -3 220 Z
        """, fill="896039", stroke=None))
    layers.append(art.path("Right tree trunk", """
        M739 171 L762 176 C779 219 799 267 824 294
        L824 179 L867 170 L867 746 C840 738 820 744 793 740
        C817 661 822 575 824 503 C825 445 822 391 814 355
        C797 313 757 248 739 194 Z
        """, fill="9B6E42"))
    layers.append(art.path("Right trunk crown shade", """
        M825 209 C839 222 850 216 862 209 L862 250
        C849 258 836 256 825 250 Z
        """, fill="896039", stroke=None))

    layers.append(art.path("Left tree canopy", """
        M-10 -10 L329 -10 C355 -3 359 37 327 46
        C357 68 365 98 338 117 C318 130 289 127 271 113
        C290 139 296 169 277 186 C261 199 234 197 217 180
        C228 205 223 234 208 247 C199 255 189 253 180 250
        C181 272 148 286 117 259 C119 289 95 309 73 292
        C87 259 101 221 111 185 C129 191 144 178 145 163
        C145 179 132 194 111 185 C106 185 102 182 100 179
        C89 211 66 225 41 219 C24 217 16 207 12 193
        C8 208 1 215 -10 220 Z
        """, fill="81954C"))
    layers.append(art.path("Left canopy fold", "M166 245 C173 249 177 251 184 251",
                           stroke="0B1009"))
    layers.append(art.path("Right tree canopy", """
        M589 -10 C556 4 546 37 560 58 C535 75 525 113 555 115
        C562 115 566 111 570 105 C552 131 555 149 575 157
        C593 164 613 158 628 149 C611 168 602 189 608 217
        C615 251 649 240 672 216 C660 239 665 269 689 263
        C693 261 697 259 701 255 C687 283 707 314 734 298
        C740 295 745 290 749 286 C752 307 774 315 788 302
        C773 273 758 244 747 213 C737 213 730 209 726 204
        C738 218 760 218 771 199 C769 202 767 204 765 206
        C779 242 801 278 824 294 L824 224
        C817 219 812 212 809 204 C817 231 842 236 863 216
        L863 -10 Z
        """, fill="81954C"))
    layers.append(art.path("Right canopy fold", "M560 58 C569 54 577 52 587 50",
                           stroke="0B1009"))

    # A handful of tufts is present in the source; retain exactly those
    # locations so the empty central stage stays available for camp props.
    for name, data in (
        ("Left roots grass", """
            M1 746 C17 740 24 743 34 747 C23 735 22 730 35 735
            L47 741 C43 729 34 715 39 716 C50 718 58 738 60 742
            C69 720 87 709 87 715 C84 725 78 735 75 743
            C91 733 106 729 102 734 L90 748
            """),
        ("Right roots grass", """
            M778 747 C770 740 764 736 767 733 C773 731 781 737 788 742
            C783 729 776 712 783 716 C791 720 799 731 802 741
            C809 726 817 715 822 716 C822 724 816 738 815 743
            C825 736 831 731 834 733 L827 746 C837 740 844 742 853 746
            """),
        ("Lower left grass", """
            M26 1787 C23 1777 19 1767 23 1768 C29 1769 35 1779 36 1783
            C41 1767 50 1751 56 1752 C59 1754 51 1774 49 1782
            C61 1774 77 1769 73 1775 L61 1790
            """),
        ("Lower right grass", """
            M790 1790 C782 1781 775 1772 779 1771 C787 1771 796 1779 802 1784
            C799 1770 792 1749 800 1752 C808 1756 816 1774 816 1782
            C824 1770 833 1765 832 1772 L828 1788
            """),
    ):
        layers.append(art.path(name, data, fill="96A654", width=2.7))
    return layers


def build_kettle():
    """Return stationary blue kettle layers and independently looping steam."""
    art = _Art(1000)
    layers = []
    blue = "46749E"
    outline = "070A09"

    layers.append(art.path("Kettle black handle", """
        M469 579 C469 527 438 473 427 416 C401 286 490 177 611 151
        C697 132 789 146 853 188 C956 257 1005 399 997 527
        L992 576 L959 569 C977 448 939 321 866 253
        C813 203 749 184 686 187 C575 185 486 250 463 336
        C441 413 470 457 489 511 C498 536 503 555 503 579 Z
        """, fill="2A2926", stroke=outline, width=8))

    layers.append(art.path("Kettle body and spout", """
        M510 573 C587 537 828 536 939 581
        C1002 613 1033 685 1050 793 C1061 861 1059 928 1045 966
        C1030 1005 994 1022 949 1032 C812 1063 613 1061 499 1042
        C438 1033 400 1016 385 983 C370 951 372 891 379 849
        C341 818 328 778 315 723 C303 676 285 642 261 620
        C245 605 261 591 290 581 C317 571 336 572 349 582
        C376 605 404 645 430 666 C452 622 478 591 510 573 Z
        """, fill=blue, stroke=outline, width=7))

    layers.append(art.path("Kettle left handle mount", """
        M470 628 C456 612 450 593 454 574 C456 557 467 546 478 550
        C498 556 507 588 502 621
        """, fill=blue, stroke=outline, width=7))
    layers.append(art.path("Kettle left handle rivet", """
        M468 585 C468 572 482 570 484 584 C486 597 478 604 472 595
        C469 591 468 588 468 585 Z
        """, fill="292B28", stroke=outline, width=6))
    layers.append(art.path("Kettle right handle mount", """
        M945 597 C949 567 962 543 978 546 C1000 549 1009 574 1002 599
        C999 612 993 621 987 627 Z
        """, fill=blue, stroke=outline, width=7))
    layers.append(art.path("Kettle right handle rivet", """
        M970 580 C972 566 986 568 988 579 C991 593 981 603 973 595
        C969 591 968 586 970 580 Z
        """, fill="292B28", stroke=outline, width=6))

    layers.append(art.path("Kettle lid rim", """
        M514 572 C536 546 601 524 695 523 C786 521 888 541 928 563
        C945 572 949 583 935 594 C922 605 889 613 854 619
        C901 602 930 589 923 576 C913 554 826 538 723 536
        C629 535 547 549 530 569 C521 582 538 600 579 616
        C552 612 524 602 513 593 Z
        """, fill="5281AA", stroke=outline, width=5))
    layers.append(art.path("Kettle domed lid", """
        M534 553 C559 524 622 501 687 492 C717 486 746 487 770 493
        C839 504 895 524 918 551 C932 568 920 582 885 589
        C808 607 638 609 561 592 C528 585 519 573 534 553 Z
        """, fill=blue, stroke=outline, width=7))
    layers.append(art.path("Kettle lid knob", """
        M689 483 C670 479 661 467 671 450 C687 425 730 420 756 429
        C781 436 793 451 784 465 C779 473 772 477 764 480
        L765 502 C745 513 712 515 690 507 Z
        """, fill="487AA4", stroke=outline, width=7))

    layers.append(art.path("Kettle spout opening", """
        M272 599 C290 587 321 579 335 584 C351 590 323 605 296 610
        C277 614 261 611 272 599 Z
        """, fill="080D0E", stroke=None))
    layers.append(art.path("Kettle spout join", """
        M430 666 C439 674 447 681 454 686
        C470 718 442 800 409 837
        """, stroke=outline, width=6))

    tracks = []
    for index, data in enumerate((
        "M302 554 C282 531 313 508 303 482 C297 466 283 462 290 443",
        "M321 538 C342 513 308 488 323 462 C333 444 333 432 322 414",
        "M281 526 C259 505 285 482 274 462 C268 450 259 438 267 423",
    )):
        opacity = (0.56, 0.36, 0.28)[index]
        steam = art.path(f"Kettle steam {index + 1}", data,
                         stroke="F5F1DB", width=(10, 8, 7)[index],
                         opacity=opacity)
        steam_id = steam.get("id")
        layers.append(steam)
        # Each plume has its own closed breathing cycle. The silhouettes
        # never touch the handle or body animation because neither is keyed.
        drift = (7, -6, 5)[index]
        lift = (-10, -14, -8)[index]
        tracks.extend([
            {"id": steam_id, "property": "x",
             "keys": [(0, 0), (90, drift), (180, 0), (270, -drift), (360, 0)]},
            {"id": steam_id, "property": "y",
             "keys": [(0, 0), (90, lift), (180, 0), (270, -lift / 2), (360, 0)]},
            {"id": steam_id, "property": "opacity",
             "keys": [(0, opacity), (90, opacity * 0.7),
                      (180, opacity), (270, opacity * 1.15), (360, opacity)]},
        ])
    return layers, tracks
