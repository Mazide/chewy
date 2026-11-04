import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from server import submit


class SubmitTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.photo = Path(self.directory.name) / "meal.png"
        self.photo.write_bytes(b"\x89PNG\r\n\x1a\nphoto")
        self.stdout = io.StringIO()
        self.stderr = io.StringIO()
        self.enterContext(contextlib.redirect_stdout(self.stdout))
        self.enterContext(contextlib.redirect_stderr(self.stderr))

    def test_correction_preserves_original_day_and_retry_payload(self):
        original = {
            "id": "meal-1", "firstPhotoAddedAt": "2026-10-28T23:59:00-04:00",
            "localDate": "2026-10-28", "timeZone": "America/New_York",
        }
        job = {"id": "job-1", "status": "succeeded", "mealId": "meal-1"}
        args = [str(self.photo), "--meal-id", "meal-1", "--idempotency-key", "retry-1",
                "--notes", "This is tofu", "--time-zone", "Asia/Tokyo"]
        with patch.object(submit, "api_request", side_effect=[original, job, original, job]) as request:
            self.assertEqual(submit.main(args), 0)
            self.assertEqual(submit.main(args), 0)
        first_post = request.call_args_list[1]
        second_post = request.call_args_list[3]
        self.assertEqual(first_post, second_post)
        payload = first_post.kwargs["payload"]
        for key in ("firstPhotoAddedAt", "localDate", "timeZone"):
            self.assertEqual(payload[key], original[key])
        self.assertEqual(payload["userInput"]["notes"], "This is tofu")
        self.assertNotIn(payload["photos"][0]["dataBase64"], self.stdout.getvalue())
        self.assertNotIn(payload["photos"][0]["dataBase64"], self.stderr.getvalue())

    def test_meal_lookup_failure_does_not_submit_a_new_timestamp(self):
        with patch.object(submit, "api_request", side_effect=submit.APIError(503, "Unavailable")) as request:
            self.assertEqual(submit.main([str(self.photo), "--meal-id", "meal-1"]), 1)
        self.assertEqual(request.call_count, 1)
        self.assertIn("503", self.stderr.getvalue())

    def test_unknown_explicit_meal_id_creates_a_new_meal(self):
        job = {"id": "job-1", "status": "queued", "mealId": "new-meal"}
        with patch.object(submit, "api_request", side_effect=[submit.APIError(404, "Not found"), job]) as request:
            self.assertEqual(submit.main([str(self.photo), "--meal-id", "new-meal"]), 0)
        payload = request.call_args_list[1].kwargs["payload"]
        self.assertEqual(payload["timeZone"], "UTC")
        self.assertTrue(payload["firstPhotoAddedAt"].endswith("+00:00"))
        self.assertEqual(payload["localDate"], payload["firstPhotoAddedAt"][:10])

    def test_failed_analysis_is_nonzero_even_on_idempotent_replay(self):
        failed = {"id": "job-1", "status": "failed", "error": {"code": "provider_timeout"}}
        with patch.object(submit, "api_request", return_value=failed):
            self.assertEqual(submit.main([str(self.photo), "--wait"]), 1)
        self.assertEqual(json.loads(self.stdout.getvalue()), failed)

    def test_polling_timeout_is_bounded_and_does_not_cancel(self):
        queued = {"id": "job-1", "status": "queued"}
        with patch.object(submit.time, "monotonic", side_effect=[0, 0, 1, 1]), \
                patch.object(submit.time, "sleep") as sleep, \
                patch.object(submit, "api_request") as request:
            with self.assertRaisesRegex(submit.ClientError, "may still complete"):
                submit.wait_for_job("http://127.0.0.1:8787", queued, 1)
        sleep.assert_called_once_with(1)
        request.assert_not_called()

    def test_unsupported_image_is_rejected_before_network(self):
        self.photo.write_bytes(b"GIF89a")
        with patch.object(submit, "api_request") as request:
            self.assertEqual(submit.main([str(self.photo)]), 1)
        request.assert_not_called()

    def test_oversized_combined_request_is_rejected_before_post(self):
        with patch.object(submit, "MAX_REQUEST_BYTES", 1), patch.object(submit, "urlopen") as request:
            self.assertEqual(submit.main([str(self.photo)]), 1)
        request.assert_not_called()
        self.assertIn("Combined request exceeds", self.stderr.getvalue())


if __name__ == "__main__":
    unittest.main()
