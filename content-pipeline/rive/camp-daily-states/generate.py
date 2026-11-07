#!/usr/bin/env python3
"""Explicit authoring of three daily poses. Ordinary builds preserve these masters.

Reuses the source tent/fire tracing; all new layers are editable vectors.
No gameplay thresholds, raster deformation, external packages or upstream writes.
"""
from pathlib import Path
from math import atan2, cos, hypot, pi, sin
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / 'camp-scene-vector'))
sys.path.insert(0, str(ROOT.parent / 'campfire-base'))
from vector_utils import el, path, ellipse, group
from tent_art import build_tent, _warp as cloth_warp
from art import build_art
from generate_scene import warp as fire_warp

STAGES = ['Morning', 'Growing', 'Full']
DURATION = 360
counter = 1000


def identity(node):
    global counter
    if not node.get('id'):
        counter += 1
        node.set('id', f'8:{counter}')
    return node.get('id')


def keys(animation, target, prop, values):
    ident = identity(target)
    obj = next((obj for obj in animation.findall('KeyedObject') if obj.get('objectId') == ident), None)
    if obj is None:
        obj = ET.SubElement(animation, 'KeyedObject', objectId=ident)
    keyed = ET.SubElement(obj, 'KeyedProperty', property=prop)
    for frame, value in values:
        keyed.append(el('KeyFrameDouble', frame=frame, value=round(value, 6), interpolationType='linear'))


def fixed(animation, target, prop, value):
    keys(animation, target, prop, [(0, value)])


def wave(animation, target, prop, base, amplitude, cycles=1):
    keys(animation, target, prop, [(f, base + amplitude*sin(f/DURATION*2*pi*cycles)) for f in range(0, DURATION+1, 6)])


def soft_light(shape, radius):
    fill=shape.find('Fill'); fill.clear()
    paint=ET.SubElement(fill,'RadialGradient',startX='0',startY='0',endX=str(radius),endY='0')
    paint.append(el('GradientStop',colorValue='FFFFD577',position=0))
    paint.append(el('GradientStop',colorValue='80FFD577',position=.45))
    paint.append(el('GradientStop',colorValue='00FFD577',position=1))


def morph(animation, vertex, transform, moving=True):
    """Transform the anchor and both handles together, maintaining curve continuity."""
    x, y = float(vertex.get('x')), float(vertex.get('y'))
    handles = {side: (x+cos(float(vertex.get(side+'Rotation')))*float(vertex.get(side+'Distance')),
                      y+sin(float(vertex.get(side+'Rotation')))*float(vertex.get(side+'Distance')))
               for side in ('in', 'out')}
    values = {prop: [] for prop in ('x', 'y', 'inRotation', 'inDistance', 'outRotation', 'outDistance')}
    for frame in (range(0, DURATION+1, 6) if moving else [0]):
        px, py = transform(x, y, frame)
        values['x'].append((frame, px)); values['y'].append((frame, py))
        for side, (cx, cy) in handles.items():
            qx, qy = transform(cx, cy, frame)
            angle = atan2(qy-py, qx-px)
            reference = float(vertex.get(side+'Rotation'))
            angle = reference+(angle-reference+pi)%(2*pi)-pi
            values[side+'Rotation'].append((frame, angle))
            values[side+'Distance'].append((frame, hypot(qx-px, qy-py)))
    for prop, samples in values.items():
        if len({round(v, 6) for _, v in samples}) == 1:
            samples = samples[:1]
        keys(animation, vertex, prop, samples)


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
    for stage in range(len(STAGES)):
        transition = ET.SubElement(any_state, 'StateTransition', stateToId=f'0:{200+stage}', duration='550')
        condition = ET.SubElement(transition, 'TransitionViewModelCondition', opValue='equal')
        comparator = ET.SubElement(condition, 'TransitionPropertyViewModelComparator')
        bindable = ET.SubElement(comparator, 'BindablePropertyNumber')
        bindable.append(el('DataBindContext', sourcePathIds='0:40-0:45', propertyKey='636'))
        condition.append(el('TransitionValueNumberComparator', value=stage))
    layer.append(el('ExitState', x=200, y=-100))
    entry = ET.SubElement(layer, 'EntryState', x='0', y='100')
    entry.append(el('StateTransition', stateToId='0:200'))
    for stage, label in enumerate(STAGES):
        layer.append(el('AnimationState', id=f'0:{200+stage}', animationId=f'0:{100+stage}', x=160+stage*180, y=100))
        animation = ET.SubElement(board, 'LinearAnimation', id=f'0:{100+stage}', name=label, fps='60', duration=str(DURATION), loopValue='loop')
        animate(animation, stage)
    vm = ET.SubElement(root, 'ViewModel', id='0:40', name=name, defaultInstanceId='0:41')
    vm.append(el('ViewModelPropertyNumber', id='0:45', name='stage'))
    instance = ET.SubElement(vm, 'ViewModelInstance', id='0:41', name='Default', exports='true')
    instance.append(el('ViewModelInstanceNumber', viewModelPropertyId='0:45', propertyValue=0))
    for node in root.iter():
        if node is not root: identity(node)
    ids = [node.get('id') for node in root.iter() if node.get('id')]
    assert len(ids) == len(set(ids)), f'{slug}: duplicate RML IDs'
    ET.indent(root, space='  ')
    folder = ROOT/slug; folder.mkdir(exist_ok=True)
    (folder/'scene.rml').write_text(ET.tostring(root, encoding='unicode')+'\n')
    (folder/'rive.yaml').write_text(f'name: {slug}\nlogs:\n  file: build/rive.log\n  problems: build/problems.log\n')
    print(f'{slug}: three editable states, independent 6-second loops')


def tent():
    layers, _ = build_tent()
    slack = path('Slack canvas crease', 'M360 656 Q520 615 700 675 Q870 720 1000 600', None, 4, '79482B')
    layers.insert(3, slack)
    def fold(x, y, stage):
        ground = 803 - (674-x)*.163 if x < 674 else 803-(x-674)*.133
        depth = max(0, ground-y)
        # The rear pole is lower and the ridge leans forward before assembly.
        raised = ([.18, .62, 1][stage] + [ .16, .12, 0][stage]*max(0, min(1, (x-400)/650)))
        return x-[.23,.07,0][stage]*depth, ground+(y-ground)*raised
    def animate(animation, stage):
        for shape in layers:
            name=shape.get('name','')
            if 'stake' in name: continue
            moving = ('canvas' in name or 'flap' in name) and shape is not slack
            mode = 'flap-left' if 'left' in name and 'flap' in name else 'flap-right' if 'right' in name and 'flap' in name else 'canvas'
            def transform(x,y,f):
                if moving:
                    wx,wy=cloth_warp(x,y,f,mode)
                    strength=[.2,.7,1.2][stage]
                    x,y=x+(wx-x)*strength,y+(wy-y)*strength
                return fold(x,y,stage)
            for vertex in shape.iter('CubicDetachedVertex'):
                morph(animation,vertex,transform,moving)
        fixed(animation,slack,'opacity',[1,.45,0][stage])
    project('tent','TentStates',1460,780,[group('Tent assembly',layers,x=-60,y=-120)],animate)


def campfire():
    layers, flames = build_art()
    glow = ellipse('Warm light',670,730,850,770,'FFC956')
    soft_light(glow,425)
    layers.insert(0,glow)
    def animate(animation,stage):
        wave(animation,glow,'opacity',[.015,.06,.12][stage],[.004,.012,.02][stage],3)
        for index,flame in enumerate(flames):
            def transform(x,y,f):
                wx,wy=fire_warp(x,y,f,index)
                sx,sy=[.4,.73,1][stage],[.24,.62,1][stage]
                return 675+(wx-675)*sx, 826+(wy-826)*sy
            for vertex in flame['vertices']:
                morph(animation,vertex,transform)
    project('campfire','CampfireStates',950,1140,[group('Original fire',layers,x=-195,y=0)],animate)


def plants():
    ink='332A16'
    layers=[]; stems=[]; blossoms=[]
    # White daisies, olive leaves and a grass clump follow screen-studies/flowers.png.
    for ordinal,(x,y,angle,size) in enumerate([(240,382,0,1),(177,386,-.42,.72),(293,385,.46,.65),(137,390,-.7,.48),(330,390,.67,.48)]):
        leaves=[path('Daisy stem','M-4 0 Q-12 -80 0 -192 Q9 -83 5 0 Z','71833F',2.6,ink)]
        for height,direction in [(-35,-1),(-72,1),(-112,-1)]:
            blade=path('Olive leaf','M0 0 C-42 -15 -61 -57 -45 -82 C-15 -71 3 -30 0 0 Z','85994D',2.6,ink)
            leaves.append(group('Leaf',[blade],y=height,scaleX=direction,scaleY=.8))
        petals=[]
        for p in range(7):
            petal=path('Ivory petal','M0 0 C-23 -8 -25 -47 -7 -56 C14 -65 24 -38 14 -9 Z','FFF8E9',2.7,ink)
            petals.append(group('Petal angle',[petal],rotation=p*2*pi/7))
        centre=ellipse('Golden centre',0,0,42,34,'EFC24C')
        stroke=ET.SubElement(centre,'Stroke',thickness='2.7');stroke.append(el('SolidColor',colorValue='FF'+ink))
        petals.append(centre)
        flower=group('Daisy',petals,y=-192,rotation=[.1,-.2,.25,-.1,.3][ordinal])
        blossoms.append(flower);leaves.append(flower)
        node=group(f'Plant {ordinal}',leaves,x=x,y=y,rotation=angle,scaleX=size,scaleY=size)
        stems.append((node,angle,size));layers.append(node)
    turf=path('Grass clump','M65 394 Q48 382 75 371 L52 339 Q80 343 100 368 L105 324 Q126 340 134 366 Q154 338 168 366 L197 327 L210 364 L239 322 L250 361 L280 339 L279 366 L319 325 L315 364 L356 338 L342 376 Q395 361 409 384 Q429 408 379 413 Q340 434 287 416 Q238 438 193 420 Q126 435 107 416 Q65 424 65 394 Z','9EB260',3,ink)
    base=group('Grass', [turf],x=240,y=405)
    turf.set('x','-240');turf.set('y','-405');layers.append(base)
    def animate(animation,stage):
        fixed(animation,base,'scaleX',[.42,.74,1][stage]);fixed(animation,base,'scaleY',[.65,.85,1][stage])
        for index,(node,angle,size) in enumerate(stems):
            visible=index < [1,3,5][stage]
            fixed(animation,node,'opacity',int(visible))
            scale=[.38,.69,1][stage]*size
            fixed(animation,node,'scaleX',scale);fixed(animation,node,'scaleY',scale)
            wave(animation,node,'rotation',angle,[.015,.027,.04][stage],1+index%2)
            fixed(animation,blossoms[index],'opacity',int(stage==2 or (stage==1 and index==0)))
            fixed(animation,blossoms[index],'scaleX',[.35,.8,1][stage]);fixed(animation,blossoms[index],'scaleY',[.35,.8,1][stage])
    project('plants','PlantStates',480,465,layers,animate)


def lamp():
    ink='332B17';olive='737B42';lit='92995B'
    layers=[]
    halo=ellipse('Soft amber halo',210,275,350,330,'FFD577');layers.append(halo)
    soft_light(halo,175)
    layers.append(path('Carry handle','M92 178 C85 85 111 27 199 25 C286 22 320 92 311 182',None,12,ink))
    layers.append(path('Handle highlight','M92 178 C85 85 111 27 199 25 C286 22 320 92 311 182',None,7,'9B9067'))
    glass=path('Clear glass','M126 215 Q105 297 128 346 Q205 377 278 346 Q304 293 279 215 Z','E9E7BB',4,ink)
    layers.append(glass)
    inner_glow=path('Glass warmth','M133 222 Q115 294 135 339 Q205 364 271 339 Q292 290 273 222 Z','FFE2A0',0)
    layers.append(inner_glow)
    wick=path('Visible wick','M204 345 L204 314',None,7,ink)
    fire=path('Lamp flame','M204 315 C175 304 187 275 205 250 C204 270 228 281 221 302 Q216 315 204 315 Z','FFBD48',2.5,ink)
    heart=path('Lamp flame heart','M204 313 C194 304 198 293 205 282 Q221 306 204 313 Z','FFF6CF',0)
    flame=group('Wick flame',[fire,heart],x=204,y=315)
    for shape in (fire,heart):shape.set('x','-204');shape.set('y','-315')
    layers.extend([wick,flame])
    layers.extend([
        path('Left frame','M115 206 L102 337 Q100 364 143 376 L148 360 Q119 347 122 331 L138 213 Z',olive,4,ink),
        path('Right frame','M267 207 L286 334 Q289 356 264 367 L274 381 Q314 362 309 331 L289 205 Z',olive,4,ink),
        path('Cross guard descending','M126 252 Q155 287 281 343',None,5,'786F47'),
        path('Cross guard ascending','M130 339 Q170 295 282 259',None,5,'786F47'),
        path('Green base','M132 358 Q203 337 277 359 L297 406 Q302 423 277 431 Q207 454 130 435 Q109 431 113 410 Z',olive,4,ink),
        path('Base lip','M114 409 Q204 444 294 410 L299 426 Q211 463 111 430 Z',lit,4,ink),
        path('Oil window frame','M154 367 Q206 357 258 367 L264 412 Q209 431 147 412 Z','4C5431',3.2,ink),
        path('Oil reservoir glass','M160 374 Q208 364 251 374 L256 406 Q208 421 155 406 Z','E8DDB3',2.2,ink),
    ])
    oil=path('Visible golden oil','M157 403 Q208 415 254 403 L254 406 Q208 420 156 406 Z','DDA542',0)
    layers.append(oil)
    meniscus=path('Oil surface','M157 403 Q208 414 254 403',None,2,'F9D577');layers.append(meniscus)
    layers.extend([
        path('Reservoir reflection','M164 380 L162 397',None,3,'FFF9DC'),
        ellipse('Fill cap',128,363,39,16,lit),
        path('Lower roof','M112 185 Q205 135 295 185 L313 204 Q210 235 92 207 Z',olive,4,ink),
        path('Roof edge','M92 207 Q207 235 313 204 L311 217 Q207 247 94 220 Z',lit,3.5,ink),
        path('Vent chamber','M145 144 L145 179 Q209 202 267 177 L267 143 Z',olive,4,ink),
        path('Upper roof','M130 145 Q139 123 182 120 L181 104 L227 104 L227 120 Q271 126 281 144 Q214 173 130 145 Z',lit,4,ink),
        ellipse('Top knob',204,103,51,16,olive),
    ])
    for x in [159,187,218,249]:layers.append(path('Vent slot',f'M{x} 157 L{x} 171',None,6,ink))
    for x in [99,306]:layers.append(ellipse('Handle hinge',x,191,22,27,'95885D'))
    def animate(animation,stage):
        wave(animation,halo,'opacity',[.015,.11,.25][stage],[.003,.008,.012][stage],1)
        fixed(animation,halo,'scaleX',[.75,.88,1][stage]);fixed(animation,halo,'scaleY',[.75,.88,1][stage])
        wave(animation,inner_glow,'opacity',[.08,.42,.8][stage],[.01,.025,.04][stage],1)
        wave(animation,flame,'scaleX',[.38,.67,1][stage],[.012,.02,.025][stage],2)
        wave(animation,flame,'scaleY',[.3,.63,1][stage],[.012,.02,.03][stage],3)
        for shape in (oil,meniscus):
            for index,vertex in enumerate(shape.iter('CubicDetachedVertex')):
                # Only the surface rises. The floor of the tank stays fixed.
                lift=[0,14,28][stage] if shape is meniscus or index<2 else 0
                morph(animation,vertex,lambda x,y,f:(x,y-lift),False)
    project('lamp','LampStates',420,480,layers,animate)


if __name__ == '__main__':
    tent(); campfire(); plants(); lamp()
