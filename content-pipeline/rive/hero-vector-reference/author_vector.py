#!/usr/bin/env python3
"""Explicit manual-reference retarget bootstrap. NEVER invoked by ordinary build.

Manual landmark annotations -> offline two-bone fit -> sparse native bone keys.
It does not extract motion automatically, trace frames, or edit source artwork.
"""
from __future__ import annotations
import argparse, copy, hashlib, json, math
from pathlib import Path
import xml.etree.ElementTree as ET
HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent / "hero-wardrobe/references/hero-from-editor.rml"
REFERENCE = HERE / "evidence/reference-poses.json"
SERIAL = 1000
def add(parent, tag, **attrs):
    global SERIAL
    attrs.setdefault("id", f"94:{SERIAL}")
    SERIAL += 1
    return ET.SubElement(parent, tag, {k: str(v) for k, v in attrs.items()})


def point(v):
    return float(v.get("x", 0)), float(v.get("y", 0))


def handle(v, kind):
    p = point(v)
    a, d = float(v.get(kind + "Rotation", 0)), float(v.get(kind + "Distance", 0))
    return p[0] + math.cos(a) * d, p[1] + math.sin(a) * d


def mix(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def split(curve, t):
    a, b, c, d = curve
    ab, bc, cd = mix(a, b, t), mix(b, c, t), mix(c, d, t)
    abc, bcd = mix(ab, bc, t), mix(bc, cd, t)
    m = mix(abc, bcd, t)
    return (a, ab, abc, m), (m, bcd, cd, d)


def packed(influences):
    raw = [round(x * 255) for x in influences]
    raw[max(range(len(raw)), key=raw.__getitem__)] += 255 - sum(raw)
    active = [(i + 1, w) for i, w in enumerate(raw) if w]
    return sum(w << (8 * slot) for slot, (_, w) in enumerate(active)), sum(i << (8 * slot) for slot, (i, _) in enumerate(active))


def sleeve_weight(segment, t):
    # Tendons: fixed torso anchor, upper arm, forearm. Pin both shoulder-seam
    # endpoints and their closing edge; blend around the elbow instead of a cut.
    controls = {
        0: [(0, (1, 0, 0)), (.22, (.18, .82, 0)), (.70, (0, 1, 0)), (1, (0, .48, .52))],
        1: [(0, (0, .48, .52)), (.35, (0, 0, 1)), (1, (0, 0, 1))],
        2: [(0, (0, 0, 1)), (1, (0, 0, 1))],
        3: [(0, (0, 0, 1)), (.65, (0, 0, 1)), (1, (0, .48, .52))],
        4: [(0, (0, .48, .52)), (.30, (0, 1, 0)), (.78, (.18, .82, 0)), (1, (1, 0, 0))],
        5: [(0, (1, 0, 0)), (1, (1, 0, 0))],
    }[segment]
    for (a, wa), (b, wb) in zip(controls, controls[1:]):
        if t <= b:
            return packed(mix(wa, wb, (t - a) / (b - a)))
    return packed(controls[-1][1])


def skin_sleeve(path, bones, bind_origin, shoulder, elbow, upper_angle, fore_angle):
    old = list(path)
    curves = []
    for i, v in enumerate(old):
        following = old[(i + 1) % len(old)]
        curve = (point(v), handle(v, "out"), handle(following, "in"), point(following))
        left, right = split(curve, 1 / 3)
        mid, end = split(right, .5)
        curves.extend([(left, i, 0), (mid, i, 1), (end, i, 2)])
    for v in old:
        path.remove(v)
    for i, (curve, segment, third) in enumerate(curves):
        p, out = curve[:2]
        incoming, previous_segment, previous_third = curves[i - 1]
        incoming = incoming[2]
        def polar(q):
            dx, dy = q[0] - p[0], q[1] - p[1]
            return math.atan2(dy, dx), math.hypot(dx, dy)
        ir, il = polar(incoming)
        ora, ol = polar(out)
        v = add(path, "CubicDetachedVertex", x=p[0], y=p[1],
                inRotation=ir, inDistance=il, outRotation=ora, outDistance=ol)
        pv, pi = sleeve_weight(segment, third / 3)
        iv, ii = sleeve_weight(previous_segment, (previous_third + 2 / 3) / 3)
        ov, oi = sleeve_weight(segment, (third + 1 / 3) / 3)
        add(v, "CubicWeight", values=pv, indices=pi, inValues=iv, inIndices=ii, outValues=ov, outIndices=oi)
    bx, by = bind_origin
    skin = add(path, "Skin", name="Original sleeve continuous skin", tx=bx, ty=by)
    for bone, position, angle in zip(bones, [(0, 0), shoulder, elbow], [0, upper_angle, fore_angle]):
        add(skin, "Tendon", name=bone.get("name") + " bind", boneId=bone.get("id"),
            xx=math.cos(angle), xy=math.sin(angle), yx=-math.sin(angle), yy=math.cos(angle),
            tx=bx + position[0], ty=by + position[1])



def track(anim, element, prop_name, values, hold=False, prop_key=None):
    obj = add(anim, 'KeyedObject', objectId=element.get('id'))
    prop = add(obj, 'KeyedProperty', **({'propertyKey':prop_key} if prop_key else {'property':prop_name}))
    for frame, value in values:
        tag = 'KeyFrameId' if prop_key else 'KeyFrameDouble'
        k = add(prop, tag, frame=frame, value=value if prop_key else round(value,9), interpolationType='hold' if hold else 'cubic')
        if not hold:
            add(k, 'CubicEaseInterpolator', x1=.30, y1=0, x2=.65, y2=1)


def condition(parent, target, value):
    t = add(parent, 'StateTransition', stateToId=target, duration=0)
    c = add(t, 'TransitionViewModelCondition', opValue='equal')
    comp = add(c, 'TransitionPropertyViewModelComparator')
    prop = add(comp, 'BindablePropertyNumber')
    add(prop, 'DataBindContext', sourcePathIds='94:3-94:5', propertyKey=636)
    add(c, 'TransitionValueNumberComparator', value=value)


def unwrap(angle, previous):
    return previous + (angle - previous + math.pi) % (2*math.pi) - math.pi


def fit_arm(shoulder, elbow, wrist, poses, key):
    a0=math.atan2(elbow[1]-shoulder[1], elbow[0]-shoulder[0])
    f0=math.atan2(wrist[1]-elbow[1], wrist[0]-elbow[0])
    la,lb=math.dist(shoulder,elbow),math.dist(elbow,wrist)
    initial_palm=poses[0][key]['palm_center']
    initial_wrist=poses[0][key]['wrist']
    h0=math.atan2(initial_palm[1]-initial_wrist[1],initial_palm[0]-initial_wrist[0])
    prev=(a0,f0-a0,-f0)
    output=[]
    for pose in poses:
        frame=pose['frame_zero_based']; ref=copy.deepcopy(pose[key])
        source_wrist=list(ref['wrist'])
        # Vector hair is wider than the source video: a small authored lateral
        # clearance keeps the fingers partially visible beside the temple.
        if key=='screen_left_arm' and 45<=frame<=84:
            ref['wrist'][0]-=18;ref['palm_center'][0]-=18
        target=ref['wrist']
        if frame<=36:
            a,b,h=prev; fitted_elbow=elbow; fitted_wrist=wrist
        else:
            dx,dy=target[0]-shoulder[0],target[1]-shoulder[1]
            radius=min(la+lb-.001,max(abs(la-lb)+.001,math.hypot(dx,dy)))
            base=math.atan2(dy,dx)
            bend=math.acos(max(-1,min(1,(la*la+radius*radius-lb*lb)/(2*la*radius))))
            options=[]
            for aa in [base-bend,base+bend]:
                ee=(shoulder[0]+la*math.cos(aa),shoulder[1]+la*math.sin(aa))
                options.append((math.dist(ee,ref['elbow']),aa,ee))
            _,a,fitted_elbow=min(options)
            f=math.atan2(target[1]-fitted_elbow[1],target[0]-fitted_elbow[0])
            a=unwrap(a,prev[0]); b=unwrap(f-a,prev[1])
            palm=ref['palm_center']
            hd=math.atan2(palm[1]-target[1],palm[0]-target[0])-h0
            h=unwrap(hd-a-b,prev[2])
            fitted_wrist=(fitted_elbow[0]+lb*math.cos(a+b),fitted_elbow[1]+lb*math.sin(a+b))
        prev=(a,b,h)
        output.append({'frame':frame,'reference_wrist':source_wrist,'adapted_wrist_target':target,'reference_elbow':ref['elbow'],
          'fitted_elbow':list(fitted_elbow),'fitted_wrist':list(fitted_wrist),
          'wrist_error_px':math.dist(target,fitted_wrist),'upper_rotation':a,'forearm_rotation':b,'wrist_rotation':h})
    return output


def watch(parent):
    node=add(parent,'Node',name='Draft watch on screen-right wrist',x=9,y=-3,opacity=0)
    face=add(node,'Shape',name='Draft watch face',rotation=-.15)
    add(face,'Ellipse',width=28,height=32)
    fill=add(face,'Fill');add(fill,'SolidColor',colorValue='FFBAD9B5')
    stroke=add(face,'Stroke',thickness=3.2);add(stroke,'SolidColor',colorValue='FF24241B')
    needle=add(node,'Shape',name='Watch hands')
    path=add(needle,'PointsPath');add(path,'StraightVertex',x=-1,y=-10);add(path,'StraightVertex',x=-1,y=0);add(path,'StraightVertex',x=7,y=1)
    stroke=add(needle,'Stroke',thickness=2.3,cap='round',join='round');add(stroke,'SolidColor',colorValue='FF24241B')
    node.remove(needle);node.insert(0,needle)
    strap=add(node,'Shape',name='Draft watch strap')
    add(strap,'Rectangle',width=11,height=42,cornerRadiusTL=3,cornerRadiusTR=3,cornerRadiusBL=3,cornerRadiusBR=3)
    fill=add(strap,'Fill');add(fill,'SolidColor',colorValue='FF557F69')
    stroke=add(strap,'Stroke',thickness=2);add(stroke,'SolidColor',colorValue='FF24241B')
    return node

def temple_hand(parent):
    node=add(parent,'Node',name='Draft relaxed temple hand',opacity=0)
    shape=add(node,'Shape',name='Draft extended fingers')
    path=add(shape,'PointsPath',isClosed='true')
    pts=[(-8,-13),(10,-14),(25,-11),(39,-8),(44,-3),(44,4),(40,10),(27,13),(11,13),(-7,12)]
    for i,p in enumerate(pts):
        before,after=pts[i-1],pts[(i+1)%len(pts)];dx=(after[0]-before[0])*.14;dy=(after[1]-before[1])*.14
        ang=math.atan2(dy,dx);dist=math.hypot(dx,dy)
        add(path,'CubicDetachedVertex',x=p[0],y=p[1],inRotation=ang+math.pi,inDistance=dist,outRotation=ang,outDistance=dist)
    fill=add(shape,'Fill');add(fill,'SolidColor',colorValue='FFF2C9A3')
    stroke=add(shape,'Stroke',thickness=3.8,cap='round',join='round');add(stroke,'SolidColor',colorValue='FF24241B')
    return node

def stable_sleeve(arm, fore, rest, gesture):
    """Draft two-part sleeve. Native bone-local contours cannot LBS-invert.

    Original exact sleeve remains in Rest. A short reveal during the first
    movement uses the same palette/outline, with a round joint for folded poses.
    """
    def shape(parent,name,coords):
        sh=add(parent,'Shape',name=name,opacity=0)
        path=add(sh,'PointsPath',isClosed='true')
        for x,y,ir,il,ora,ol in coords:
            add(path,'CubicDetachedVertex',x=x,y=y,inRotation=ir,inDistance=il,outRotation=ora,outDistance=ol)
        fill=add(sh,'Fill');add(fill,'SolidColor',colorValue='FFEDEBD1')
        stroke=add(sh,'Stroke',thickness=3.8,cap='round',join='round');add(stroke,'SolidColor',colorValue='FF24241B')
        track(rest,sh,'opacity',[(0,0)],True)
        track(gesture,sh,'opacity',[(0,0),(36,0),(38,1),(120,1)])
        return sh
    la=float(arm.get('length'));lb=float(fore.get('length'))
    # Broad shoulder disappears under the original torso and neckline; distal
    # contours keep enough overlap to avoid a seam at any elbow rotation.
    up=shape(arm,'Draft upper sleeve - bone local',[
        (-8,-26,math.pi,12,0,38),(la,-21,math.pi,38,0,13),
        (la+21,0,-math.pi/2,12,math.pi/2,12),(la,21,0,13,math.pi,38),
        (-8,26,0,38,math.pi,16),(-28,0,math.pi/2,16,-math.pi/2,16)])
    forepart=shape(fore,'Draft fore sleeve - bone local',[
        (-4,-20,math.pi,12,0,32),(lb,-16,math.pi,28,math.pi/2,10),
        (lb,16,-math.pi/2,10,math.pi,28),(-4,20,0,32,math.pi,12),
        (-23,0,math.pi/2,12,-math.pi/2,12)])
    # Move each filled sleeve behind the hand descendants; the forearm is in
    # front of the upper sleeve in the shared elbow area.
    arm.remove(up);arm.append(up)
    fore.remove(forepart);fore.append(forepart)
    for sh in [up,forepart]:
        rules=add(sh,'DrawRules',name='Draft sleeve cloth order')
        back=add(rules,'DrawTarget',drawableId='9:13992',placementValue='after')
        front=add(rules,'DrawTarget',drawableId='9:13992',placementValue='before')
        rules.set('drawTargetId',back.get('id'))
        if sh is forepart:
            track(rest,rules,None,[(0,back.get('id'))],True,121)
            track(gesture,rules,None,[(0,back.get('id')),(88,front.get('id'))],True,121)
    return up,forepart


def bootstrap(replace=False):
    project=HERE/'chewy'
    if (project/'scene.rml').exists() and not replace:
        raise SystemExit('Saved master exists. Build it directly; --replace-master explicitly overwrites pilot edits.')
    reference=json.loads(REFERENCE.read_text())
    poses=[p for p in reference['poses'] if p['frame_zero_based']!=99]
    root=ET.parse(SOURCE).getroot();board=root.find('Artboard')
    board.set('name','ChewyReference');board.set('defaultStateMachineId','94:2')
    board.set('viewModelId','94:3');board.set('viewModelInstanceId','94:4');board.attrib.pop('spaceId',None)
    for child in list(root):
        if child.tag=='Space':root.remove(child)
    originals=[]
    for child in list(board):
        if child.tag in ['StateMachine','LinearAnimation']:board.remove(child)
        elif child.tag!='LayoutComponentStyle':board.remove(child);originals.append(child)
    placement=add(board,'Node',name='Hero placement',x=0,y=0);placement.extend(originals)
    upper=placement.find("Node[@id='5:10']")
    vm=add(root,'ViewModel',id='94:3',name='ChewyReference',defaultInstanceId='94:4')
    inst=add(vm,'ViewModelInstance',id='94:4',name='Default',exports='true')
    for name,pid in [('action','94:5'),('lookX','94:6'),('lookY','94:7')]:
        add(vm,'ViewModelPropertyNumber',id=pid,name=name)
        add(inst,'ViewModelInstanceNumber',viewModelPropertyId=pid,propertyValue=0)
    rest=add(board,'LinearAnimation',name='Rest',fps=24,duration=1,loopValue='oneShot')
    gesture=add(board,'LinearAnimation',name='ReferenceGesture',fps=24,duration=121,loopValue='oneShot')
    anchor=add(upper,'RootBone',name='Pinned shoulder seams',x=0,y=0,length=0)
    rigs={};fits={}
    for side,shoulder,elbow,wristpoint in [('Left',(190,394),(61,465),(119,548)),('Right',(322,394),(461,465),(402,548))]:
        key='screen_'+side.lower()+'_arm'
        ua=math.atan2(elbow[1]-shoulder[1],elbow[0]-shoulder[0]);fa=math.atan2(wristpoint[1]-elbow[1],wristpoint[0]-elbow[0])
        arm=add(upper,'RootBone',name='Screen '+side.lower()+' upper arm',x=shoulder[0],y=shoulder[1],length=math.dist(shoulder,elbow),rotation=ua)
        fore=add(arm,'Bone',name='Screen '+side.lower()+' forearm',length=math.dist(elbow,wristpoint),rotation=fa-ua)
        wrist=add(fore,'Node',name='Screen '+side.lower()+' wrist',x=math.dist(elbow,wristpoint),y=0,rotation=-fa)
        fist=add(wrist,'Node',name='Preserved '+side.lower()+' fist',x=-wristpoint[0],y=-wristpoint[1])
        for c in list(upper):
            if c.get('name') in [side+' fingers',side+' knuckles',side+' hand']:
                upper.remove(c);fist.append(c)
        upper.remove(arm);upper.insert(1,arm)
        sleeve=upper.find("Shape[@name='"+side+" sleeve']")
        skin_sleeve(sleeve.find('PointsPath'),[anchor,arm,fore],(-1,-6.5),shoulder,elbow,ua,fa)
        rules=add(sleeve,'DrawRules',name=side+' sleeve layer')
        back=add(rules,'DrawTarget',drawableId='9:13992',placementValue='after')
        front=add(rules,'DrawTarget',drawableId='9:13992',placementValue='before')
        rules.set('drawTargetId',back.get('id'))
        track(rest,rules,None,[(0,back.get('id'))],True,121)
        track(gesture,rules,None,[(0,back.get('id')),(88,front.get('id'))],True,121)
        fits[key]=fit_arm(shoulder,elbow,wristpoint,poses,key)
        if side=='Left':
            stable_sleeve(arm,fore,rest,gesture)
            track(rest,sleeve,'opacity',[(0,1)],True)
            track(gesture,sleeve,'opacity',[(0,1),(36,1),(38,0),(120,0)])
            hand=temple_hand(wrist)
            handrules=add(hand,'DrawRules',name='Temple hand over hair edge')
            target=add(handrules,'DrawTarget',drawableId='9:13847',placementValue='before')
            handrules.set('drawTargetId',target.get('id'))
            track(rest,hand,'opacity',[(0,0)],True)
            track(rest,fist,'opacity',[(0,1)],True)
            track(gesture,hand,'opacity',[(0,0),(41,1),(92,1),(96,0)],True)
            track(gesture,fist,'opacity',[(0,1),(41,0),(92,0),(96,1)],True)
        for element,field in [(arm,'upper_rotation'),(fore,'forearm_rotation'),(wrist,'wrist_rotation')]:
            track(rest,element,'rotation',[(0,fits[key][0][field])])
            track(gesture,element,'rotation',[(p['frame'],p[field]) for p in fits[key]])
        rigs[side]=(arm,fore,wrist)
    watchnode=watch(rigs['Right'][2])
    track(rest,watchnode,'opacity',[(0,0)],True)
    track(gesture,watchnode,'opacity',[(0,0),(85,0),(89,1),(120,1)])
    head=upper.find("Node[@id='5:20']")
    headgeo=head.find('Node')
    usergaze=add(headgeo,'Node',name='User gaze offset',x=0,y=0)
    add(usergaze,'DataBindContext',sourcePathIds='94:3-94:6',propertyKey=13)
    add(usergaze,'DataBindContext',sourcePathIds='94:3-94:7',propertyKey=14)
    gaze=add(usergaze,'Node',name='Reference gaze',x=0,y=0)
    eyes=[]
    for eye in list(headgeo):
        if eye.get('name') in ['Left eye','Right eye']:
            headgeo.remove(eye);gaze.append(eye);eyes.append(eye)
    headgeo.remove(usergaze);headgeo.insert(1,usergaze)
    headkeys=[];gx=[];gy=[]
    for p in poses:
        f=p['frame_zero_based'];h=p['head'];mid=h['reference_point_eye_midpoint']
        headkeys.append((f,math.radians(h['eye_line_angle_degrees'])*.35))
        gx.append((f,max(-4,min(4,(mid[0]-253)*.25))))
        gy.append((f,max(0,min(7,(mid[1]-218)*.22))))
    track(rest,head,'rotation',[(0,0)]);track(gesture,head,'rotation',headkeys)
    for prop,keys in [('x',gx),('y',gy)]:
        track(rest,gaze,prop,[(0,0)]);track(gesture,gaze,prop,keys)
    for eye in eyes:
        track(rest,eye,'scaleY',[(0,1)])
        track(gesture,eye,'scaleY',[(0,1),(69,1),(72,.1),(74,1),(94,1),(96,.15),(98,1),(120,1)])
    machine=add(board,'StateMachine',id='94:2',name='ChewyReference')
    layer=add(machine,'StateMachineLayer',name='Reference action')
    entry=add(layer,'EntryState',x=0,y=100);add(layer,'AnyState',x=0,y=-100);add(layer,'ExitState',x=450,y=-100)
    a=add(layer,'AnimationState',animationId=rest.get('id'),reset='true',x=160,y=100)
    b=add(layer,'AnimationState',animationId=gesture.get('id'),reset='true',x=380,y=100)
    condition(entry,a.get('id'),0);condition(entry,b.get('id'),1);condition(a,b.get('id'),1);condition(b,a.get('id'),0)
    project.mkdir(exist_ok=True)
    ET.indent(root,space='  ');ET.ElementTree(root).write(project/'scene.rml',encoding='unicode')
    (project/'rive.yaml').write_text('name: chewy-vector\nlogs:\n  file: build/rive.log\n  problems: build/problems.log\n')
    evidence={'method':'Manual approximate landmarks, offline fixed-length 2-bone IK, editable sparse native bone keys. No automatic extraction.',
      'source_artwork':str(SOURCE.relative_to(HERE.parent.parent.parent.parent)),
      'source_artwork_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
      'reference_sha256':hashlib.sha256(REFERENCE.read_bytes()).hexdigest(),
      'coordinate_note':'Source artwork local coordinates; upper-body original offset (-1,-6.5) retained. Native reference is approximate.',
      'excluded_frames':[42,99],'retarget_rules':['Reference neutral retained exactly instead of fitting noisy annotations.','Fixed shoulders and limb lengths; wrist target fit; elbow branch nearest reference elbow.','Temple wrist shifted18px left to clear the wider vector hair; source hand direction retained.','Final face stays frontal: 35% of observed small eye-line roll; gaze offset capped7px, no32px rigid head drop.','No raster foot drift transferred; both original trouser/boot shapes static.'],
      'fit_tracks':fits,'head_tracks':{'rotation':headkeys,'gaze_x':gx,'gaze_y':gy},
      'draft_art':['Watch face and strap','Relaxed temple fingers','Two-part left sleeve during gesture'], 'sleeve_solution':'Original left sleeve is preserved in Rest. Motion reveals two bone-local draft vector sleeve pieces with round overlapping elbow caps; prevents inversion when the reference changes elbow branch. No per-frame path keys.', 'duration_frames':121,'fps':24}
    (HERE/'evidence/retarget-fit.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n')
    print(project/'scene.rml')

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--replace-master',action='store_true');a=p.parse_args();bootstrap(a.replace_master)
