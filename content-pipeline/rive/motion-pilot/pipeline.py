#!/usr/bin/env python3
"""Compile authored Rive masters in isolated copies; publish immutable local runs.

Never runs a generator, pushes an account file, logs in, or reads credentials.
`build` proves CLI compilation/rendering; `run` also starts a temporary local
review server and runs browser QA before updating latest.json. This is not an
artistic approval or a GUI Editor round-trip test.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
from http.server import ThreadingHTTPServer
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import threading
from urllib.parse import unquote, urlsplit
import uuid
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
FALLBACK_RIVE = Path('/tmp/chewy-rive-cli/bin/rive')
IGNORED = {'build', 'exports', '.git', '__pycache__', 'node_modules'}


class PipelineError(RuntimeError):
    pass


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def source_hashes(project: Path) -> dict[str, str]:
    if not project.is_dir():
        raise PipelineError(f'Missing authored project: {project}')
    result = {}
    for path in sorted(project.rglob('*')):
        relative = path.relative_to(project)
        if any(part in IGNORED for part in relative.parts):
            continue
        if path.is_symlink():
            raise PipelineError(f'Source symlinks are not supported: {path}')
        if path.is_file():
            result[relative.as_posix()] = sha256(path)
    for required in ('scene.rml', 'rive.yaml'):
        if required not in result:
            raise PipelineError(f'Missing {required}: {project}')
    return result


def copy_sources(source: Path, destination: Path, hashes: dict[str, str]) -> None:
    destination.mkdir(parents=True)
    for relative, expected in hashes.items():
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source / relative, target)
        if sha256(target) != expected:
            raise PipelineError(f'Source changed while copying: {source / relative}')


def assert_unchanged(project: Path, before: dict[str, str]) -> None:
    if source_hashes(project) != before:
        raise PipelineError(f'Authored sources changed during build: {project}; no latest run published')


def resolve_rive(explicit: str | None) -> Path:
    choice = explicit or os.environ.get('RIVE_CLI') or shutil.which('rive')
    if not choice and FALLBACK_RIVE.is_file():
        choice = str(FALLBACK_RIVE)
    resolved = Path(shutil.which(choice) or choice).expanduser().resolve() if choice else None
    if not resolved or not resolved.is_file() or not os.access(resolved, os.X_OK):
        raise PipelineError('Rive CLI not found. Pass --rive /path/to/rive, set RIVE_CLI, '
                            'or install the pinned official CLI from https://rive.app/docs/cli/getting-started. '
                            f'This workspace previously used {FALLBACK_RIVE}.')
    return resolved


def execute(argv: list[str], cwd: Path | None = None, timeout: int = 120) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(argv, cwd=cwd, text=True, capture_output=True, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise PipelineError(f'Command failed: {argv[0]}: {error}') from error


def require_ok(result: subprocess.CompletedProcess, label: str) -> str:
    if result.returncode:
        raise PipelineError(f'{label} exited {result.returncode}:\n{result.stdout[-5000:]}\n{result.stderr[-5000:]}')
    return result.stdout


def json_report(output: str) -> dict:
    decoder = json.JSONDecoder()
    for match in re.finditer(r'\{', output):
        try:
            value, end = decoder.raw_decode(output[match.start():])
            if isinstance(value, dict) and not output[match.start() + end:].strip():
                return value
        except json.JSONDecodeError:
            pass
    raise PipelineError(f'CLI did not return one JSON report: {output[-2000:]}')


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def atomic_json(path: Path, value: dict) -> None:
    temporary = path.with_name(path.name + '.' + uuid.uuid4().hex + '.tmp')
    try:
        write_json(temporary, value)
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def validate_contract(project: Path, asset: dict) -> None:
    validate_project_paths(project)
    root = ET.parse(project / 'scene.rml').getroot()
    for tag, name in [('Artboard', asset['artboard']), ('StateMachine', asset['state_machine']),
                      ('ViewModel', asset['view_model']), ('ViewModelPropertyNumber', asset['property'])]:
        if not any(element.get('name') == name for element in root.iter(tag)):
            raise PipelineError(f'{project}: missing contract {tag} {name!r}')


def validate_project_paths(project: Path) -> None:
    try:
        import yaml
    except ImportError as error:
        raise PipelineError('Project config validation requires PyYAML: python3 -m pip install PyYAML') from error
    config = yaml.safe_load((project / 'rive.yaml').read_text())
    if not isinstance(config, dict):
        raise PipelineError(f'{project}: rive.yaml must be a mapping')
    output = config.get('output') or {}
    if output.get('dir', 'build') != 'build':
        raise PipelineError(f'{project}: this isolated runner requires output.dir: build (or omitted)')
    for key, value in (config.get('logs') or {}).items():
        if key not in ('file', 'problems') or not isinstance(value, str):
            continue
        destination = (project / value).resolve()
        if not destination.is_relative_to((project / 'build').resolve()):
            raise PipelineError(f'{project}: log path must stay inside build/: {key}')


def verify(rive: Path, project: Path, artifact: Path, prefix: str) -> dict:
    report = json_report(require_ok(execute([str(rive), str(project), '--verify', '--format=json'], project), 'verify'))
    write_json(artifact / f'{prefix}-verify.json', report)
    if report.get('success') is not True or report.get('errors') or report.get('warnings'):
        raise PipelineError(f'{prefix}: verify was not clean; see {artifact}')
    inspection = json_report(require_ok(execute([str(rive), 'inspect', str(project), '--summary'], project), 'inspect'))
    write_json(artifact / f'{prefix}-inspect.json', inspection)
    if inspection.get('problems'):
        raise PipelineError(f'{prefix}: inspect found problems')
    return {'verify': f'{prefix}-verify.json', 'inspect': f'{prefix}-inspect.json',
            'artboards': inspection.get('artboards', [])}


def compile_riv(rive: Path, project: Path, output: Path) -> None:
    before = source_hashes(project)
    build = project / 'build'
    require_ok(execute([str(rive), str(project), '--once', '--format=json'], project), 'compile')
    assert_unchanged(project, before)
    files = list(build.glob('*.riv'))
    if len(files) != 1:
        raise PipelineError(f'Expected one .riv in {build}, got {files}')
    shutil.copyfile(files[0], output)


def image_difference(first: Path, second: Path) -> int:
    try:
        from PIL import Image, ImageChops
    except ImportError as error:
        raise PipelineError('Runtime-frame checks require Pillow: python3 -m pip install Pillow') from error
    with Image.open(first) as left, Image.open(second) as right:
        if left.size != right.size:
            raise PipelineError(f'Render dimensions differ: {first} and {second}')
        difference = ImageChops.difference(left.convert('RGBA'), right.convert('RGBA'))
        pixels = difference.get_flattened_data() if hasattr(difference, 'get_flattened_data') else difference.getdata()
        return sum(any(channel > 1 for channel in pixel) for pixel in pixels)


def capture(rive: Path, project: Path, asset: dict, stage: int, seconds: float, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    require_ok(execute([str(rive), str(project), f'--artboard={asset["artboard"]}',
                        f'--data={asset["property"]}={stage}', f'--advance={seconds}s',
                        f'--screenshot={target}'], project), 'runtime capture')
    from PIL import Image
    with Image.open(target) as image:
        if image.width < 1 or image.height < 1 or image.convert('RGBA').getchannel('A').getbbox() is None:
            raise PipelineError(f'Empty runtime frame: {target}')


def capture_proof(rive: Path, project: Path, asset: dict, run: Path, prefix: str) -> dict:
    frames, deltas = {}, {}
    for stage in asset['values']:
        paths = []
        for index, seconds in enumerate(asset['sample_seconds']):
            target = run / 'frames' / f'{prefix}-stage-{stage}-t{index}.png'
            capture(rive, project, asset, stage, seconds, target)
            paths.append(target)
        frames[str(stage)] = [path.relative_to(run).as_posix() for path in paths]
        deltas[str(stage)] = [image_difference(paths[0], path) for path in paths[1:]]
        if stage in asset['animated_values'] and max(deltas[str(stage)], default=0) < 20:
            raise PipelineError(f'{prefix} stage {stage} did not visibly move in runtime samples')
    first_frames = [run / frames[str(stage)][0] for stage in asset['values']]
    stage_deltas = [image_difference(first_frames[0], path) for path in first_frames[1:]]
    if any(delta < 20 for delta in stage_deltas):
        raise PipelineError(f'{prefix}: sampled stage appearances are indistinguishable')
    return {'kind': 'official_cli_headless_runtime', 'frames': frames, 'sample_seconds': asset['sample_seconds'],
            'changed_pixels_against_first_sample': deltas, 'stage_changed_pixels': stage_deltas,
            'standalone_export_load_tested': False, 'artistic_quality_approved': False}


def edit_preservation(rive: Path, original: Path, asset: dict, run: Path, temporary: Path) -> dict:
    project = temporary / 'edit-probe'
    copy_sources(original, project, source_hashes(original))
    scene = project / 'scene.rml'
    tree = ET.parse(scene)
    spec = asset['edit_probe']
    matches = [node for node in tree.getroot().iter(spec['type']) if node.get('name') == spec['name']]
    if len(matches) != 1 or spec['property'] not in matches[0].attrib:
        raise PipelineError('Edit probe must identify exactly one explicit authored property')
    node = matches[0]
    previous = node.get(spec['property'])
    updated = str(float(previous) + spec['delta'])
    node.set(spec['property'], updated)
    tree.write(scene, encoding='unicode')
    after_edit = source_hashes(project)
    verify(rive, project, run, f'{asset["slug"]}-edited')
    compile_riv(rive, project, run / f'{asset["slug"]}-edited-proof.riv')
    target = run / 'frames' / f'{asset["slug"]}-edited-proof.png'
    capture(rive, project, asset, asset['values'][-1], asset['sample_seconds'][0], target)
    compile_riv(rive, project, run / f'{asset["slug"]}-edited-rebuild.riv')
    assert_unchanged(project, after_edit)
    difference = image_difference(run / 'frames' / f'{asset["slug"]}-stage-{asset["values"][-1]}-t0.png', target)
    if difference < 20:
        raise PipelineError('Meaningful source-edit probe did not change the runtime image')
    if sha256(run / f'{asset["slug"]}-edited-proof.riv') != sha256(run / f'{asset["slug"]}-edited-rebuild.riv'):
        raise PipelineError('Same edited source produced different exports on repeated compilation')
    return {'status': 'passed', 'scope': 'local_RML_edit_then_two_builds_and_runtime_capture',
            'gui_editor_tested': False, 'node': spec['name'], 'property': spec['property'],
            'before': previous, 'after': updated, 'changed_pixels': difference,
            'edited_source_sha256': after_edit['scene.rml'], 'source_preserved': True}


def rev_roundtrip(rive: Path, project: Path, asset: dict, run: Path, temporary: Path, authenticated: bool) -> dict:
    if not authenticated:
        return {'status': 'blocked_by_auth', 'gui_editor_tested': False,
                'remedy': 'Run rive login interactively, then rerun this pipeline; no account files are pushed.'}
    rev = run / f'{asset["slug"]}.rev'
    result = execute([str(rive), str(project), '--once', f'--rev={rev}', '--format=json'], project)
    if result.returncode:
        return {'status': 'export_failed', 'exit_code': result.returncode, 'gui_editor_tested': False,
                'detail': (result.stderr or result.stdout)[-2000:]}
    imported = temporary / 'rev-roundtrip'
    require_ok(execute([str(rive), 'create', str(imported), f'--from-rev={rev}'], temporary), 'import .rev')
    validate_contract(imported, asset)
    verify(rive, imported, run, f'{asset["slug"]}-roundtrip')
    compile_riv(rive, imported, run / f'{asset["slug"]}-roundtrip.riv')
    comparisons = {}
    for stage in asset['values']:
        reference = run / 'frames' / f'{asset["slug"]}-stage-{stage}-t0.png'
        target = run / 'frames' / f'{asset["slug"]}-roundtrip-stage-{stage}.png'
        capture(rive, imported, asset, stage, asset['sample_seconds'][0], target)
        comparisons[str(stage)] = image_difference(reference, target)
    if any(comparisons.values()):
        raise PipelineError(f'.rev roundtrip changed rendered pixels: {comparisons}')
    return {'status': 'passed', 'scope': 'CLI_RML_to_REV_to_RML_to_RIV', 'gui_editor_tested': False,
            'file': rev.name, 'sha256': sha256(rev), 'changed_pixels_by_stage': comparisons}


def run_browser_qa(args: argparse.Namespace, final: Path, run_id: str, manifest: dict) -> None:
    server, thread = None, None
    try:
        if args.qa_command:
            argv = json.loads(args.qa_command)
            if not isinstance(argv, list) or not argv or not all(isinstance(item, str) for item in argv):
                raise PipelineError('--qa-command must be a nonempty JSON array of strings')
            argv = [item.replace('{run_id}', run_id).replace('{run_dir}', str(final)) for item in argv]
        else:
            node = shutil.which('node')
            if not node:
                raise PipelineError('Browser QA requires Node.js on PATH and prototype/node_modules/playwright')
            spec = importlib.util.spec_from_file_location('motion_pilot_serve', ROOT / 'serve.py')
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            export_root = final.parent.parent

            class ReviewHandler(module.Handler):
                def translate_path(self, path):
                    value = unquote(urlsplit(path).path)
                    prefix = '/motion-pilot/exports/'
                    if value.startswith(prefix):
                        candidate = (export_root / value[len(prefix):]).resolve()
                        if candidate.is_relative_to(export_root):
                            return str(candidate)
                        return str(ROOT / '.not-found')
                    return super().translate_path(path)

                def log_message(self, *_args):
                    pass

            server = ThreadingHTTPServer(('127.0.0.1', 0), ReviewHandler)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            url = f'http://127.0.0.1:{server.server_port}/motion-pilot/preview/review.html?run={run_id}'
            argv = [node, str(ROOT / 'check_motion.mjs'), url, '--out', str(final / 'browser-qa')]
        manifest['browser_qa'] = {'status': 'running', 'argv': argv, 'custom_command': bool(args.qa_command)}
        atomic_json(final / 'manifest.json', manifest)
        result = execute(argv, ROOT, timeout=args.qa_timeout)
        (final / 'browser-qa-command.log').write_text(result.stdout + '\n' + result.stderr)
        manifest['browser_qa']['exit_code'] = result.returncode
        manifest['browser_qa']['status'] = 'passed' if result.returncode == 0 else 'failed'
        manifest['status'] = 'technical_and_browser_qa_passed' if result.returncode == 0 else 'browser_qa_failed'
        if result.returncode == 0 and not args.qa_command:
            report = json.loads((final / 'browser-qa' / 'qa.json').read_text())
            if report.get('passed') is not True:
                raise PipelineError('Default browser checker did not produce a passing qa.json')
            manifest['browser_qa']['report'] = 'browser-qa/qa.json'
            manifest['browser_qa']['standalone_export_load_tested'] = True
        atomic_json(final / 'manifest.json', manifest)
        require_ok(result, 'browser QA (latest.json remains on the previous run)')
        if result.stdout:
            print(result.stdout.strip(), flush=True)
    except Exception as error:
        manifest['status'] = 'browser_qa_failed'
        manifest['browser_qa']['status'] = 'failed'
        manifest['browser_qa']['failure'] = str(error)
        atomic_json(final / 'manifest.json', manifest)
        raise
    finally:
        if server:
            server.shutdown()
            server.server_close()
        if thread:
            thread.join(timeout=5)


def build(args: argparse.Namespace) -> Path:
    config_path = Path(args.config).resolve()
    config_bytes = config_path.read_bytes()
    config = json.loads(config_bytes)
    base = config_path.parent
    rive = resolve_rive(args.rive)
    version_text = require_ok(execute([str(rive), '--version']), 'version').strip()
    if version_text != f'rive {config["required_cli_version"]}':
        raise PipelineError(f'Pinned CLI required: rive {config["required_cli_version"]}; found {version_text}. '
                            'Use --rive with the pinned installation; do not silently upgrade the master.')
    auth = execute([str(rive), 'whoami'], timeout=30)
    auth_status = 'authenticated' if auth.returncode == 0 else ('not_logged_in' if auth.returncode == 3 else 'unavailable')
    exports = Path(args.output).resolve()
    runs = exports / 'runs'
    runs.mkdir(parents=True, exist_ok=True)
    run_id = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:8]
    staging = Path(tempfile.mkdtemp(prefix='.staging-', dir=exports))
    final = runs / run_id
    manifest = {'schema_version': 1, 'run_id': run_id, 'created_at': datetime.now(timezone.utc).isoformat(),
                'status': 'building', 'cli': {'version': version_text, 'path': str(rive), 'sha256': sha256(rive)},
                'auth': {'status': auth_status, 'exit_code': auth.returncode},
                'config_sha256': hashlib.sha256(config_bytes).hexdigest(), 'assets': {}, 'browser_qa': {'status': 'not_run'},
                'gui_editor_tested': False, 'native_tested': False, 'artistic_quality_approved': False}
    masters = []
    supporting_sources = [(config_path, manifest['config_sha256'])]
    try:
        (staging / 'pipeline-config.json').write_bytes(config_bytes)
        reproduction = json.loads(config_bytes)
        for asset in reproduction['assets']:
            asset['project'] = f'sources/{asset["slug"]}/master'
            asset['baseline'] = f'sources/{asset["slug"]}/baseline'
        write_json(staging / 'reproduce.json', reproduction)
        manifest['reproduce_config'] = 'reproduce.json'
        brief = base / 'motion-brief.json'
        if brief.is_file():
            brief_bytes = brief.read_bytes()
            (staging / 'motion-brief.json').write_bytes(brief_bytes)
            digest = hashlib.sha256(brief_bytes).hexdigest()
            manifest['motion_brief'] = {'file': 'motion-brief.json', 'sha256': digest}
            supporting_sources.append((brief, digest))
        manifest['tooling_sha256'] = {name: sha256(ROOT / name) for name in
                                     ('pipeline.py', 'serve.py', 'check_motion.mjs',
                                      'preview/viewer.js', 'preview/index.html', 'preview/review.html', 'preview/style.css')
                                     if (ROOT / name).is_file()}
        supporting_sources.extend((ROOT / name, digest) for name, digest in manifest['tooling_sha256'].items())
        with tempfile.TemporaryDirectory(prefix='chewy-motion-pilot-') as work:
            work = Path(work)
            for asset in config['assets']:
                slug = asset['slug']
                if not re.fullmatch(r'[a-z0-9-]+', slug):
                    raise PipelineError(f'Unsafe asset slug: {slug}')
                source = (base / asset['project']).resolve()
                baseline = (base / asset['baseline']).resolve()
                primary_hashes, baseline_hashes = source_hashes(source), source_hashes(baseline)
                masters.extend([(source, primary_hashes), (baseline, baseline_hashes)])
                source_snapshot = Path('sources') / slug / 'master'
                baseline_snapshot = Path('sources') / slug / 'baseline'
                copy_sources(source, staging / source_snapshot, primary_hashes)
                copy_sources(baseline, staging / baseline_snapshot, baseline_hashes)
                asset_work = work / slug
                candidate, comparison = asset_work / 'master', asset_work / 'baseline'
                copy_sources(staging / source_snapshot, candidate, primary_hashes)
                copy_sources(staging / baseline_snapshot, comparison, baseline_hashes)
                validate_contract(candidate, asset)
                validate_contract(comparison, asset)
                details = {'contract': {key: asset[key] for key in ['artboard', 'state_machine', 'view_model', 'property', 'values']},
                           'source_path': str(source), 'source_hashes': primary_hashes,
                           'source_snapshot': source_snapshot.as_posix(),
                           'baseline_source_path': str(baseline), 'baseline_source_hashes': baseline_hashes,
                           'baseline_source_snapshot': baseline_snapshot.as_posix()}
                for project, prefix in [(candidate, slug), (comparison, f'baseline-{slug}')]:
                    details[prefix + '_checks'] = verify(rive, project, staging, prefix)
                    compile_riv(rive, project, staging / f'{prefix}.riv')
                    details[prefix + '_runtime'] = capture_proof(rive, project, asset, staging, prefix)
                    details[prefix + '_riv'] = {'file': f'{prefix}.riv', 'sha256': sha256(staging / f'{prefix}.riv'),
                                               'bytes': (staging / f'{prefix}.riv').stat().st_size, 'signed': False}
                details['local_edit_preservation'] = edit_preservation(rive, candidate, asset, staging, asset_work)
                details['editable_roundtrip'] = rev_roundtrip(rive, candidate, asset, staging, asset_work, auth_status == 'authenticated')
                manifest['assets'][slug] = details
                print(f'{slug}: compiled, rendered, and local-edit preservation checked', flush=True)
            for project, hashes in masters:
                assert_unchanged(project, hashes)
        manifest['status'] = 'technical_build_passed'
        manifest['source_preserved'] = True
        write_json(staging / 'manifest.json', manifest)
        os.replace(staging, final)
        if args.command == 'run':
            run_browser_qa(args, final, run_id, manifest)
        for project, hashes in masters:
            assert_unchanged(project, hashes)
        for path, digest in supporting_sources:
            if sha256(path) != digest:
                raise PipelineError(f'Supporting source changed during build: {path}; latest remains unchanged')
        atomic_json(exports / 'latest.json', {'schema_version': 1, 'run_id': run_id, 'run_dir': f'runs/{run_id}',
                                             'manifest': f'runs/{run_id}/manifest.json', 'status': manifest['status']})
        print(f'Published local run: {final}', flush=True)
        return final
    except Exception as error:
        if staging.exists():
            shutil.rmtree(staging)
        if final.exists():
            if manifest['status'] != 'browser_qa_failed':
                manifest['status'] = 'pipeline_failed'
            manifest['failure'] = str(error)
            atomic_json(final / 'manifest.json', manifest)
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['build', 'run'])
    parser.add_argument('--rive', help='Pinned official CLI executable (or RIVE_CLI/PATH/workspace fallback)')
    parser.add_argument('--config', default=str(ROOT / 'pipeline.json'))
    parser.add_argument('--output', default=str(ROOT / 'exports'))
    parser.add_argument('--qa-command', help='JSON argv array; placeholders {run_id} and {run_dir}; never a shell command')
    parser.add_argument('--qa-timeout', type=int, default=240)
    args = parser.parse_args()
    try:
        build(args)
    except (PipelineError, ValueError, OSError, ET.ParseError) as error:
        print(f'Pipeline failed: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
