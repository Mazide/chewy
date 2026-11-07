#!/usr/bin/env python3
"""Read a frozen vector master; test copies only. This is not artistic acceptance."""
from pathlib import Path
import hashlib
import json
import math
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
PILOT = HERE.parent
REPO = PILOT.parents[2]
CLI = Path('/tmp/chewy-rive-cli/bin/rive')
TRANSITION_FRAMES = [39, 40, 41, 42, 43, 44, 87, 88, 89, 90, 91, 92, 93, 94, 95]
FRAMES = sorted(set([0, 36, 38, 45, 48, 60, 72, 84, 86, 96, 99, 102, 120] + TRANSITION_FRAMES))


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def command(args):
    p = subprocess.run([str(a) for a in args], capture_output=True, text=True)
    if p.returncode:
        raise RuntimeError(p.stdout + p.stderr)
    return p.stdout.strip()


def capture(stage, path, advance):
    command([CLI, stage, f'--screenshot={path}', '--data=action=1', f'--advance={advance}'])
    return np.asarray(Image.open(path).convert('RGBA'))


def bounds(mask):
    y, x = np.where(mask)
    return [int(x.min()), int(y.min()), int(x.max() + 1), int(y.max() + 1)] if len(x) else None


def run():
    sources = {p: digest(p) for p in (PILOT / 'chewy').rglob('*') if p.is_file() and 'build' not in p.parts}
    tree = ET.parse(PILOT / 'chewy/scene.rml')
    root = tree.getroot()
    counts = {tag: len(list(root.iter(tag))) for tag in ['Shape', 'Image', 'ImageAsset', 'RootBone', 'Bone', 'Skin', 'Tendon', 'CubicWeight']}
    assert counts['Image'] == counts['ImageAsset'] == 0, 'Raster content in the vector master'
    assert counts['Skin'] >= 1 and counts['Bone'] >= 2 and counts['CubicWeight'] > 0
    artwork_path = PILOT.parent / 'hero-wardrobe/references/hero-from-editor.rml'
    original_shapes = {e.get('name'): e for e in ET.parse(artwork_path).getroot().iter('Shape')}
    current_shapes = {e.get('name'): e for e in root.iter('Shape')}
    def signature(e):
        return e.tag, tuple(sorted(e.attrib.items())), tuple(signature(c) for c in e)
    exact = [n for n, e in original_shapes.items() if n in current_shapes and signature(e) == signature(current_shapes[n])]
    changed_shapes = [n for n in original_shapes if n not in exact]
    assert len(exact) == 24 and set(changed_shapes) == {'Left sleeve', 'Right sleeve'}
    artwork = {'source_sha256': digest(artwork_path), 'exact_original_shape_subtrees': exact,
               'exact_count': len(exact), 'changed_original_shapes': changed_shapes,
               'note': 'Exact XML shape subtree comparison; reparenting/transforms and draw order are evaluated separately.'}
    animation = root.find(".//LinearAnimation[@name='ReferenceGesture']")
    assert animation is not None and animation.get('loopValue') == 'oneShot'
    bone = next(e for e in root.iter('Bone') if e.get('name') == 'Screen left forearm')
    obj = animation.find(f"KeyedObject[@objectId='{bone.get('id')}']")
    prop = obj.find("KeyedProperty[@property='rotation']")
    key = prop.find("KeyFrameDouble[@frame='48']")
    assert key is not None, 'Expected an editable native forearm rotation key at the temple pose'
    old_value = float(key.get('value', '0'))
    samples = []
    with tempfile.TemporaryDirectory(prefix='chewy-vector-independent-final-') as temp:
        temp = Path(temp)
        stage = temp / 'chewy'
        shutil.copytree(PILOT / 'chewy', stage, ignore=shutil.ignore_patterns('build'))
        for frame in FRAMES:
            path = HERE / f'independent-final-{frame:03d}.png'
            actual = capture(stage, path, round(frame * 60 / 24) + 1)
            if frame == 0:
                baseline = actual.copy()
            mask = np.max(np.abs(actual.astype(int) - actual[0, 0].astype(int)), axis=2) > 5
            b = bounds(mask)
            samples.append({'reference_frame': frame, 'time_seconds': frame / 24,
                            'render_sha256': digest(path), 'visible_bounds': b,
                            'feet_changed_pixels_y850_plus': int(np.any(actual[850:] != baseline[850:], axis=2).sum()),
                            'border_pixels': int(mask[0].sum() + mask[-1].sum() + mask[:, 0].sum() + mask[:, -1].sum())})
            if frame in [44, 84, 95, 120]:
                print(f'Captured through source frame {frame}', flush=True)
        before_path = HERE / 'independent-bone-before.png'
        before = capture(stage, before_path, 121)
        # Only one native rotation key changes, inside the disposable copy.
        key.set('value', str(old_value + .12))
        tree.write(stage / 'scene.rml', encoding='unicode')
        after_path = HERE / 'independent-bone-after.png'
        after = capture(stage, after_path, 121)
        changed = np.any(before != after, axis=2)
        perturb = {'bone': bone.get('name'), 'bone_id': bone.get('id'),
                   'animation': animation.get('name'), 'key_frame': 48,
                   'before_rotation_radians': old_value, 'after_rotation_radians': old_value + .12,
                   'delta_radians': .12, 'delta_degrees': math.degrees(.12),
                   'changed_pixels': int(changed.sum()), 'changed_bounds': bounds(changed),
                   'sleeve_region_changed_pixels': int(changed[285:410, 20:180].sum()),
                   'lower_body_changed_pixels_y650_plus': int(changed[650:].sum()),
                   'opposite_arm_region_changed_pixels': int(changed[350:650, 300:].sum()),
                   'before_sha256': digest(before_path), 'after_sha256': digest(after_path)}
        # Pixel change alone is insufficient: the visible sleeve must deform,
        # while the opposite arm and lower body remain identical.
        assert perturb['sleeve_region_changed_pixels'] > 50, perturb
        assert perturb['lower_body_changed_pixels_y650_plus'] == 0, perturb
        assert perturb['opposite_arm_region_changed_pixels'] == 0, perturb
        assert perturb['changed_bounds'][2] < 250, perturb
        perturb['implementation_scope'] = 'Screen-left action sleeve uses bone-local vector parts; this proves bone linkage, not weighted skin deformation.'
        # Test the actually visible weighted sleeve independently. At F90 the
        # screen-right sleeve is spatially separated from the opposite arm.
        shutil.copyfile(PILOT / 'chewy/scene.rml', stage / 'scene.rml')
        skin_before_path = HERE / 'independent-skin-before.png'
        skin_before = capture(stage, skin_before_path, 226)
        skin_tree = ET.parse(stage / 'scene.rml')
        skin_root = skin_tree.getroot()
        skin_bone = next(e for e in skin_root.iter('Bone') if e.get('name') == 'Screen right forearm')
        assert any(t.get('boneId') == skin_bone.get('id') for t in skin_root.iter('Tendon'))
        skin_anim = skin_root.find(".//LinearAnimation[@name='ReferenceGesture']")
        skin_obj = skin_anim.find(f"KeyedObject[@objectId='{skin_bone.get('id')}']")
        skin_key = skin_obj.find("KeyedProperty[@property='rotation']/KeyFrameDouble[@frame='90']")
        skin_old = float(skin_key.get('value', '0'))
        skin_key.set('value', str(skin_old + .12))
        skin_tree.write(stage / 'scene.rml', encoding='unicode')
        skin_after_path = HERE / 'independent-skin-after.png'
        skin_after = capture(stage, skin_after_path, 226)
        skin_changed = np.any(skin_before != skin_after, axis=2)
        skin_probe = {'bone': skin_bone.get('name'), 'bone_id': skin_bone.get('id'), 'key_frame': 90,
                      'before_rotation_radians': skin_old, 'after_rotation_radians': skin_old + .12,
                      'delta_radians': .12, 'tendon_binding_present': True,
                      'changed_pixels': int(skin_changed.sum()), 'changed_bounds': bounds(skin_changed),
                      'visible_weighted_sleeve_region_changed_pixels': int(skin_changed[480:560, 360:450].sum()),
                      'lower_body_changed_pixels_y650_plus': int(skin_changed[650:].sum()),
                      'opposite_arm_region_changed_pixels': int(skin_changed[300:650, :220].sum()),
                      'before_sha256': digest(skin_before_path), 'after_sha256': digest(skin_after_path)}
        assert skin_probe['visible_weighted_sleeve_region_changed_pixels'] > 50, skin_probe
        assert skin_probe['lower_body_changed_pixels_y650_plus'] == 0, skin_probe
        assert skin_probe['opposite_arm_region_changed_pixels'] == 0, skin_probe
        assert skin_probe['changed_bounds'][0] > 250, skin_probe
        # Restore the saved source in the temporary project for native end checks.
        shutil.copyfile(PILOT / 'chewy/scene.rml', stage / 'scene.rml')
        final = capture(stage, temp / 'final.png', 302)
        end_checks = []
        for advance in ['6s', '10s']:
            im = capture(stage, temp / f'end-{advance}.png', advance)
            end_checks.append({'advance': advance, 'pixels_different_from_final_pose': int(np.any(im != final, axis=2).sum())})
        assert all(c['pixels_different_from_final_pose'] == 0 for c in end_checks)
        exported = PILOT / 'exports/chewy-vector.riv'
        built = stage / 'build/chewy-vector.riv'
        assert built.read_bytes() == exported.read_bytes(), 'Audited native build differs from published export'
        export_identity = {'sha256': digest(exported), 'bytes': exported.stat().st_size,
                           'independent_temporary_build_matches_export': True}
    assert all(digest(p) == sha for p, sha in sources.items()), 'Master changed during audit; rerun with frozen source'
    assert all(s['feet_changed_pixels_y850_plus'] == 0 for s in samples), 'Foot drift'
    assert all(s['border_pixels'] == 0 for s in samples), 'Visible content touches canvas edge'
    report = {'kind': 'independent_native_vector_rig_audit', 'mechanical_checks_passed': True,
              'artistic_approval': False, 'visual_review_required': True,
              'source_rml_sha256': sources[PILOT / 'chewy/scene.rml'],
              'artwork_preservation': artwork, 'export_identity': export_identity,
              'cli_version': command([CLI, '--version']), 'structure': counts,
              'sampled_native_poses': samples, 'temporary_bone_perturbation': perturb,
              'temporary_weighted_skin_perturbation': skin_probe,
              'sleeve_implementation': {'screen_left_action': 'Two bone-local vector parts with rounded overlap; no claim of continuous weighted skin on this action sleeve.',
                                        'screen_right_action': 'Continuous original vector sleeve with native Skin/Tendon/CubicWeight deformation.'},
              'native_one_shot_hold': end_checks, 'source_unchanged': True,
              'limits': ['Landmarks are approximate manual reference annotations, not tracked joints.',
                         'No pixel matching between different raster/vector artwork is claimed.',
                         'No Rive Editor import, Apple runtime, device memory, or artistic acceptance.']}
    (HERE / 'independent-rig-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    selected = [0, 40, 42, 48, 84, 90, 96, 102]
    sheet = Image.new('RGB', (1680, 985), '#f7f3e9')
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 17)
    draw.text((10, 12), 'Independent review: source reference / vector. Mechanical checks are not artistic acceptance.', font=font, fill='#222')
    for j, frame in enumerate(selected):
        x, y = j % 4 * 420, j // 4 * 465 + 55
        draw.text((x + 8, y), f'F{frame:03d} / {frame / 24:.3f}s', font=font, fill='#222')
        source = REPO / f'chewy/chewy/Assets.xcassets/hero.spriteatlas/idle_{frame:03d}.imageset/idle_{frame:03d}@2x.png'
        for i, path in enumerate([source, HERE / f'independent-final-{frame:03d}.png']):
            im = Image.open(path).convert('RGBA').resize((202, 424), Image.Resampling.LANCZOS)
            sheet.paste(im, (x + 4 + i * 210, y + 30), im)
    sheet.save(HERE / 'independent-final-contact.png')
    transitions = Image.new('RGB', (1315, 1095), '#f7f3e9')
    draw = ImageDraw.Draw(transitions)
    draw.text((10, 10), 'Frozen-source dense transitions: inspect the complete elbow fold, not only endpoint poses.', font=font, fill='#222')
    for j, frame in enumerate(TRANSITION_FRAMES):
        x, y = j % 5 * 263 + 5, j // 5 * 350 + 45
        draw.text((x, y), f'F{frame:03d} / {frame / 24:.3f}s', font=font, fill='#222')
        im = Image.open(HERE / f'independent-final-{frame:03d}.png').crop((0, 0, 506, 640)).resize((253, 320), Image.Resampling.LANCZOS)
        transitions.paste(im, (x, y + 25))
    transitions.save(HERE / 'independent-final-transition-contact.png')
    print(json.dumps({'mechanical_checks_passed': True, 'source_rml_sha256': report['source_rml_sha256'],
                      'perturbation': perturb, 'report': str(HERE / 'independent-rig-audit.json')}, indent=2))


if __name__ == '__main__':
    run()
