"""Runway tests use fake transports only; no requests or credits leave the test."""

import base64
import http.client
import io
import json
import os
from pathlib import Path
import stat
import tempfile
import threading
import unittest
from unittest.mock import Mock, patch
from urllib.error import HTTPError

from PIL import Image

from pipeline import Pipeline, PipelineError, PipelineServer
from runway import ProviderError, RunwayClient, RunwayError, atomic_json


SECRET = "rwy_FAKE_ONLY_TEST_SECRET_0123456789"
TASK_ID = "17f20503-6c24-4c16-946b-35dbbce2af2f"
MP4 = b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom" + b"test-video-fixture"


def reference_png(size=(384, 512)):
    buffer = io.BytesIO()
    Image.new("RGBA", size, (210, 100, 20, 255)).save(buffer, "PNG")
    return buffer.getvalue()


class FakeClient:
    def __init__(self):
        self.calls = []
        self.downloads = []
        self.organization = {"creditBalance": 1000}
        self.submit = {"id": TASK_ID}
        self.task = {"id": TASK_ID, "status": "PENDING"}
        self.video = MP4

    def request(self, method, path, key, payload=None):
        self.calls.append((method, path, key, payload))
        value = self.organization if path == "/v1/organization" else self.submit if method == "POST" else self.task
        if isinstance(value, Exception):
            raise value
        return value

    def download(self, url):
        self.downloads.append(url)
        if isinstance(self.video, Exception):
            raise self.video
        return self.video

    @property
    def paid_calls(self):
        return [call for call in self.calls if call[0] == "POST"]


class RunwayTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.repo = Path(directory.name)
        (self.repo / "hero.png").write_bytes(reference_png())
        self.catalog = self.repo / "catalog.json"
        self.catalog.write_text(json.dumps({"references": [{"id": "hero", "path": "hero.png"}], "jobs": [
            {"id": "motion", "kind": "animation", "prompt": "Locked camera. A calm living character, subtle movement.",
             "referenceIds": ["hero"], "target": {"transparent": True}},
            {"id": "still", "kind": "image", "prompt": "A still character.", "referenceIds": ["hero"], "target": {"transparent": True}}
        ]}))
        self.pipeline = Pipeline(repo=self.repo, catalog=self.catalog, workspace=self.repo / "workspace")
        self.packet = self.pipeline.prepare("motion")["request"]
        self.runway = self.pipeline.runway
        self.client = FakeClient()
        self.runway.client = self.client
        self.environment = patch.dict(os.environ, {}, clear=True)
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def generate(self, *, model="gen4.5", request_id="click-one"):
        return self.runway.generate("motion", self.packet["id"], "hero", model, request_id)["generation"]

    def configure(self):
        return self.runway.save_key(SECRET)

    def successful_task(self):
        self.client.task = {"id": TASK_ID, "status": "SUCCEEDED", "output": ["https://example.cloudfront.net/output.mp4?signed=private-output"]}

    def reset_refresh_interval(self, generation):
        path = self.runway._record_path(generation["id"])
        record = json.loads(path.read_text())
        record["lastRefreshEpoch"] = 0
        atomic_json(path, record)

    def test_key_stays_private_and_status_is_only_configuration(self):
        self.assertFalse(self.runway.status()["configured"])
        status = self.configure()
        self.assertTrue(status["configured"])
        self.assertEqual(status["source"], "local")
        self.assertNotIn("verified", status)
        self.assertNotIn(SECRET, json.dumps(status))
        self.assertEqual(self.client.calls, [])
        path = self.repo / "workspace/private/runway.json"
        self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
        self.assertEqual(stat.S_IMODE(path.parent.stat().st_mode), 0o700)
        self.assertEqual(json.loads(path.read_text())["apiKey"], SECRET)
        self.runway.save_key(SECRET + "updated")
        self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
        self.assertNotIn(SECRET, json.dumps(self.pipeline.state()))

    def test_environment_key_is_supported_without_persisting_it(self):
        with patch.dict(os.environ, {"RUNWAYML_API_SECRET": SECRET}):
            self.assertEqual(self.runway.status()["source"], "environment")
            self.generate()
        self.assertFalse((self.repo / "workspace/private/runway.json").exists())
        for path in (self.repo / "workspace").rglob("*.json"):
            self.assertNotIn(SECRET, path.read_text())

    def test_validation_happens_before_any_external_call(self):
        self.configure()
        for args in (("motion", self.packet["id"], "missing", "gen4.5", "bad-ref"),
                     ("motion", self.packet["id"], "hero", "unknown", "bad-model"),
                     ("motion", self.packet["id"], "hero", "gen4.5", "../bad-id")):
            with self.subTest(args=args), self.assertRaises((RunwayError, PipelineError)):
                self.runway.generate(*args)
        still = self.pipeline.prepare("still")["request"]
        with self.assertRaises(RunwayError):
            self.runway.generate("still", still["id"], "hero", "gen4.5", "still-id")
        long_packet = self.pipeline.prepare("motion", "😀" * 501)["request"]
        with self.assertRaises(RunwayError):
            self.runway.generate("motion", long_packet["id"], "hero", "gen4.5", "long-id")
        Path(self.packet["referenced_image_paths"][0]).write_bytes(b"changed")
        with self.assertRaises(PipelineError):
            self.generate()
        self.assertEqual(self.client.calls, [])

    def test_data_uri_limit_blocks_before_paid_call(self):
        self.configure()
        with patch("runway.MAX_DATA_URI_BYTES", 30), self.assertRaises(RunwayError):
            self.generate()
        self.assertEqual(self.client.calls, [])

    def test_model_dimensions_and_aspect_are_validated_before_external_calls(self):
        self.configure()
        invalid_inputs = (("kling3.0_standard", (299, 400)), ("kling3.0_standard", (400, 299)),
                          ("kling3.0_standard", (300, 751)), ("kling3.0_standard", (751, 300)),
                          ("gen4.5", (300, 601)), ("gen4.5", (601, 300)))
        for index, (model, size) in enumerate(invalid_inputs):
            with self.subTest(model=model, size=size):
                (self.repo / "hero.png").write_bytes(reference_png(size))
                packet = self.pipeline.prepare("motion")["request"]
                with self.assertRaises(RunwayError):
                    self.runway.generate("motion", packet["id"], "hero", model, f"invalid-dimensions-{index}")
        for model, size in (("kling3.0_standard", (300, 750)), ("kling3.0_standard", (750, 300)),
                            ("gen4.5", (300, 600)), ("gen4.5", (600, 300))):
            with self.subTest(model=model, boundary=size):
                (self.repo / "hero.png").write_bytes(reference_png(size))
                packet = self.pipeline.prepare("motion")["request"]
                self.runway._input("motion", packet["id"], "hero", model)
        self.assertEqual(self.client.calls, [])
        self.assertEqual(self.runway.generations()["generations"], [])

    def test_generation_sends_frozen_reference_prompt_duration_and_no_audio(self):
        self.configure()
        original = Path(self.packet["referenced_image_paths"][0]).read_bytes()
        (self.repo / "hero.png").write_bytes(b"catalog source changed")
        generation = self.generate(model="kling3.0_standard")
        self.assertEqual(generation["status"], "PENDING")
        self.assertEqual(generation["estimatedCostUsd"], 0.45)
        self.assertEqual(generation["kind"], "video-draft")
        self.assertFalse(generation["nativeReady"])
        self.assertNotIn("hasAlpha", generation)
        self.assertEqual([call[:2] for call in self.client.calls], [("GET", "/v1/organization"), ("POST", "/v1/image_to_video")])
        payload = self.client.paid_calls[0][3]
        self.assertEqual(payload["promptText"], self.packet["prompt"])
        self.assertEqual(payload["duration"], 5)
        self.assertFalse(payload["audio"])
        self.assertEqual(payload["ratio"], "720:1280")
        self.assertEqual(base64.b64decode(payload["promptImage"].split(",", 1)[1]), original)
        serialized = json.dumps(self.runway.generations())
        self.assertNotIn(SECRET, serialized)
        self.assertNotIn("promptImage", serialized)

    def test_duplicate_id_active_packet_and_restart_never_resubmit(self):
        self.configure()
        first = self.generate()
        self.assertEqual(self.generate(), first)
        with self.assertRaises(RunwayError):
            self.generate(request_id="another-click")
        with self.assertRaises(RunwayError):
            self.generate(model="kling3.0_standard")
        restored = Pipeline(repo=self.repo, catalog=self.catalog, workspace=self.repo / "workspace")
        restored.runway.client = self.client
        self.assertEqual(restored.runway.generate("motion", self.packet["id"], "hero", "gen4.5", "click-one")["generation"], first)
        self.assertEqual(len(self.client.paid_calls), 1)

    def test_preflight_rejects_invalid_key_or_low_balance_without_paid_call(self):
        self.configure()
        for response in (ProviderError(401), ProviderError(403), ProviderError(500), ProviderError(), {"creditBalance": 59}):
            self.client.organization = response
            with self.subTest(response=type(response).__name__), self.assertRaises(RunwayError):
                self.generate()
        self.assertEqual(self.client.paid_calls, [])
        self.assertEqual(self.runway.generations()["generations"], [])
        self.client.organization = ProviderError(404)
        self.assertEqual(self.generate()["status"], "PENDING")

    def test_ambiguous_submission_is_saved_unknown_and_never_retried(self):
        self.configure()
        self.client.submit = ProviderError()
        generation = self.generate()
        self.assertEqual(generation["status"], "UNKNOWN")
        self.assertNotIn("taskId", generation)
        self.assertEqual(self.generate()["status"], "UNKNOWN")
        self.runway.refresh(generation["id"])
        with self.assertRaises(RunwayError):
            self.generate(request_id="second-click")
        self.assertEqual(len(self.client.paid_calls), 1)
        self.assertNotIn(SECRET, json.dumps(self.runway.generations()))

    def test_rejected_submit_and_failed_task_have_no_automatic_retry(self):
        self.configure()
        self.client.submit = ProviderError(400)
        generation = self.generate()
        self.assertEqual(generation["status"], "FAILED")
        self.assertEqual(self.generate()["status"], "FAILED")
        self.runway.refresh(generation["id"])
        self.assertEqual(len(self.client.paid_calls), 1)
        self.client.submit = {"id": TASK_ID}
        second = self.generate(request_id="intentional-second")
        self.client.task = {"status": "FAILED", "failure": "secret " + SECRET, "failureCode": SECRET}
        failed = self.runway.refresh(second["id"])["generation"]
        self.assertEqual(failed["status"], "FAILED")
        self.assertNotIn(SECRET, json.dumps(failed))
        self.assertEqual(len(self.client.paid_calls), 2)

    def test_success_download_persists_video_without_alpha_or_native_approval(self):
        self.configure()
        generation = self.generate()
        self.successful_task()
        result = self.runway.refresh(generation["id"])["generation"]
        self.assertEqual(result["status"], "SUCCEEDED")
        self.assertEqual(result["videoUrl"], "/media/runway/" + generation["id"])
        self.assertEqual(self.runway.video(generation["id"]).read_bytes(), MP4)
        self.assertFalse(result["nativeReady"])
        self.assertNotIn("signed=", json.dumps(result))
        self.assertNotIn("review", result)
        self.assertEqual(self.pipeline.state()["jobs"][0]["attempts"], [])
        self.runway.refresh(generation["id"])
        self.assertEqual(len(self.client.downloads), 1)
        for path in (self.repo / "workspace/runway").rglob("*.json"):
            self.assertNotIn(SECRET, path.read_text())
            self.assertNotIn("Authorization", path.read_text())

    def test_download_failure_can_retry_without_generating_again(self):
        self.configure()
        generation = self.generate()
        self.successful_task()
        self.client.video = ProviderError(503)
        failed = self.runway.refresh(generation["id"])["generation"]
        self.assertEqual(failed["status"], "SUCCEEDED")
        self.assertIn("error", failed)
        self.assertNotIn("videoUrl", failed)
        self.client.video = MP4
        self.reset_refresh_interval(generation)
        result = self.runway.refresh(generation["id"])["generation"]
        self.assertIn("videoUrl", result)
        self.assertNotIn("error", result)
        self.assertEqual(len(self.client.paid_calls), 1)

    def test_refresh_rate_limit_and_invalid_output_url(self):
        self.configure()
        generation = self.generate()
        self.runway.refresh(generation["id"])
        count = len(self.client.calls)
        self.runway.refresh(generation["id"])
        self.assertEqual(len(self.client.calls), count)
        self.reset_refresh_interval(generation)
        self.client.task = {"status": "SUCCEEDED", "output": ["http://127.0.0.1:8000/private"]}
        result = self.runway.refresh(generation["id"])["generation"]
        self.assertIn("error", result)
        self.assertEqual(self.client.downloads, [])

    def test_video_download_limits_and_cdn_requests_have_no_authorization(self):
        from email.message import Message
        client = RunwayClient()
        response = Mock()
        response.headers = Message()
        response.headers["Content-Type"] = "video/mp4"
        response.headers["Content-Length"] = str(len(MP4))
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        response.read.side_effect = [MP4, b""]
        client.opener = Mock()
        client.opener.open.return_value = response
        self.assertEqual(client.download("https://example.cloudfront.net/video.mp4"), MP4)
        request = client.opener.open.call_args.args[0]
        self.assertIsNone(request.get_header("Authorization"))
        response.read.reset_mock()
        with patch("runway.MAX_VIDEO_BYTES", len(MP4) - 1), self.assertRaises(ProviderError):
            client.download("https://example.cloudfront.net/video.mp4")
        response.read.assert_not_called()
        response.headers.replace_header("Content-Type", "text/html")
        with self.assertRaises(ProviderError):
            client.download("https://example.cloudfront.net/video.mp4")
        for url in ("http://example.com/video.mp4", "https://127.0.0.1/video.mp4", "https://name:password@example.com/video.mp4"):
            with self.subTest(url=url), self.assertRaises(ProviderError):
                client.download(url)

    def test_interrupted_submission_record_is_unknown_and_blocks_a_second_charge(self):
        self.configure()
        generation = self.generate()
        path = self.runway._record_path(generation["id"])
        record = json.loads(path.read_text())
        record["status"] = "SUBMITTING"
        del record["taskId"]
        atomic_json(path, record)
        self.assertEqual(self.runway.generations()["generations"][0]["status"], "UNKNOWN")
        self.assertEqual(self.generate()["status"], "UNKNOWN")
        with self.assertRaises(RunwayError):
            self.generate(request_id="after-restart")
        self.assertEqual(len(self.client.paid_calls), 1)

    def test_transport_headers_and_errors_do_not_echo_provider_body_or_secret(self):
        client = RunwayClient()
        response = Mock()
        response.read.return_value = json.dumps({"id": TASK_ID}).encode()
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        client.opener = Mock()
        client.opener.open.return_value = response
        self.assertEqual(client.request("POST", "/v1/image_to_video", SECRET, {"model": "gen4.5"}), {"id": TASK_ID})
        request = client.opener.open.call_args.args[0]
        self.assertEqual(request.full_url, "https://api.dev.runwayml.com/v1/image_to_video")
        self.assertEqual(request.get_header("Authorization"), "Bearer " + SECRET)
        self.assertEqual(request.get_header("X-runway-version"), "2024-11-06")
        client.opener.open.side_effect = HTTPError(request.full_url, 400, SECRET, {}, io.BytesIO(SECRET.encode()))
        with self.assertRaises(ProviderError) as caught:
            client.request("POST", "/v1/image_to_video", SECRET, {})
        self.assertNotIn(SECRET, str(caught.exception))

    def test_http_status_generation_video_ranges_and_private_files(self):
        server = PipelineServer(self.pipeline, 0)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)

        def request(method, path, body=None, **headers):
            connection = http.client.HTTPConnection("127.0.0.1", server.server_address[1], timeout=3)
            if body is not None:
                headers["Content-Type"] = "application/json"
            connection.request(method, path, json.dumps(body) if body is not None else None, headers)
            response = connection.getresponse()
            result = response.status, response.read(), dict(response.getheaders())
            connection.close()
            return result

        status, body, _ = request("POST", "/api/runway/key", {"apiKey": SECRET})
        self.assertEqual(status, 200)
        self.assertNotIn(SECRET.encode(), body)
        payload = {"jobId": "motion", "packetId": self.packet["id"], "referenceId": "hero", "model": "gen4.5", "clientRequestId": "browser-click"}
        self.assertEqual(request("POST", "/api/runway/generate", payload, Origin="https://unrelated.example")[0], 403)
        self.assertEqual(self.client.calls, [])
        status, body, _ = request("POST", "/api/runway/generate", payload)
        self.assertEqual(status, 200)
        generation = json.loads(body)["generation"]
        self.successful_task()
        status, body, _ = request("POST", "/api/runway/refresh", {"generationId": generation["id"]})
        self.assertEqual(status, 200)
        generation = json.loads(body)["generation"]
        status, data, headers = request("GET", generation["videoUrl"], Range="bytes=4-7")
        self.assertEqual((status, data), (206, b"ftyp"))
        self.assertEqual(headers["Content-Type"], "video/mp4")
        self.assertEqual(request("GET", generation["videoUrl"], Range="bytes=9999-")[0], 416)
        self.assertEqual(request("GET", generation["downloadUrl"])[1], MP4)
        for url in ("/api/runway/status", "/api/runway/generations?packetId=" + self.packet["id"]):
            status, data, _ = request("GET", url)
            self.assertEqual(status, 200)
            self.assertNotIn(SECRET.encode(), data)
        self.assertEqual(request("GET", "/workspace/private/runway.json")[0], 404)
        self.assertEqual(request("GET", "/private/runway.json")[0], 404)


if __name__ == "__main__":
    unittest.main()
