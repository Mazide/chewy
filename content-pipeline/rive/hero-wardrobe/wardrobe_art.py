"""A second editable outfit in the Hero's 506 × 1060 coordinate space.

The caller supplies the shared head, hands, rig and object identities. Layers
below are authored back-to-front; ``group`` writes Rive's front-to-back order.
"""
from vector_utils import group, path


def build_trail_outfit():
    """Return independent top, bottom and shoes groups without authored IDs."""
    top = [
        path("Trail left sleeve", "M 215 369 C 157 370 72 408 43 448 C 20 481 44 532 112 562 L 128 532 Q 67 500 79 474 Q 91 451 177 416 Z", "65794F"),
        path("Trail right sleeve", "M 297 370 C 355 367 456 419 479 452 C 503 489 477 528 410 563 L 395 532 Q 455 502 443 475 Q 426 450 345 418 Z", "65794F"),
        path("Trail left cuff", "M 102 521 Q 113 528 128 532 L 112 562 Q 98 556 88 548 Z", "CFAC65", stroke=3),
        path("Trail right cuff", "M 395 532 Q 409 525 420 518 L 434 544 Q 424 554 410 563 Z", "CFAC65", stroke=3),
        path("Trail ochre jacket", "M 210 370 Q 229 369 241 379 L 255 433 L 273 383 Q 288 380 303 370 Q 326 375 349 389 L 346 438 Q 347 493 365 535 L 369 579 Q 369 602 350 607 L 272 608 L 256 597 L 241 608 L 172 608 Q 146 605 148 581 L 154 534 Q 171 488 172 418 Z", "C4A15A"),
        path("Trail open neckline", "M 224 375 L 242 437 L 255 449 L 269 436 L 289 379", stroke=3, ink="6B623C"),
        path("Trail left shoulder yoke", "M 210 370 Q 229 369 241 379 L 246 400 Q 207 396 174 426 L 172 418 Z", "65794F", stroke=3),
        path("Trail right shoulder yoke", "M 273 383 Q 288 380 303 370 Q 326 375 349 389 L 347 422 Q 315 397 268 400 Z", "65794F", stroke=3),
        path("Trail jacket placket", "M 255 450 L 255 566", stroke=3, ink="80683D"),
        path("Trail left pocket", "M 185 456 L 230 456 L 230 497 Q 208 509 187 498 Z", "B28E4E", stroke=3),
        path("Trail left pocket flap", "M 184 456 L 231 456 L 229 471 L 208 478 L 186 471 Z", "D5B874", stroke=3),
        path("Trail right pocket", "M 281 456 L 327 456 L 324 498 Q 303 509 281 497 Z", "B28E4E", stroke=3),
        path("Trail right pocket flap", "M 280 456 L 328 456 L 326 471 L 303 478 L 282 471 Z", "D5B874", stroke=3),
        path("Trail leather belt", "M 151 565 Q 253 579 368 565 L 369 583 Q 254 597 149 583 Z", "735637", stroke=3),
        path("Trail brass buckle", "M 241 570 L 269 570 L 269 590 L 241 590 Z", "D6BA72", stroke=3),
        path("Trail buckle inset", "M 248 576 L 262 576 L 262 584 L 248 584 Z", "735637", stroke=0),
    ]
    bottom = [
        path("Trail warm trousers", "M 162 591 C 150 624 165 649 172 656 L 135 891 Q 154 907 180 893 L 216 673 Q 260 680 303 673 L 339 894 Q 361 907 385 894 L 347 655 Q 366 633 358 593 Z", "9A7956"),
        path("Trail trouser fly", "M 258 613 L 258 645 Q 259 656 270 659", stroke=2.6, ink="6A5439"),
        path("Trail left knee patch", "M 160 760 L 198 767 L 187 820 L 151 813 Z", "A88A64", stroke=2.6, ink="6A5439"),
        path("Trail right knee patch", "M 319 766 L 357 760 L 366 813 L 329 821 Z", "A88A64", stroke=2.6, ink="6A5439"),
    ]
    shoes = [
        path("Trail left leather boot", "M 136 881 Q 113 884 115 904 L 126 928 L 123 966 Q 91 983 76 1001 Q 66 1017 91 1016 Q 140 1010 174 991 Q 182 986 180 963 L 181 926 Q 195 903 189 886 L 178 881 L 177 896 Q 151 902 136 894 Z", "705037"),
        path("Trail right leather boot", "M 339 881 Q 318 883 323 906 L 334 931 L 337 978 Q 338 991 355 998 Q 397 1017 432 1016 Q 452 1016 442 999 Q 429 984 400 966 L 397 928 Q 410 913 405 895 Q 398 882 384 883 L 385 895 Q 359 903 340 895 Z", "705037"),
        path("Trail left boot cuff", "M 115 900 Q 148 916 192 900 L 181 926 Q 153 934 126 928 Z", "94704B", stroke=3),
        path("Trail right boot cuff", "M 322 901 Q 361 916 406 901 L 397 928 Q 365 938 334 931 Z", "94704B", stroke=3),
        path("Trail left boot seam", "M 143 936 L 142 967 Q 123 980 111 990", stroke=2.6, ink="B39262"),
        path("Trail right boot seam", "M 377 937 L 379 969 Q 398 980 410 991", stroke=2.6, ink="B39262"),
        path("Trail left sole", "M 78 1004 Q 122 1005 174 980", stroke=3.5),
        path("Trail right sole", "M 344 985 Q 396 1007 440 1005", stroke=3.5),
    ]
    return {
        "top": group("Trail top", top),
        "bottom": group("Trail trousers", bottom),
        "shoes": group("Trail boots", shoes),
    }
