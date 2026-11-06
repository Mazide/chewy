#!/usr/bin/env python3
"""Offline contract checks and request preparation. Never performs network calls."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from server.analyzer import AnalysisError, DIRECTIONS, _load_json, _validate_evidence
from server.submit import ClientError, MAX_PHOTOS, MAX_REQUEST_BYTES, read_photo

HERE = Path(__file__).resolve().parent


def load_cases(path=HERE / 'cases.json'):
    data = _load_json(Path(path).read_bytes())
    cases = data['cases']
    ids = [c['id'] for c in cases]
    if len(ids) != len(set(ids)):
        raise ValueError('duplicate case id')
    return cases


def photo_path(name):
    return ROOT / name if name.startswith('prototype/') else HERE / name


def request_for(case, include_bytes=False):
    if not 1 <= len(case['photos']) <= MAX_PHOTOS:
        raise ValueError('expected one to six photos')
    photos = []
    seen = set()
    for index, name in enumerate(case['photos']):
        path = photo_path(name)
        if include_bytes or path.is_file():
            try:
                photo = read_photo(path)
            except ClientError as error:
                raise ValueError(str(error)) from None
        else:
            # Missing materials are only usable by synthetic contract fixtures.
            photo = {'id': f'photo-{index + 1}'}
        identity = photo['id']
        if identity in seen:
            # The deliberate duplicate is prepared for direct HTTP submission;
            # submit.py rejects duplicate bytes, but the API accepts distinct IDs.
            photo['id'] = f'{identity}-{index + 1}'
        seen.add(photo['id'])
        photos.append(photo if include_bytes else {'id': photo['id']})
    request = {'firstPhotoAddedAt': '2026-11-05T12:00:00+00:00', 'localDate': '2026-11-05',
               'timeZone': 'Europe/London', 'photos': photos, 'userInput': case['userInput']}
    if include_bytes and len(json.dumps(request, ensure_ascii=False).encode('utf-8')) > MAX_REQUEST_BYTES:
        raise ValueError('combined JSON request exceeds 18 MiB; resize photos')
    return request


def evaluate(case, response, review=None):
    failures = []
    if type(response) is not dict:
        return {'case': case['id'], 'failures': ['response_not_object'], 'humanReview': 'pending'}
    # Accept plain evidence or the server's full result, never an HTTP job envelope.
    evidence = {k: v for k, v in response.items() if k not in ('schemaVersion', 'provenance')}
    if 'schemaVersion' in response and (type(response['schemaVersion']) is not int or response['schemaVersion'] != 1):
        failures.append('schema_version')
    try:
        normalized = _validate_evidence(evidence, request_for(case))
        if normalized != evidence:
            failures.append('directions_required_normalization')
    except (AnalysisError, TypeError, KeyError):
        failures.append('invalid_evidence_contract')
    if evidence.get('outcome') not in case['expected']['outcomes']:
        failures.append('unexpected_outcome')
    statuses = evidence.get('assessment', {}).get('directions', {}) if type(evidence.get('assessment')) is dict else {}
    if type(statuses) is not dict:
        statuses = {}
    for key, allowed in case['expected']['directions'].items():
        if statuses.get(key) not in allowed:
            failures.append('direction:' + key)
    # A hidden oil claim must be attributed to the explicit user clarification.
    if case['id'] == 'oil-clarification':
        components = evidence.get('components', [])
        if type(components) is not list or not any(type(c) is dict and c.get('source') == 'user' and c.get('certainty') == 'clear' and type(c.get('directions')) is list and 'unsaturatedFats' in c['directions'] for c in components):
            failures.append('missing_user_fat_evidence')
    decision = 'pending'
    if review is not None:
        required = ('ingredients', 'uncertainty', 'attribution', 'neutrality', 'multiPhoto')
        if type(review) is not dict or any(review.get(k) not in ('pass', 'fail', 'na') for k in required) or not isinstance(review.get('notes'), str) or not review['notes'].strip():
            failures.append('invalid_human_review')
        else:
            decision = 'fail' if any(review[k] == 'fail' for k in required) else 'reviewed'
            if decision == 'fail':
                failures.append('human_review')
    return {'case': case['id'], 'failures': failures, 'humanReview': decision}


def report(cases, results_dir):
    rows = []
    for case in cases:
        file = results_dir / (case['id'] + '.json')
        if not file.exists():
            rows.append({'case': case['id'], 'status': 'missing_response'})
            continue
        try:
            record = _load_json(file.read_bytes())
            row = evaluate(case, record['response'], record.get('review'))
            row['origin'] = record.get('origin', 'unlabelled')
            row['status'] = 'failed' if row['failures'] else 'contract_checked'
            # This command does not turn synthetic/demo checks into recognition proof.
            row['qualityEvidence'] = False
            row['qualityNote'] = 'Recognition quality requires photo-grounded review and verified run provenance; this tool only checks a supplied record.'
            row['material'] = case['material']
            rows.append(row)
        except (AnalysisError, ValueError, KeyError, TypeError):
            rows.append({'case': case['id'], 'status': 'invalid_record'})
    expected = {c['id'] + '.json' for c in cases}
    extra = sorted(p.name for p in results_dir.glob('*.json') if p.name not in expected)
    return {'notice': 'Offline checks are not proof of Gemini recognition quality. No release threshold is defined.',
            'cases': rows, 'unexpectedFiles': extra,
            'counts': {status: sum(r['status'] == status for r in rows) for status in ('missing_response', 'invalid_record', 'failed', 'contract_checked')}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cases', type=Path, default=HERE / 'cases.json')
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('inventory')
    prep = sub.add_parser('prepare')
    prep.add_argument('case_id')
    prep.add_argument('--output', type=Path, required=True)
    imp = sub.add_parser('import-job')
    imp.add_argument('job', type=Path)
    imp.add_argument('--output', type=Path, required=True)
    check = sub.add_parser('check')
    check.add_argument('results', type=Path)
    args = parser.parse_args()
    cases = load_cases(args.cases)
    if args.command == 'inventory':
        rows = []
        for c in cases:
            photos = []
            for name in c['photos']:
                path = photo_path(name)
                photos.append({'path': name, 'exists': path.is_file(), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None})
            rows.append({'case': c['id'], 'material': c['material'], 'photos': photos, 'humanReview': c['humanReview']})
        print(json.dumps(rows, ensure_ascii=False, indent=2))
    elif args.command == 'import-job':
        job = _load_json(args.job.read_bytes())
        if type(job) is not dict or job.get('status') != 'succeeded' or type(job.get('result')) is not dict:
            parser.error('expected a succeeded job with result')
        provenance = job['result'].get('provenance')
        if provenance is not None and type(provenance) is not dict:
            parser.error('expected object provenance in job result')
        provider = (provenance or {}).get('provider')
        record = {'origin': 'real-provider' if provider == 'gemini' else 'mock' if provider == 'mock' else 'unlabelled', 'response': job['result'], 'review': None}
        with args.output.open('x') as file:
            json.dump(record, file, ensure_ascii=False, indent=2)
        print('Imported locally; provenance is reported, not independently verified.')
    elif args.command == 'prepare':
        case = next((c for c in cases if c['id'] == args.case_id), None)
        if case is None:
            parser.error('unknown case id')
        request = request_for(case, include_bytes=True)
        # Exclusive creation protects existing request artifacts.
        with args.output.open('x') as file:
            json.dump(request, file, ensure_ascii=False)
        print('Request written; no network call performed.')
    else:
        if not args.results.is_dir():
            parser.error('results directory does not exist')
        result = report(cases, args.results)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return int(bool(result['unexpectedFiles']) or any(r['status'] != 'contract_checked' for r in result['cases']))
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, ValueError, AnalysisError) as error:
        print(f'Benchmark input error: {error}', file=sys.stderr)
        sys.exit(2)
