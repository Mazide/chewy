"""Regression tests for preservation, review gates, history and localhost API."""

import base64
import hashlib
import http.client
import io
import json
from pathlib import Path
import tempfile
import threading
import unittest
import zipfile

from PIL import Image

from pipeline import Pipeline, PipelineError, PipelineServer, inspect_png


def png(*, transparent=True, empty=False, clipped=False):
    image = Image.new("RGBA" if transparent else "RGB", (32, 40), (0, 0, 0, 0) if transparent else (40, 70, 90))
    if transparent and not empty:
        for x in range(0 if clipped else 3, 28):
            for y in range(4, 36):
                image.putpixel((x, y), (120, 60, 20, 255))
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.repo = self.root / "repo"
        self.repo.mkdir()
        self.reference_bytes = png()
        self.reference = self.repo / "hero.png"
        self.reference.write_bytes(self.reference_bytes)
        self.catalog = self.repo / "catalog.json"
        self.catalog_data = {
            "title": "Test studio",
            "references": [{"id": "hero", "title": "Hero", "role": "identity", "path": "hero.png"}],
            "jobs": [{"id": job_id, "title": job_id, "kind": "image", "prompt": "Preserve this hero.",
                      "referenceIds": ["hero"], "criteria": ["Same identity"],
                      "target": {"format": "png", "transparent": True, "maxDisplay": {"width": 20, "height": 30}}}
                     for job_id in ("joy", "sleep")],
        }
        self.write_catalog()
        self.web = self.repo / "web"
        self.web.mkdir()
        (self.web / "index.html").write_text("<!doctype html><title>Studio</title>", encoding="utf-8")
        self.pipeline = self.new_pipeline()

    def write_catalog(self):
        self.catalog.write_text(json.dumps(self.catalog_data), encoding="utf-8")

    def new_pipeline(self):
        return Pipeline(repo=self.repo, catalog=self.catalog, workspace=self.repo / "workspace", web=self.web)

    def candidate(self, data=None):
        packet = self.pipeline.prepare("joy")["request"]
        attempt = self.pipeline.import_result("joy", packet["id"], data if data is not None else png(), "result.png", "image_gen")["attempt"]
        return packet, attempt

    def test_transparent_qa_is_distinct_from_human_approval(self):
        _, attempt = self.candidate()
        self.assertTrue(attempt["qa"]["pass"])
        self.assertEqual(attempt["qa"]["bounds"], [3, 4, 28, 36])
        self.assertEqual(attempt["review"], {"status": "pending", "note": ""})
        self.assertTrue(attempt["qa"]["hasTransparency"])
        self.assertIsNone(attempt["export"])
        with self.assertRaises(PipelineError) as caught:
            self.pipeline.export("joy", attempt["id"])
        self.assertEqual(caught.exception.status, 409)

    def test_opaque_or_empty_png_cannot_be_approved(self):
        for data in (png(transparent=False), png(empty=True)):
            with self.subTest(data_sha=hashlib.sha256(data).hexdigest()):
                _, attempt = self.candidate(data)
                self.assertFalse(attempt["qa"]["pass"])
                with self.assertRaises(PipelineError):
                    self.pipeline.review("joy", attempt["id"], "approved")
        self.assertTrue(inspect_png(png(transparent=False), {"transparent": False})["pass"])

    def test_opaque_rgba_does_not_count_as_transparency(self):
        image = Image.new("RGBA", (8, 8), (1, 2, 3, 255))
        buffer = io.BytesIO()
        image.save(buffer, "PNG")
        qa = inspect_png(buffer.getvalue(), {"transparent": True})
        self.assertTrue(qa["hasAlpha"])
        self.assertFalse(qa["hasTransparency"])
        self.assertFalse(qa["pass"])

    def test_clipping_is_explicit_warning(self):
        qa = inspect_png(png(clipped=True), {"transparent": True})
        self.assertTrue(qa["pass"])
        self.assertEqual(next(check["status"] for check in qa["checks"] if check["id"] == "edges"), "warn")

    def test_packets_keep_exact_prompt_job_and_reference_after_catalog_changes(self):
        first = self.pipeline.prepare("joy", "Exact first prompt.  Keep spaces.")["request"]
        snapshot = Path(first["referenced_image_paths"][0])
        self.reference.write_bytes(png(clipped=True))
        self.catalog_data["jobs"][0]["prompt"] = "A later prompt"
        self.catalog_data["jobs"][0]["target"]["transparent"] = False
        self.write_catalog()
        second = self.pipeline.prepare("joy")["request"]
        restored = self.new_pipeline().request(first["id"])
        self.assertEqual(restored, first)
        self.assertEqual(restored["prompt"], "Exact first prompt.  Keep spaces.")
        self.assertTrue(restored["transparent_background"])
        self.assertFalse(second["transparent_background"])
        self.assertEqual(snapshot.read_bytes(), self.reference_bytes)
        self.assertNotEqual(first["references"][0]["sha256"], second["references"][0]["sha256"])
        attempt = self.pipeline.import_result("joy", first["id"], png(transparent=False), "opaque.png", "manual")["attempt"]
        self.assertFalse(attempt["qa"]["pass"], "QA must use immutable target, not the updated catalog")

    def test_job_packet_mismatch_and_path_traversal_are_rejected(self):
        packet = self.pipeline.prepare("joy")["request"]
        for job_id, packet_id, filename in (("sleep", packet["id"], "result.png"),
                                            ("joy", "../request", "result.png"),
                                            ("joy", packet["id"], "../../result.png"),
                                            ("joy", packet["id"], "a\\result.png")):
            with self.subTest(job_id=job_id, packet_id=packet_id, filename=filename):
                with self.assertRaises(PipelineError):
                    self.pipeline.import_result(job_id, packet_id, png(), filename, "image_gen")
        with self.assertRaises(PipelineError):
            self.pipeline.reference_path({"path": "../outside.png"})
        outside = self.root / "outside.png"
        outside.write_bytes(png())
        (self.repo / "linked.png").symlink_to(outside)
        with self.assertRaises(PipelineError):
            self.pipeline.reference_path({"path": "linked.png"})
        self.assertFalse((self.repo / "workspace" / "attempts").exists())

    def test_invalid_png_is_rejected_before_persisting_attempt(self):
        packet = self.pipeline.prepare("joy")["request"]
        jpeg = io.BytesIO()
        Image.new("RGB", (8, 8)).save(jpeg, "JPEG")
        for data in (b"not an image", png()[:-16], jpeg.getvalue()):
            with self.assertRaises(PipelineError):
                self.pipeline.import_result("joy", packet["id"], data, "image.png", "image_gen")
        self.assertEqual(self.pipeline.state()["jobs"][0]["attempts"], [])

    def test_approved_package_preserves_source_references_and_provenance(self):
        data = png()
        packet, attempt = self.candidate(data)
        self.pipeline.review("joy", attempt["id"], "approved", "Owner reviewed the draft.")
        exported = self.pipeline.export("joy", attempt["id"])
        archive_path = self.repo / "workspace" / "exports" / (exported["id"] + ".zip")
        with zipfile.ZipFile(archive_path) as archive:
            self.assertEqual(archive.read("source.png"), data)
            self.assertEqual(archive.read("references/hero.png"), self.reference_bytes)
            manifest = json.loads(archive.read("manifest.json"))
            self.assertFalse(manifest["nativeReady"])
            self.assertEqual(manifest["kind"], "source-package")
            self.assertEqual(manifest["source"]["sha256"], hashlib.sha256(data).hexdigest())
            self.assertEqual(manifest["review"]["reviewer"], "local-owner")
            exported_request = json.loads(archive.read("request.json"))
            self.assertEqual(exported_request["prompt"], packet["prompt"])
            self.assertEqual(exported_request["referenced_image_paths"], ["references/hero.png"])
        restored = self.new_pipeline().state()
        self.assertEqual(restored["jobs"][0]["attempts"][0]["export"], exported)
        self.assertEqual(restored["jobs"][0]["attempts"][0]["review"]["status"], "approved")

    def test_review_history_is_append_only_and_revocation_closes_export_gate(self):
        _, attempt = self.candidate()
        attempt_path = self.repo / "workspace" / "attempts" / attempt["id"]
        original = (attempt_path / "attempt.json").read_bytes()
        self.pipeline.review("joy", attempt["id"], "rejected", "Eyes differ.")
        self.pipeline.review("joy", attempt["id"], "pending", "Review again.")
        self.pipeline.review("joy", attempt["id"], "approved", "Reviewed.")
        self.pipeline.export("joy", attempt["id"])
        self.pipeline.review("joy", attempt["id"], "rejected", "Approval revoked.")
        self.assertEqual(len(list((attempt_path / "reviews").glob("*.json"))), 4)
        self.assertEqual((attempt_path / "attempt.json").read_bytes(), original)
        self.assertIsNone(self.pipeline.attempt(attempt["id"])["export"])
        with self.assertRaises(PipelineError):
            self.pipeline.export("joy", attempt["id"])

    def test_modified_source_and_reference_cannot_be_exported(self):
        packet, attempt = self.candidate()
        self.pipeline.review("joy", attempt["id"], "approved")
        source = self.repo / "workspace" / "attempts" / attempt["id"] / "source.png"
        source.write_bytes(png(clipped=True))
        with self.assertRaises(PipelineError):
            self.pipeline.export("joy", attempt["id"])
        source.write_bytes(png())
        Path(packet["referenced_image_paths"][0]).write_bytes(png(clipped=True))
        with self.assertRaises(PipelineError):
            self.pipeline.export("joy", attempt["id"])

    def test_http_lifecycle_and_hostile_requests(self):
        server = PipelineServer(self.pipeline, 0)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        port = server.server_address[1]

        def request(method, path, body=None, **headers):
            connection = http.client.HTTPConnection("127.0.0.1", port, timeout=3)
            if body is not None:
                body = json.dumps(body).encode()
                headers.setdefault("Content-Type", "application/json")
            connection.request(method, path, body, headers)
            response = connection.getresponse()
            data = response.read()
            connection.close()
            return response.status, data

        status, _ = request("GET", "/")
        self.assertEqual(status, 200)
        status, data = request("POST", "/api/prepare", {"jobId": "joy"})
        self.assertEqual(status, 200)
        packet = json.loads(data)["request"]
        status, data = request("POST", "/api/import", {"jobId": "joy", "packetId": packet["id"],
                                                       "filename": "result.png", "tool": "image_gen",
                                                       "dataBase64": base64.b64encode(png()).decode()})
        self.assertEqual(status, 200)
        attempt = json.loads(data)["attempt"]
        status, data = request("GET", attempt["url"])
        self.assertEqual(status, 200)
        self.assertEqual(data, png())
        status, _ = request("POST", "/api/review", {"jobId": "joy", "attemptId": attempt["id"], "status": "approved"},
                            Origin="https://unrelated.example")
        self.assertEqual(status, 403)
        self.assertEqual(self.pipeline.attempt(attempt["id"])["review"]["status"], "pending")
        status, _ = request("POST", "/api/review", {"jobId": "joy", "attemptId": attempt["id"], "status": "approved"},
                            Origin=f"http://127.0.0.1:{port}")
        self.assertEqual(status, 200)
        status, data = request("POST", "/api/export", {"jobId": "joy", "attemptId": attempt["id"]})
        self.assertEqual(status, 200)
        export = json.loads(data)
        status, _ = request("GET", export["url"])
        self.assertEqual(status, 200)
        status, _ = request("GET", "/api/state", Host="evil.example")
        self.assertEqual(status, 403)
        for path in ("/../catalog.json", "/%2e%2e/catalog.json", "/workspace/requests/a/request.json", "/catalog.json", "/media/attempts/.."):
            status, _ = request("GET", path)
            self.assertIn(status, (400, 404), path)
        status, data = request("POST", "/api/import", {"dataBase64": "%%!"})
        self.assertEqual(status, 400)
        self.assertIn("error", json.loads(data))
        status, _ = request("POST", "/api/prepare", {"jobId": "joy"}, **{"Content-Type": "text/plain"})
        self.assertEqual(status, 415)
        self.pipeline.review("joy", attempt["id"], "rejected")
        status, _ = request("GET", export["url"])
        self.assertEqual(status, 409)

    def test_reference_snapshot_serving_survives_original_change(self):
        packet = self.pipeline.prepare("joy")["request"]
        self.reference.write_bytes(png(clipped=True))
        request_state = self.pipeline.state()["jobs"][0]["requests"][0]
        self.assertEqual(request_state["references"][0]["width"], 32)
        self.assertEqual(request_state["references"][0]["height"], 40)
        url = request_state["references"][0]["url"]
        server = PipelineServer(self.pipeline, 0)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)

        def get(path):
            connection = http.client.HTTPConnection("127.0.0.1", server.server_address[1], timeout=3)
            connection.request("GET", path)
            response = connection.getresponse()
            result = response.status, response.read()
            connection.close()
            return result

        self.assertEqual(get(url), (200, self.reference_bytes))
        self.assertEqual(get(f"/media/request-references/{packet['id']}/missing")[0], 404)
        self.assertEqual(get("/media/request-references/missing/hero")[0], 404)
        self.assertEqual(get(f"/media/request-references/{packet['id']}/%2e%2e")[0], 400)
        Path(packet["referenced_image_paths"][0]).write_bytes(png(clipped=True))
        self.assertEqual(get(url)[0], 409)


if __name__ == "__main__":
    unittest.main()
