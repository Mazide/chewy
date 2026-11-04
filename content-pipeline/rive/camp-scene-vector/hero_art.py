"""Editable tracing of the original Chewy hero; source canvas 506 × 1060.

The source pose and clothes are retained. This draft separates head/eyes from
the breathing upper body; pants and boots stay planted. No source PNG embeds.
"""
from vector_utils import path, ellipse, group, wave


def build_hero():
    layers, upper, head = [], [], []
    # Static lower body, preserving the original hands-on-hips stance.
    layers.append(path("Blue trousers", "M 162 591 C 150 624 165 649 172 656 L 135 891 Q 154 907 180 893 L 216 673 Q 260 680 303 673 L 339 894 Q 361 907 385 894 L 347 655 Q 366 633 358 593 Z", "477B98"))
    layers.append(path("Left boot", "M 136 881 Q 108 884 111 907 Q 112 920 123 927 L 119 965 Q 83 986 75 1000 Q 65 1017 91 1016 Q 140 1010 174 991 Q 182 986 180 963 L 183 925 Q 202 895 189 886 L 178 881 L 177 896 Q 151 902 136 894 Z", "C3C1A0"))
    layers.append(path("Right boot", "M 339 881 Q 312 884 321 911 L 332 934 L 335 980 Q 336 991 355 998 Q 397 1017 432 1016 Q 452 1016 442 999 Q 429 984 400 966 L 398 927 Q 412 916 405 895 Q 398 882 384 883 L 385 895 Q 359 903 340 895 Z", "C3C1A0"))
    for name, d in [
        ("Left cuff", "M 123 921 Q 146 932 174 920"),
        ("Left wrap upper", "M 122 930 Q 145 947 181 940 Q 156 952 121 952"),
        ("Left wrap lower", "M 121 956 Q 151 977 180 976"),
        ("Right cuff", "M 335 922 Q 360 931 390 921"),
        ("Right wrap upper", "M 334 938 Q 359 947 398 936 Q 370 954 336 953"),
        ("Right wrap lower", "M 337 977 Q 370 975 398 955")]:
        layers.append(path(name, d, stroke=3))
    # Arms are distinct shapes; the torso masks their shoulder joins.
    upper.append(path("Left sleeve", "M 215 369 C 157 370 72 408 43 448 C 20 481 44 532 112 562 L 128 532 Q 67 500 79 474 Q 91 451 177 416 Z", "EDEBD1"))
    upper.append(path("Right sleeve", "M 297 370 C 355 367 456 419 479 452 C 503 489 477 528 410 563 L 395 532 Q 455 502 443 475 Q 426 450 345 418 Z", "EDEBD1"))
    upper.append(path("Linen shirt", "M 211 369 Q 230 368 241 377 L 255 431 L 272 383 Q 286 380 302 369 Q 324 372 349 386 L 348 431 Q 349 492 367 535 L 372 577 Q 375 604 350 608 L 326 607 Q 286 630 230 614 Q 208 612 197 605 Q 150 619 147 588 L 153 532 Q 173 492 172 416 Z", "EDEBD1"))
    upper.append(path("Shirt hem left", "M 196 594 Q 208 610 232 614", stroke=3))
    upper.append(path("Shirt hem right", "M 326 594 Q 316 607 298 611", stroke=3))
    upper.append(path("Left hand", "M 129 532 Q 138 527 148 535 Q 163 530 167 540 Q 173 546 164 552 Q 173 562 162 567 Q 167 579 151 580 Q 131 580 113 566 Q 112 547 129 532 Z", "F2C9A3"))
    upper.append(path("Left knuckles", "M 150 552 Q 157 557 164 552", stroke=2.6))
    upper.append(path("Left fingers", "M 149 565 Q 157 569 162 566", stroke=2.6))
    upper.append(path("Right hand", "M 387 533 Q 374 527 367 536 Q 351 535 355 548 Q 347 555 356 562 Q 350 572 367 578 Q 387 580 409 564 Q 405 545 394 536 Z", "F2C9A3"))
    upper.append(path("Right knuckles", "M 356 548 Q 362 552 372 547", stroke=2.6))
    upper.append(path("Right fingers", "M 357 561 Q 363 566 371 561", stroke=2.6))
    # The head pivots at the neck. A slight tilt and independent blinks create
    # life without changing the original friendly expression.
    head.append(path("Back hair", "M 133 144 C 176 65 334 64 389 138 Q 432 194 432 255 Q 432 296 405 325 Q 393 343 378 329 Q 366 354 337 350 L 329 340 Q 302 359 278 351 L 234 353 Q 205 359 185 342 Q 184 359 167 347 Q 138 332 128 309 Q 127 327 114 314 Q 88 287 93 232 Z", "DDB84F"))
    head.append(path("Face and neck", "M 142 168 Q 175 125 263 115 Q 341 118 366 173 L 373 261 Q 365 316 285 341 L 284 368 Q 280 381 269 384 L 255 432 L 241 387 Q 227 383 216 374 L 235 367 L 235 342 Q 159 333 137 270 Z", "F3CBA5"))
    head.append(path("Front golden hair", "M 237 73 Q 209 61 202 50 Q 194 34 217 39 Q 249 48 276 70 Q 261 46 268 38 Q 279 32 297 75 Q 328 47 337 55 Q 344 65 315 80 Q 371 73 412 129 Q 434 162 454 177 Q 465 192 444 192 L 427 185 Q 448 224 443 263 Q 439 286 425 266 L 416 245 Q 420 278 407 269 Q 401 265 392 244 Q 400 280 387 282 Q 373 280 366 251 L 361 195 Q 313 184 279 126 Q 261 170 224 184 Q 202 192 214 161 Q 193 184 154 195 Q 128 202 134 183 L 145 164 Q 133 170 124 203 L 119 257 Q 117 277 110 266 Q 103 254 108 232 Q 98 259 90 254 Q 84 249 89 227 Q 78 263 73 249 Q 69 221 88 185 Q 59 196 62 182 Q 62 174 83 157 Q 107 139 128 110 Q 164 68 207 71 Z", "DDB84F"))
    head.append(ellipse("Left eye", 196, 218, 13, 23, "20241B", "5:21"))
    head.append(ellipse("Right eye", 310, 218, 13, 23, "20241B", "5:22"))
    head.append(path("Easy smile", "M 222 248 Q 255 264 285 246", stroke=3.6))
    head_local = group("Head geometry", head, x=-260, y=-346)
    upper.append(group("Head pivot", [head_local], id="5:20", x=260, y=346))
    layers.append(group("Breathing upper body", upper, id="5:10"))
    tracks = [wave("5:10", "y", 0, -1.8, 2), wave("5:20", "rotation", 0, .012)]
    blink = [(0,1),(106,1),(111,.06),(116,1),(282,1),(287,.06),(292,1),(360,1)]
    tracks += [{"id": eye, "property": "scaleY", "keys": blink} for eye in ("5:21", "5:22")]
    return layers, tracks
