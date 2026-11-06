"""Behavioral checks for the evaluator; all responses here are synthetic."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import subprocess
import sys
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('food_bench', Path(__file__).with_name('bench.py'))
bench = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bench)


def synthetic(case):
    outcome = case['expected']['outcomes'][0]
    directions = {key: 'unknown' for key in bench.DIRECTIONS}
    components = []
    if outcome == 'food':
        components = [{'label': 'Демонстрационный компонент', 'directions': [], 'photoIds': [bench.request_for(case)['photos'][0]['id']], 'source': 'image', 'certainty': 'clear'}]
    for key, allowed in case['expected']['directions'].items():
        if allowed == ['present'] and not (case['id'] == 'oil-clarification' and key == 'unsaturatedFats'):
            directions[key] = 'present'
            components[0]['directions'].append(key)
    if case['id'] == 'oil-clarification':
        directions['unsaturatedFats'] = 'present'
        components.append({'label': 'Оливковое масло', 'directions': ['unsaturatedFats'], 'photoIds': [], 'source': 'user', 'certainty': 'clear'})
    return {'outcome': outcome, 'dishName': 'Синтетический пример' if outcome == 'food' else '', 'components': components, 'unknowns': ['Синтетический ответ, не распознавание.'], 'assessment': {'directions': directions}}


class BenchmarkTests(unittest.TestCase):
    def setUp(self):
        self.cases = bench.load_cases()
        self.case = self.cases[0]
        self.response = synthetic(self.case)

    def test_all_synthetic_examples_obey_contract(self):
        for case in self.cases:
            with self.subTest(case=case['id']):
                result = bench.evaluate(case, synthetic(case))
                self.assertEqual(result['failures'], [])
                self.assertEqual(result['humanReview'], 'pending')

    def test_missing_support_is_rejected(self):
        self.response['assessment']['directions']['unsaturatedFats'] = 'present'
        self.assertIn('invalid_evidence_contract', bench.evaluate(self.case, self.response)['failures'])

    def test_unknown_photo_id_is_rejected(self):
        self.response['components'][0]['photoIds'] = ['invented']
        self.assertIn('invalid_evidence_contract', bench.evaluate(self.case, self.response)['failures'])

    def test_user_ingredient_without_claim_is_rejected(self):
        self.response['components'][0].update(source='user', photoIds=[])
        self.assertIn('invalid_evidence_contract', bench.evaluate(self.case, self.response)['failures'])

    def test_nutrition_field_is_rejected(self):
        self.response['calories'] = 500
        self.assertIn('invalid_evidence_contract', bench.evaluate(self.case, self.response)['failures'])

    def test_hidden_oil_semantic_error_is_detected_even_if_schema_valid(self):
        case = next(c for c in self.cases if c['id'] == 'hidden-oil')
        response = synthetic(case)
        response['components'][0]['directions'] = ['unsaturatedFats']
        response['assessment']['directions']['unsaturatedFats'] = 'present'
        self.assertIn('direction:unsaturatedFats', bench.evaluate(case, response)['failures'])

    def test_unexpected_nonfood_is_detected(self):
        response = synthetic(next(c for c in self.cases if c['id'] == 'non-food'))
        self.assertIn('unexpected_outcome', bench.evaluate(self.case, response)['failures'])

    def test_oil_clarification_requires_user_attribution(self):
        case = next(c for c in self.cases if c['id'] == 'oil-clarification')
        response = synthetic(case)
        response['components'][-1].update(source='image', photoIds=[bench.request_for(case)['photos'][0]['id']])
        self.assertIn('missing_user_fat_evidence', bench.evaluate(case, response)['failures'])

    def test_normalization_is_visible(self):
        self.response['assessment']['directions']['protein'] = 'unknown'
        self.assertIn('directions_required_normalization', bench.evaluate(self.case, self.response)['failures'])

    def test_human_can_reject_schema_valid_hallucination(self):
        review = dict.fromkeys(('ingredients', 'uncertainty', 'attribution', 'neutrality', 'multiPhoto'), 'pass')
        review.update(ingredients='fail', notes='Компонент отсутствует на фото.')
        self.assertIn('human_review', bench.evaluate(self.case, self.response, review)['failures'])

    def test_incomplete_review_is_not_accepted(self):
        self.assertIn('invalid_human_review', bench.evaluate(self.case, self.response, {})['failures'])

    def test_malformed_responses_do_not_crash(self):
        for value in (None, [], {'assessment': []}, {'assessment': {'directions': None}}):
            self.assertTrue(bench.evaluate(self.case, value)['failures'])

    def test_duplicate_json_keys_rejected(self):
        with self.assertRaises(bench.AnalysisError):
            bench._load_json('{"outcome":"food","outcome":"non_food"}')

    def test_report_includes_missing_and_unexpected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            (path / 'extra.json').write_text('{}')
            result = bench.report(self.cases, path)
            self.assertEqual(result['counts']['missing_response'], len(self.cases))
            self.assertEqual(result['unexpectedFiles'], ['extra.json'])

    def test_mock_never_becomes_quality_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            (path / (self.case['id'] + '.json')).write_text(json.dumps({'origin':'synthetic', 'response': self.response}))
            row = bench.report([self.case], path)['cases'][0]
            self.assertEqual(row['status'], 'contract_checked')
            self.assertFalse(row['qualityEvidence'])

    def test_request_preserves_multiple_photos_and_user_claim(self):
        case = next(c for c in self.cases if c['id'] == 'repeated-view')
        request = bench.request_for(case, True)
        self.assertEqual(len(request['photos']), 2)
        self.assertEqual(request['photos'][0]['dataBase64'], request['photos'][1]['dataBase64'])
        self.assertNotEqual(request['photos'][0]['id'], request['photos'][1]['id'])

    def test_cli_prepare_and_import_without_network(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            script = str(Path(__file__).with_name('bench.py'))
            def run(*args):
                return subprocess.run([sys.executable, '-B', script, *args], capture_output=True, text=True)
            request = folder / 'request.json'
            first = run('prepare', 'repeated-view', '--output', str(request))
            self.assertEqual(first.returncode, 0, first.stderr)
            self.assertEqual(len(json.loads(request.read_text())['photos']), 2)
            self.assertEqual(run('prepare', 'repeated-view', '--output', str(request)).returncode, 2)
            job = folder / 'job.json'
            response = copy.deepcopy(self.response)
            response.update(schemaVersion=1, provenance={'provider': 'mock'})
            job.write_text(json.dumps({'status': 'succeeded', 'result': response}))
            output = folder / 'record.json'
            imported = run('import-job', str(job), '--output', str(output))
            self.assertEqual(imported.returncode, 0, imported.stderr)
            self.assertEqual(json.loads(output.read_text())['origin'], 'mock')
            job.write_text(json.dumps({'status': 'failed', 'result': None}))
            self.assertEqual(run('import-job', str(job), '--output', str(folder / 'failed.json')).returncode, 2)

    def test_cli_missing_material_fails_before_creating_request(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'request.json'
            result = subprocess.run([sys.executable, '-B', str(Path(__file__).with_name('bench.py')), 'prepare', 'non-food', '--output', str(output)], capture_output=True)
            self.assertEqual(result.returncode, 2)
            self.assertFalse(output.exists())

    def test_imported_real_cli_photo_ids_match_evaluation(self):
        request = bench.request_for(self.case, True)
        photo = bench.read_photo(bench.photo_path(self.case['photos'][0]))
        self.assertEqual(request['photos'][0], photo)
        response = copy.deepcopy(self.response)
        response['components'][0]['photoIds'] = [photo['id']]
        self.assertEqual(bench.evaluate(self.case, response)['failures'], [])

    def test_request_has_distinct_ids_for_deliberate_duplicate_and_api_accepts_it(self):
        from server.app import validate_request
        case = next(c for c in self.cases if c['id'] == 'repeated-view')
        request = bench.request_for(case, True)
        self.assertEqual(validate_request(request)['photos'], request['photos'])

    def test_prepare_rejects_too_many_photos(self):
        case = copy.deepcopy(self.case)
        case['photos'] *= 7
        with self.assertRaisesRegex(ValueError, 'one to six'):
            bench.request_for(case, True)

    def test_prepare_rejects_oversized_combined_json(self):
        case = copy.deepcopy(self.case)
        case['photos'] *= 6
        with self.assertRaisesRegex(ValueError, '18 MiB'):
            bench.request_for(case, True)

    def test_prepare_rejects_wrong_image_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'not-really-image.jpg'
            path.write_text('not an image')
            case = copy.deepcopy(self.case)
            case['photos'] = [str(path)]
            with self.assertRaisesRegex(ValueError, 'JPEG, PNG, or WebP'):
                bench.request_for(case, True)

    def test_no_external_calls_in_evaluation(self):
        with patch('urllib.request.urlopen', side_effect=AssertionError('network forbidden')):
            self.assertEqual(bench.evaluate(self.case, self.response)['failures'], [])


if __name__ == '__main__':
    unittest.main()
