"""Animation sequence preservation, timing, review and untrusted ZIP tests."""

import base64
import http.client
import io
import json
from pathlib import Path
import stat
import tempfile
import threading
import unittest
from unittest.mock import patch
import warnings
import zipfile

from PIL import Image
from PIL.PngImagePlugin import PngInfo

from pipeline import Pipeline, PipelineError, PipelineServer, pack_animation_directory
from test_pipeline import png


def sequence(entries=None):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, data in entries if entries is not None else [("frame10.png", png(clipped=True)), ("frame2.png", png()), ("frame1.png", png())]:
            archive.writestr(name, data)
    return buffer.getvalue()


class AnimationTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.repo = Path(temporary.name)
        (self.repo / "hero.png").write_bytes(png())
        self.catalog = self.repo / "catalog.json"
        self.catalog_data = {"references": [{"id": "hero", "path": "hero.png"}], "jobs": [
            {"id": "idle", "kind": "animation", "prompt": "Animate the existing hero.", "referenceIds": ["hero"],
             "motion": {"fps": 24, "playback": "once"}, "target": {"transparent": True, "maxDisplay": {"width": 10, "height": 10}}},
            {"id": "image", "kind": "image", "prompt": "Preserve hero.", "referenceIds": ["hero"], "target": {"transparent": True}},
        ]}
        self.catalog.write_text(json.dumps(self.catalog_data))
        self.pipeline = Pipeline(repo=self.repo, catalog=self.catalog, workspace=self.repo / "workspace")
        self.packet = self.pipeline.prepare("idle")["request"]

    def import_sequence(self, data=None, **kwargs):
        return self.pipeline.import_animation("idle", self.packet["id"], data if data is not None else sequence(), "motion.zip", "native-atlas", **kwargs)["attempt"]

    def test_sequence_order_timing_provenance_and_export_preserve_bytes(self):
        data = sequence()
        attempt = self.import_sequence(data, fps=12, playback="pingpong")
        animation = attempt["animation"]
        self.assertEqual(attempt["kind"], "animation")
        self.assertEqual([frame["filename"] for frame in animation["frames"]], ["frame1.png", "frame2.png", "frame10.png"])
        self.assertEqual(animation["fps"], 12)
        self.assertEqual(animation["playback"], "pingpong")
        self.assertEqual(animation["frameCount"], 3)
        self.assertAlmostEqual(animation["durationSeconds"], 4 / 12)
        self.assertEqual(attempt["url"], animation["frames"][0]["url"])
        self.assertTrue(attempt["qa"]["pass"])
        self.assertEqual(attempt["review"]["status"], "pending")
        with self.assertRaises(PipelineError):
            self.pipeline.export("idle", attempt["id"])
        self.pipeline.review("idle", attempt["id"], "approved", "Owner inspected motion and seam.")
        export = self.pipeline.export("idle", attempt["id"])
        with zipfile.ZipFile(self.repo / "workspace/exports" / (export["id"] + ".zip")) as package, zipfile.ZipFile(io.BytesIO(data)) as original:
            self.assertEqual(package.read("source.zip"), data)
            self.assertEqual(package.read("references/hero.png"), png())
            exported_animation = json.loads(package.read("animation.json"))
            manifest = json.loads(package.read("manifest.json"))
            self.assertFalse(manifest["nativeReady"])
            self.assertEqual(manifest["source"]["file"], "source.zip")
            self.assertEqual(manifest["animation"], exported_animation)
            self.assertEqual(exported_animation["durationSeconds"], animation["durationSeconds"])
            for frame in exported_animation["frames"]:
                self.assertNotIn("url", frame)
                self.assertEqual(package.read(frame["file"]), original.read(frame["filename"]))
        restored = Pipeline(repo=self.repo, catalog=self.catalog, workspace=self.repo / "workspace")
        self.assertEqual(restored.attempt(attempt["id"])["animation"], animation)
        self.assertEqual(restored.state()["jobs"][0]["attempts"][0]["export"], export)

    def test_motion_defaults_come_from_immutable_packet(self):
        self.catalog_data["jobs"][0]["motion"] = {"fps": 1, "playback": "loop"}
        self.catalog.write_text(json.dumps(self.catalog_data))
        attempt = self.import_sequence()
        self.assertEqual(attempt["animation"]["fps"], 24)
        self.assertEqual(attempt["animation"]["playback"], "once")
        self.assertEqual(attempt["animation"]["durationSeconds"], 3 / 24)
        self.assertIn("external animation tool", self.packet["generation"])
        self.assertNotIn("Run image_gen", self.packet["generation"])

    def test_invalid_fps_playback_and_wrong_job_kind_are_rejected(self):
        for fps in (True, False, 0, 61, "24", float("nan"), float("inf")):
            with self.subTest(fps=fps), self.assertRaises(PipelineError):
                self.import_sequence(fps=fps)
        for playback in ("", "forever", [], 1):
            with self.subTest(playback=playback), self.assertRaises(PipelineError):
                self.import_sequence(playback=playback)
        image_packet = self.pipeline.prepare("image")["request"]
        with self.assertRaises(PipelineError):
            self.pipeline.import_animation("image", image_packet["id"], sequence(), "motion.zip", "manual")
        with self.assertRaises(PipelineError):
            self.pipeline.import_animation("image", self.packet["id"], sequence(), "motion.zip", "manual")
        with self.assertRaises(PipelineError):
            self.pipeline.import_result("idle", self.packet["id"], png(), "frame.png", "manual")
        self.assertFalse((self.repo / "workspace/attempts").exists())

    def test_bad_alpha_or_empty_frame_cannot_be_approved_or_exported(self):
        for invalid in (png(transparent=False), png(empty=True)):
            with self.subTest(size=len(invalid)):
                attempt = self.import_sequence(sequence([("frame1.png", png()), ("frame2.png", invalid)]))
                self.assertFalse(attempt["qa"]["pass"])
                with self.assertRaises(PipelineError):
                    self.pipeline.review("idle", attempt["id"], "approved")
                with self.assertRaises(PipelineError):
                    self.pipeline.export("idle", attempt["id"])

    def test_zip_traversal_duplicates_symlinks_and_extra_entries_are_rejected(self):
        for name in ("../frame.png", "/frame.png", "folder/frame.png", "folder\\frame.png", "C:frame.png", "notes.txt", "folder/"):
            with self.subTest(name=name), self.assertRaises(PipelineError):
                self.import_sequence(sequence([("first.png", png()), (name, png())]))
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            duplicate = sequence([("same.png", png()), ("same.png", png())])
        for data in (duplicate, sequence([("SAME.png", png()), ("same.png", png())])):
            with self.assertRaises(PipelineError):
                self.import_sequence(data)
        link = zipfile.ZipInfo("linked.png")
        link.create_system = 3
        link.external_attr = (stat.S_IFLNK | 0o777) << 16
        with self.assertRaises(PipelineError):
            self.import_sequence(sequence([("first.png", png()), (link, b"../hero.png")]))
        self.assertFalse((self.repo / "workspace/attempts").exists())

    def test_corrupt_png_apng_mismatched_canvas_and_bad_zip_are_rejected(self):
        small = io.BytesIO()
        Image.new("RGBA", (16, 20), (0, 0, 0, 0)).save(small, "PNG")
        animated = io.BytesIO()
        Image.new("RGBA", (32, 40), (1, 2, 3, 255)).save(animated, "PNG", save_all=True,
                                                       append_images=[Image.new("RGBA", (32, 40), (3, 2, 1, 255))], duration=40)
        for invalid in (b"not png", png()[:-16], small.getvalue(), animated.getvalue()):
            with self.subTest(size=len(invalid)), self.assertRaises(PipelineError):
                self.import_sequence(sequence([("first.png", png()), ("second.png", invalid)]))
        for invalid in (b"not zip", b"", sequence()[:-20]):
            with self.assertRaises(PipelineError):
                self.import_sequence(invalid)
        self.assertFalse((self.repo / "workspace/attempts").exists())

    def test_count_bytes_and_decoded_pixel_limits(self):
        for entries in ([], [("frame.png", png())], [(f"{index}.png", png()) for index in range(241)]):
            with self.subTest(count=len(entries)), self.assertRaises(PipelineError):
                self.import_sequence(sequence(entries))
        data = sequence()
        with patch("pipeline.MAX_ANIMATION_BYTES", len(data) - 1), self.assertRaises(PipelineError):
            self.import_sequence(data)
        with patch("pipeline.MAX_IMAGE_BYTES", len(png()) - 1), self.assertRaises(PipelineError):
            self.import_sequence(data)
        with patch("pipeline.MAX_ANIMATION_PIXELS", 32 * 40 * 3 - 1), self.assertRaises(PipelineError):
            self.import_sequence(data)
        padded = io.BytesIO()
        metadata = PngInfo()
        metadata.add_text("padding", "a" * 10000)
        with Image.open(io.BytesIO(png())) as image:
            image.save(padded, "PNG", pnginfo=metadata)
        data = sequence([("one.png", padded.getvalue()), ("two.png", padded.getvalue())])
        self.assertLess(len(data), len(padded.getvalue()))
        with patch("pipeline.MAX_ANIMATION_BYTES", len(padded.getvalue()) + 1), self.assertRaises(PipelineError):
            self.import_sequence(data)
        self.assertFalse((self.repo / "workspace/attempts").exists())

    def test_modified_source_frame_or_reference_prevents_export(self):
        attempt = self.import_sequence()
        self.pipeline.review("idle", attempt["id"], "approved")
        base = self.repo / "workspace/attempts" / attempt["id"]
        for path in (base / "source.zip", base / "frames/0000.png", Path(self.packet["referenced_image_paths"][0])):
            with self.subTest(path=path.name):
                original = path.read_bytes()
                path.write_bytes(b"tampered")
                with self.assertRaises(PipelineError):
                    self.pipeline.export("idle", attempt["id"])
                path.write_bytes(original)
        self.assertFalse((self.repo / "workspace/exports").exists())

    def test_directory_pack_preserves_files_and_rejects_links(self):
        directory = self.repo / "frames"
        directory.mkdir()
        originals = {"frame10.png": png(clipped=True), "frame2.png": png()}
        for name, data in originals.items():
            (directory / name).write_bytes(data)
        with zipfile.ZipFile(io.BytesIO(pack_animation_directory(directory))) as archive:
            self.assertEqual(archive.namelist(), ["frame2.png", "frame10.png"])
            for name, data in originals.items():
                self.assertEqual(archive.read(name), data)
        (directory / "linked.png").symlink_to(self.repo / "hero.png")
        with self.assertRaises(PipelineError):
            pack_animation_directory(directory)

    def test_http_animation_import_frames_limits_and_review_gate(self):
        server = PipelineServer(self.pipeline, 0)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)

        def request(method, path, body=None):
            connection = http.client.HTTPConnection("127.0.0.1", server.server_address[1], timeout=3)
            connection.request(method, path, json.dumps(body) if body is not None else None,
                               {"Content-Type": "application/json"} if body is not None else {})
            response = connection.getresponse()
            result = response.status, response.read()
            connection.close()
            return result

        body = {"jobId": "idle", "packetId": self.packet["id"], "filename": "motion.zip", "tool": "native-atlas",
                "fps": 24, "playback": "once", "dataBase64": base64.b64encode(sequence()).decode()}
        with patch("pipeline.MAX_BODY_BYTES", 100):
            status, data = request("POST", "/api/import-animation", body)
            self.assertEqual(status, 200, data)
            self.assertEqual(request("POST", "/api/import", body)[0], 413)
        attempt = json.loads(data)["attempt"]
        self.assertEqual(request("GET", attempt["animation"]["frames"][0]["url"]), (200, png()))
        for index in ("-1", "03", "3", "9999999", "%2e%2e"):
            self.assertIn(request("GET", f"/media/frames/{attempt['id']}/{index}")[0], (400, 404))
        self.assertEqual(request("POST", "/api/export", {"jobId": "idle", "attemptId": attempt["id"]})[0], 409)
        self.assertEqual(request("POST", "/api/review", {"jobId": "idle", "attemptId": attempt["id"], "status": "approved"})[0], 200)
        status, export_data = request("POST", "/api/export", {"jobId": "idle", "attemptId": attempt["id"]})
        self.assertEqual(status, 200)
        export = json.loads(export_data)
        self.assertEqual(request("GET", export["url"])[0], 200)
        self.pipeline.review("idle", attempt["id"], "rejected")
        self.assertEqual(request("GET", export["url"])[0], 409)
        (self.repo / "workspace/attempts" / attempt["id"] / "frames/0000.png").write_bytes(b"tampered")
        self.assertEqual(request("GET", attempt["url"])[0], 409)


if __name__ == "__main__":
    unittest.main()
