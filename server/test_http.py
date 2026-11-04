"""Loopback-only HTTP/CLI tests; mock and blocking fake analyzers never call Gemini."""

import base64
import copy
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import Mock, patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from server.analyzer import analyze
from server.app import Worker, make_server
from server.store import Store


IMAGE = b"\x89PNG\r\n\x1a\nsynthetic-test-image"


class HTTPTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.store = Store(Path(self.directory.name) / "test.sqlite3")
        self.server = make_server(self.store, port=0)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.close_server)
        self.base_url = f"http://127.0.0.1:{self.server.server_port}"
        self.body = {
            "firstPhotoAddedAt": "2026-10-28T23:59:00-04:00",
            "localDate": "2026-10-28", "timeZone": "America/New_York",
            "photos": [{"id": "photo-1", "mimeType": "image/png",
                        "dataBase64": base64.b64encode(IMAGE).decode()}],
            "userInput": {"dishName": "", "notes": "", "portion": ""},
        }

    def close_server(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=3)

    def start_worker(self, analyzer=analyze):
        worker = Worker(self.store, analyzer=analyzer)
        worker.start()
        self.addCleanup(self.stop_worker, worker)
        return worker

    @staticmethod
    def stop_worker(worker):
        worker.stop()
        worker.join(timeout=3)
        if worker.is_alive():
            raise AssertionError("Test worker failed to stop")

    def request(self, path, *, method="GET", body=None, headers=None):
        request_headers = {"Content-Type": "application/json"}
        request_headers.update(headers or {})
        data = None if body is None else json.dumps(body).encode()
        request = Request(self.base_url + path, data=data, method=method, headers=request_headers)
        try:
            response = urlopen(request, timeout=3)
        except HTTPError as error:
            response = error
        with response:
            raw = response.read()
            value = json.loads(raw) if response.headers.get_content_type() == "application/json" else raw
            return response.status, response.headers, value

    def submit(self, body=None, key="request-1"):
        return self.request("/v1/meals/meal-1/analyses", method="POST",
                            body=self.body if body is None else body,
                            headers={"Idempotency-Key": key})

    def test_post_get_replay_conflict_and_photo_download(self):
        status, _, job = self.submit()
        self.assertEqual(status, 202)
        self.assertEqual(job["status"], "queued")
        self.assertNotIn("dataBase64", json.dumps(job))
        _, _, replay = self.submit()
        self.assertEqual(replay["id"], job["id"])
        _, _, stored = self.request(f"/v1/jobs/{job['id']}")
        self.assertEqual(stored, job)
        _, _, meal = self.request("/v1/meals/meal-1")
        self.assertEqual(meal["localDate"], "2026-10-28")
        self.assertEqual(meal["timeZone"], "America/New_York")
        self.assertEqual(meal["pendingJob"]["id"], job["id"])
        self.assertIsNone(meal["acceptedJob"])
        status, headers, photo = self.request(job["photos"][0]["url"])
        self.assertEqual((status, headers.get_content_type(), photo), (200, "image/png", IMAGE))
        self.assertEqual(headers["Cache-Control"], "no-store")
        changed = copy.deepcopy(self.body)
        changed["userInput"]["notes"] = "A correction"
        status, _, error = self.submit(changed)
        self.assertEqual((status, error["error"]["code"]), (409, "idempotency_conflict"))

    def test_cors_allows_local_prototype_and_blocks_foreign_origin_and_host(self):
        origin = "http://localhost:6006"
        status, headers, _ = self.request("/v1/meals/meal-1/analyses", method="OPTIONS",
                                         headers={"Origin": origin})
        self.assertEqual(status, 200)
        self.assertEqual(headers["Access-Control-Allow-Origin"], origin)
        self.assertIn("Idempotency-Key", headers["Access-Control-Allow-Headers"])
        for request_headers in ({"Origin": "https://example.com"}, {"Host": "example.com"}):
            with self.subTest(headers=request_headers):
                status, headers, _ = self.request("/health", headers=request_headers)
                self.assertEqual(status, 403)
                self.assertIsNone(headers.get("Access-Control-Allow-Origin"))

    def test_invalid_requests_never_create_a_meal(self):
        status, _, error = self.request("/v1/meals/meal-1/analyses", method="POST", body=self.body)
        self.assertEqual((status, error["error"]["code"]), (400, "invalid_idempotency_key"))
        invalid_image = copy.deepcopy(self.body)
        invalid_image["photos"][0]["dataBase64"] = base64.b64encode(b"not-an-image").decode()
        invalid_day = {**self.body, "localDate": "2026-10-29"}
        for body in (invalid_image, invalid_day, {**self.body, "photos": []}):
            with self.subTest(body=body):
                self.assertEqual(self.submit(body)[0], 400)
        status, _, error = self.request("/v1/meals/meal-1/analyses", method="POST", body=self.body,
                                       headers={"Idempotency-Key": "request-1", "Content-Type": "text/plain"})
        self.assertEqual((status, error["error"]["code"]), (415, "expected_application_json"))
        self.assertEqual(self.request("/v1/meals/meal-1")[0], 404)

    def test_real_cli_wait_completes_with_explicit_mock_evidence(self):
        self.start_worker()
        image = Path(self.directory.name) / "meal.png"
        image.write_bytes(IMAGE)
        env = {**os.environ, "NO_PROXY": "127.0.0.1,localhost", "no_proxy": "127.0.0.1,localhost"}
        process = subprocess.run(
            [sys.executable, str(Path(__file__).with_name("submit.py")), str(image),
             "--base-url", self.base_url, "--wait", "--timeout", "5", "--time-zone", "Europe/London"],
            capture_output=True, text=True, timeout=10, env=env,
        )
        self.assertEqual(process.returncode, 0, process.stderr)
        job = json.loads(process.stdout)
        self.assertEqual((job["status"], job["attempts"]), ("succeeded", 1))
        self.assertEqual(job["result"]["provenance"]["provider"], "mock")
        self.assertEqual(job["result"]["outcome"], "insufficient_evidence")
        _, _, meal = self.request(f"/v1/meals/{job['mealId']}")
        self.assertEqual(meal["acceptedJob"]["id"], job["id"])
        self.assertIsNone(meal["pendingJob"])
        self.assertEqual(meal["timeZone"], "Europe/London")

    def test_storage_retries_do_not_repeat_the_provider_call(self):
        saved = threading.Event()
        original_finish = self.store.finish
        attempts = []

        def transient_finish(claim, **completion):
            attempts.append(claim["id"])
            if len(attempts) <= 2:
                raise sqlite3.OperationalError("database is locked")
            result = original_finish(claim, **completion)
            saved.set()
            return result

        analyzer = Mock(side_effect=lambda request, **_options: analyze(request, provider="mock"))
        with patch.object(self.store, "finish", side_effect=transient_finish):
            self.start_worker(analyzer)
            _, _, job = self.submit()
            self.assertTrue(saved.wait(5), "Worker did not retry persistence")
            _, _, completed = self.request(f"/v1/jobs/{job['id']}")
        self.assertEqual((completed["status"], completed["attempts"]), ("succeeded", 1))
        self.assertEqual(attempts, [job["id"]] * 3)
        analyzer.assert_called_once()

    def check_inflight_invalidation(self, delete):
        entered, release = threading.Event(), threading.Event()

        def blocked_analyzer(request, **_options):
            entered.set()
            if not release.wait(5):
                raise AssertionError("Test did not release analyzer")
            return analyze(request, provider="mock")

        worker = self.start_worker(blocked_analyzer)
        self.addCleanup(release.set)
        _, _, job = self.submit()
        self.assertTrue(entered.wait(3), "Worker did not claim submitted job")
        if delete:
            self.assertEqual(self.request("/v1/meals/meal-1", method="DELETE")[0], 200)
        else:
            status, _, cancelled = self.request(f"/v1/jobs/{job['id']}/cancel", method="POST")
            self.assertEqual((status, cancelled["status"]), (200, "cancelled"))
        # Join proves the response has reached finish(), so assertions cannot race it.
        worker.stop()
        release.set()
        worker.join(timeout=3)
        self.assertFalse(worker.is_alive())
        if delete:
            self.assertEqual(self.request("/v1/meals/meal-1")[0], 410)
            self.assertEqual(self.request(f"/v1/jobs/{job['id']}")[0], 410)
            self.assertEqual(self.request(job["photos"][0]["url"])[0], 410)
            with self.store.connection() as db:
                row = db.execute("SELECT status,request,result FROM jobs WHERE id=?", (job["id"],)).fetchone()
                self.assertEqual(tuple(row), ("cancelled", None, None))
        else:
            _, _, cancelled = self.request(f"/v1/jobs/{job['id']}")
            self.assertEqual(cancelled["status"], "cancelled")
            self.assertIsNone(cancelled["result"])
            _, _, meal = self.request("/v1/meals/meal-1")
            self.assertIsNone(meal["acceptedJob"])
            self.assertIsNone(meal["pendingJob"])

    def test_cancel_during_provider_call_prevents_late_commit(self):
        self.check_inflight_invalidation(delete=False)

    def test_delete_during_provider_call_prevents_late_commit_and_photo_access(self):
        self.check_inflight_invalidation(delete=True)


if __name__ == "__main__":
    unittest.main()
