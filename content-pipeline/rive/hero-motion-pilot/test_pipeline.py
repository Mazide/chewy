"""Safety regressions for authored-master preservation and atomic publication."""
import argparse
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch


SPEC = importlib.util.spec_from_file_location('motion_pipeline', Path(__file__).with_name('pipeline.py'))
pipeline = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(pipeline)


class PipelineSafetyTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.project = self.root / 'master'
        self.project.mkdir()
        (self.project / 'rive.yaml').write_text('name: plants\n')
        (self.project / 'scene.rml').write_text('<Rive version="1" kind="fragment"/>\n')

    def test_compilation_isolated_from_authored_master(self):
        before = pipeline.source_hashes(self.project)
        copied = self.root / 'copy'
        pipeline.copy_sources(self.project, copied, before)
        (copied / 'scene.rml').write_text('edited working copy')
        pipeline.assert_unchanged(self.project, before)
        (self.project / 'scene.rml').write_text('concurrent author edit')
        with self.assertRaisesRegex(pipeline.PipelineError, 'changed during build'):
            pipeline.assert_unchanged(self.project, before)

    def test_generated_outputs_do_not_enter_master_fingerprint(self):
        before = pipeline.source_hashes(self.project)
        (self.project / 'build').mkdir()
        (self.project / 'build' / 'plants.riv').write_bytes(b'output')
        self.assertEqual(before, pipeline.source_hashes(self.project))

    def test_source_symlink_rejected(self):
        (self.project / 'linked.rml').symlink_to(self.project / 'scene.rml')
        with self.assertRaisesRegex(pipeline.PipelineError, 'symlinks'):
            pipeline.source_hashes(self.project)

    def test_failed_atomic_replace_keeps_previous_pointer(self):
        pointer = self.root / 'latest.json'
        pipeline.atomic_json(pointer, {'run_id': 'accepted'})
        with patch.object(pipeline.os, 'replace', side_effect=OSError('interrupted')):
            with self.assertRaises(OSError):
                pipeline.atomic_json(pointer, {'run_id': 'partial'})
        self.assertEqual(json.loads(pointer.read_text()), {'run_id': 'accepted'})
        self.assertEqual(list(self.root.glob('*.tmp')), [])

    def test_cli_version_mismatch_does_not_publish(self):
        cli = self.root / 'rive'
        cli.write_text('#!/bin/sh\nprintf "rive 9.0.0\\n"\n')
        cli.chmod(0o755)
        config = self.root / 'config.json'
        config.write_text(json.dumps({'required_cli_version': '1.8.0', 'assets': []}))
        output = self.root / 'exports'
        args = argparse.Namespace(config=str(config), rive=str(cli), output=str(output), command='build')
        with self.assertRaisesRegex(pipeline.PipelineError, 'Pinned CLI required'):
            pipeline.build(args)
        self.assertFalse(output.exists())

    def test_explicit_missing_cli_does_not_silently_fallback(self):
        with self.assertRaisesRegex(pipeline.PipelineError, 'Rive CLI not found'):
            pipeline.resolve_rive(str(self.root / 'does-not-exist'))

    def test_no_auth_records_blocked_roundtrip_without_export(self):
        with patch.object(pipeline, 'execute') as execute:
            result = pipeline.rev_roundtrip(Path('/fake/rive'), self.project, {}, self.root, self.root, False)
        self.assertEqual(result['status'], 'blocked_by_auth')
        self.assertFalse(result['gui_editor_tested'])
        execute.assert_not_called()

    def test_external_output_and_log_paths_rejected_before_cli(self):
        for configuration in ['name: plants\noutput:\n  dir: /tmp/elsewhere\n',
                              'name: plants\nlogs:\n  file: ../../elsewhere.log\n']:
            with self.subTest(configuration=configuration):
                (self.project / 'rive.yaml').write_text(configuration)
                with self.assertRaises(pipeline.PipelineError):
                    pipeline.validate_project_paths(self.project)

    def test_failed_browser_qa_keeps_latest_and_records_failure(self):
        final = self.root / 'exports' / 'runs' / 'candidate'
        final.mkdir(parents=True)
        latest = final.parent.parent / 'latest.json'
        pipeline.atomic_json(latest, {'run_id': 'previous'})
        manifest = {'status': 'technical_build_passed', 'browser_qa': {'status': 'not_run'}}
        args = argparse.Namespace(qa_command='["checker", "{run_id}"]', qa_timeout=10)
        failed = subprocess.CompletedProcess(['checker'], 1, '', 'runtime did not load')
        with patch.object(pipeline, 'execute', return_value=failed):
            with self.assertRaises(pipeline.PipelineError):
                pipeline.run_browser_qa(args, final, 'candidate', manifest)
        self.assertEqual(json.loads(latest.read_text())['run_id'], 'previous')
        saved = json.loads((final / 'manifest.json').read_text())
        self.assertEqual(saved['status'], 'browser_qa_failed')
        self.assertEqual(saved['browser_qa']['status'], 'failed')

    def test_browser_timeout_is_failure_not_stale_running_status(self):
        final = self.root / 'candidate'
        final.mkdir()
        manifest = {'status': 'technical_build_passed', 'browser_qa': {'status': 'not_run'}}
        args = argparse.Namespace(qa_command='["checker"]', qa_timeout=10)
        with patch.object(pipeline, 'execute', side_effect=pipeline.PipelineError('timeout')):
            with self.assertRaises(pipeline.PipelineError):
                pipeline.run_browser_qa(args, final, 'candidate', manifest)
        self.assertEqual(json.loads((final / 'manifest.json').read_text())['browser_qa']['status'], 'failed')

    def test_static_comparison_can_share_both_action_appearances(self):
        asset = {'values': [0, 1], 'sample_seconds': [0.7, 1.5],
                 'animated_values': [], 'require_distinct_values': False}
        with patch.object(pipeline, 'capture'), patch.object(pipeline, 'image_difference', return_value=0):
            report = pipeline.capture_proof(Path('/fake/rive'), self.project, asset, self.root, 'baseline')
        self.assertEqual(report['stage_changed_pixels'], [0])

    def test_new_gesture_must_visibly_change_in_runtime(self):
        asset = {'values': [0, 1], 'sample_seconds': [0.7, 1.5], 'animated_values': [1]}
        with patch.object(pipeline, 'capture'), patch.object(pipeline, 'image_difference', return_value=0):
            with self.assertRaisesRegex(pipeline.PipelineError, 'did not visibly move'):
                pipeline.capture_proof(Path('/fake/rive'), self.project, asset, self.root, 'chewy')


if __name__ == '__main__':
    unittest.main()
