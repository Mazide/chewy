#!/usr/bin/env python3
"""Author three editable Rive state studies; never modifies upstream masters.

Run explicitly to regenerate scene.rml. Ordinary builds compile the saved RML.
No raster assets, scripts, gameplay thresholds or external Python dependencies.
"""
from pathlib import Path
from math import atan2, hypot, pi, sin
import re
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / 'camp-scene-vector'))
from vector_utils import el, path, ellipse, group
from tent_art import build_tent

STAGES = ['Resting', 'Beginning', 'Active', 'Lively', 'Abundant']
DURATION = 360
counter = 1000


def identity(node):
    global counter
    if not node.get('id'):
        counter += 1
        node.set('id', f'8:{counter}')
    return node.get('id')


def keys(animation, target, prop, values):
    ident = identity(target) if isinstance(target, ET.Element) else target
    obj = next((obj for obj in animation.findall('KeyedObject') if obj.get('objectId') == ident), None)
    if obj is None:
        obj = ET.SubElement(animation, 'KeyedObject', objectId=ident)
    keyed = ET.SubElement(obj, 'KeyedProperty', property=prop)
    for frame, value in values:
        keyed.append(el('KeyFrameDouble', frame=frame, value=round(value, 6), interpolationType='linear'))


def fixed(animation, target, prop, value):
    keys(animation, target, prop, [(0, value)])


def wave(animation, target, prop, base, amplitude, cycles=1):
    keys(animation, target, prop, [(f, base + amplitude*sin(f/DURATION*2*pi*cycles)) for f in range(0, DURATION+1, 12)])


def project(slug, name, width, height, layers, animate):
    root = el('Rive', version=1, kind='fragment')
    board = el('Artboard', id='0:1', name=name, width=width, height=height,
               styleId='0:5', defaultStateMachineId='0:7', viewModelId='0:40', viewModelInstanceId='0:41')
    root.append(board)
    board.append(el('LayoutComponentStyle', id='0:5', name=f'{name} style'))
    board.extend(reversed(layers))
    machine = ET.SubElement(board, 'StateMachine', name=name, id='0:7')
    layer = ET.SubElement(machine, 'StateMachineLayer', name='Daily state')
    any_state = ET.SubElement(layer, 'AnyState', x='0', y='-100')
    for stage in range(5):
        transition = ET.SubElement(any_state, 'StateTransition', stateToId=f'0:{200+stage}', duration='400')
        condition = ET.SubElement(transition, 'TransitionViewModelCondition', opValue='equal')
        comparator = ET.SubElement(condition, 'TransitionPropertyViewModelComparator')
        bindable = ET.SubElement(comparator, 'BindablePropertyNumber')
        bindable.append(el('DataBindContext', sourcePathIds='0:40-0:45', propertyKey='636'))
        condition.append(el('TransitionValueNumberComparator', value=stage))
    layer.append(el('ExitState', x=200, y=-100))
    entry = ET.SubElement(layer, 'EntryState', x='0', y='100')
    entry.append(el('StateTransition', stateToId='0:200'))
    for stage, label in enumerate(STAGES):
        layer.append(el('AnimationState', id=f'0:{200+stage}', animationId=f'0:{100+stage}', x=160+stage*160, y=100))
        animation = ET.SubElement(board, 'LinearAnimation', id=f'0:{100+stage}', name=label, fps='60', duration=str(DURATION), loopValue='loop')
        animate(animation, stage)
    vm = ET.SubElement(root, 'ViewModel', id='0:40', name=name, defaultInstanceId='0:41')
    vm.append(el('ViewModelPropertyNumber', id='0:45', name='stage'))
    instance = ET.SubElement(vm, 'ViewModelInstance', id='0:41', name='Default', exports='true')
    instance.append(el('ViewModelInstanceNumber', viewModelPropertyId='0:45', propertyValue=0))
    for node in root.iter():
        if node is not root: identity(node)
    ids = [node.get('id') for node in root.iter() if node.get('id')]
    assert len(ids) == len(set(ids)), 'Duplicate RML IDs'
    ET.indent(root, space='  ')
    folder = ROOT / slug
    folder.mkdir(exist_ok=True)
    (folder / 'scene.rml').write_text(ET.tostring(root, encoding='unicode')+'\n')
    (folder / 'rive.yaml').write_text(f'name: {slug}\nlogs:\n  file: build/rive.log\n  problems: build/problems.log\n')
    print(f'{slug}: five states, editable vectors and 6-second loops')


def tent():
    layers, tracks = build_tent()
    curtain = path('Daily entrance curtain', 'M935 439 C995 446 1060 440 1128 438 L1232 741 Q1040 765 873 783 Z', 'EAB477', 4.4, '140D08')
    # Inside the existing doorway, behind the authored hems and rolled cover.
    index = next(i for i, node in enumerate(layers) if node.get('name') == 'Tent open doorway interior')
    layers.insert(index+1, curtain)
    vertices = list(curtain.iter('CubicDetachedVertex'))
    base = {node.get('id'): node for layer in layers for node in layer.iter() if node.get('id')}
    # Stable placement crops away the old artboard's unused margins.
    drawing = group('Original tent', layers, x=-60, y=-120)

    def animate(animation, stage):
        for track in tracks:
            original = float(base[track['id']].get(track['property']))
            strength = [0, .3, .65, 1.1, 1.7][stage]
            samples = [(0, original)] if stage == 0 else [(f, original+(v-original)*strength) for f, v in track['keys'] if f % 12 == 0]
            keys(animation, track['id'], track['property'], samples)
        drop = [1, .8, .5, .2, 0][stage]
        # Morph the lower edge and its Bezier handles; the base and ropes stay fixed.
        for vertex in vertices:
            x = float(vertex.get('x'))
            y = float(vertex.get('y'))
            anchor_x = 935 if x < 1000 else 1128
            fixed(animation, vertex, 'x', anchor_x+(x-anchor_x)*drop if y > 500 else x)
            fixed(animation, vertex, 'y', 440+(y-440)*drop)
            for side in ('in', 'out'):
                from math import cos
                angle = float(vertex.get(side+'Rotation'))
                distance = float(vertex.get(side+'Distance'))
                dx, dy = cos(angle)*distance*(drop if y > 500 else 1), sin(angle)*distance*drop
                fixed(animation, vertex, side+'Rotation', atan2(dy, dx))
                fixed(animation, vertex, side+'Distance', hypot(dx, dy))
        fixed(animation, curtain, 'opacity', 0 if stage == 4 else 1)
    project('tent', 'TentStates', 1460, 780, [drawing], animate)


def svg_paths(data):
    """The authored backpack uses M/L/H/V/C/Q/Z, including relative subpaths."""
    tokens = re.findall(r'[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?', data)
    i, command, cursor, start = 0, None, 0j, 0j
    output, current = [], []
    while i < len(tokens):
        if tokens[i].isalpha():
            command = tokens[i]; i += 1
        upper, relative = command.upper(), command.islower()
        if upper == 'Z':
            current.append('Z'); output.append(' '.join(current)); current=[]; cursor=start; command=None
            continue
        count = {'M':2, 'L':2, 'H':1, 'V':1, 'C':6, 'Q':4}[upper]
        values = list(map(float, tokens[i:i+count])); i += count
        if upper in ('H','V'):
            target = complex(values[0]+(cursor.real if relative else 0), cursor.imag) if upper == 'H' else complex(cursor.real, values[0]+(cursor.imag if relative else 0))
            points = [target]; draw='L'
        else:
            points = [complex(values[j],values[j+1])+(cursor if relative else 0) for j in range(0,count,2)]; draw=upper
        if upper == 'M':
            if current: output.append(' '.join(current))
            current=[]; start=points[0]; command='l' if relative else 'L'
        current.append(draw+' '+' '.join(f'{p.real:g} {p.imag:g}' for p in points))
        cursor=points[-1]
    if current: output.append(' '.join(current))
    return output


def svg_layer(element, inherited=None):
    style = {**(inherited or {}), **element.attrib}
    tag = element.tag.split('}')[-1]
    if tag in ('svg','g'):
        node = group('Backpack layer', [svg_layer(child, style) for child in element])
        transform = element.get('transform','')
        # Nest SVG transforms in authored order (translation → rotation about pivot → scale).
        for kind, params in reversed(re.findall(r'(translate|rotate|scale)\(([^)]+)\)', transform)):
            v = [float(n) for n in re.split(r'[,\s]+',params.strip())]
            if kind == 'translate': node = group('Parcel position', [node], x=v[0], y=v[1] if len(v)>1 else 0)
            elif kind == 'scale': node = group('Parcel size', [node], scaleX=v[0], scaleY=v[-1])
            else:
                cx,cy = (v[1],v[2]) if len(v)==3 else (0,0)
                node = group('Parcel tilt', [group('Pivot', [node], x=-cx,y=-cy)], x=cx,y=cy,rotation=v[0]*pi/180)
        return node
    fill = style.get('fill','none'); stroke = style.get('stroke','none')
    color = None if fill=='none' else fill.lstrip('#')
    width = 0 if stroke=='none' else float(style.get('stroke-width','2.4'))
    ink = stroke.lstrip('#') if width else '26291e'
    if tag == 'path':
        shapes = [path('Backpack contour', contour, color, width, ink) for contour in svg_paths(element.get('d'))]
    elif tag == 'circle':
        shape = ellipse('Hardware', float(element.get('cx')), float(element.get('cy')), float(element.get('r'))*2,float(element.get('r'))*2,color or '26291e')
        if width:
            paint=ET.SubElement(shape,'Stroke',thickness=str(width)); paint.append(el('SolidColor',colorValue='FF'+ink))
        shapes=[shape]
    else: raise ValueError(f'Unsupported SVG element {tag}')
    for shape in shapes:
        for paint in shape.findall('Stroke'):
            color_node = paint.find('SolidColor')
            alpha = round(float(style.get('stroke-opacity','1')) * 255)
            color_node.set('colorValue', f'{alpha:02X}'+color_node.get('colorValue')[-6:])
    return group('Backpack detail',shapes)


def provisions():
    layers = []
    for index, stage in enumerate(['resting','first','stocked','full','extra']):
        svg = ET.parse(ROOT/'references'/f'provisions-{stage}.svg').getroot()
        drawing = svg_layer(svg)
        # Parcel transforms give us exact semantic motion targets without rasterizing.
        parcels = [n for n in drawing.iter() if n.get('name') == 'Parcel tilt']
        node = group(f'{stage} backpack', [drawing], opacity=int(index==0), x=12,y=10)
        layers.append((node,parcels))
    def animate(animation,stage):
        for index,(node,parcels) in enumerate(layers):
            fixed(animation,node,'opacity',int(index==stage))
            for ordinal,parcel in enumerate(parcels):
                wave(animation,parcel,'rotation',float(parcel.get('rotation')),0 if stage==0 else .012+stage*.004, 1+ordinal%2)
    project('provisions','ProvisionsStates',224,260,[node for node,_ in layers],animate)


def plants():
    ink='443828'
    layers=[]; stems=[]; flowers=[]
    # A single persistent terracotta pot; daily activity changes its greenery.
    layers.append(ellipse('Soil',200,287,151,40,'674A30'))
    for ordinal,(x,y,angle,size) in enumerate([(200,283,0,1),(174,285,-.42,.72),(226,287,.45,.66)]):
        leaves=[]
        stem=path('Stem','M0 0 C-4 -38 8 -78 1 -133',None,6,'55723D'); leaves.append(stem)
        for n,(height,direction) in enumerate([(-38,-1),(-65,1),(-92,-1),(-120,1)]):
            leaf=path('Leaf blade','M0 0 C-26 -2 -54 -25 -51 -45 C-22 -48 -1 -23 0 0 Z','7E9D4D' if n%2 else '97AE5C',2.8,ink)
            vein=path('Leaf vein','M-1 -2 Q-22 -22 -40 -34',None,1.6,'5C793E')
            leaves.append(group('Leaf',[leaf,vein],x=0,y=height,scaleX=direction))
        petals=[]
        for p in range(6):
            petal=path('Petal','M0 0 C-19 -9 -19 -34 0 -35 C19 -34 19 -9 0 0 Z','E8C477',2.5,ink)
            petals.append(group('Petal angle',[petal],rotation=p*pi/3))
        petals.append(ellipse('Flower centre',0,0,19,19,'B77C3F'))
        blossom=group('Blossom',petals,y=-145)
        identity(blossom); flowers.append(blossom); leaves.append(blossom)
        plant=group(f'Greenery {ordinal}',leaves,x=x,y=y,rotation=angle,scaleX=size,scaleY=size)
        identity(plant); stems.append((plant,angle,size)); layers.append(plant)
    layers.extend([
        path('Pot body','M125 286 L142 351 Q200 379 257 351 L274 286 Z','CB713A',3.5,ink),
        path('Pot lit face','M137 301 L151 345 Q178 358 204 357 L211 306 Z','DF8A47',0),
        path('Pot rim','M120 278 Q199 310 280 278 L278 303 Q198 332 122 302 Z','E79953',3.5,ink),
        path('Rim upper lip','M120 278 Q199 305 280 278',None,4,'F0B477'),
    ])
    def animate(animation,stage):
        for index,(node,angle,size) in enumerate(stems):
            scale=[.3,.45,.65,.84,1][stage]*size
            fixed(animation,node,'scaleY',scale)
            fixed(animation,node,'scaleX',[.45,.6,.8,.94,1][stage]*size)
            fixed(animation,node,'opacity',1 if index==0 or stage>=2 else 0)
            wave(animation,node,'rotation',angle,[0,.015,.025,.04,.055][stage],1+index%2)
            flower=flowers[index]
            fixed(animation,flower,'opacity',int(stage>=3 if index==0 else stage>=4))
            fixed(animation,flower,'scaleX',.75 if stage==3 else 1)
            fixed(animation,flower,'scaleY',.75 if stage==3 else 1)
    project('plants','PlantStates',280,330,[group('Potted greenery',layers,x=-60,y=-55)],animate)


if __name__ == '__main__':
    tent(); provisions(); plants()
