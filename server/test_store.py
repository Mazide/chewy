import base64
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from server.store import Store, StoreError


def request():
    return {"firstPhotoAddedAt": "2026-10-29T12:00:00+00:00", "localDate": "2026-10-29",
            "timeZone": "Europe/London", "userInput": {"dishName": "Lunch", "notes": "", "portion": ""},
            "photos": [{"id": "photo-1", "mimeType": "image/png",
                        "dataBase64": base64.b64encode(b"\x89PNG\r\n\x1a\nfixture").decode()}]}


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "queue.sqlite3"
        self.store = Store(self.path)

    def submit(self, key="first", payload=None, meal="meal-1"):
        return self.store.submit(meal, key, payload or request(), "mock", "mock")

    def accept(self, key="first", payload=None, result=None):
        job = self.submit(key, payload)
        claim = self.store.claim(3)
        self.assertTrue(self.store.finish(claim, result=result or {"outcome": "food", "dishName": key}))
        return job

    def test_concurrent_replay_creates_exactly_one_job(self):
        with ThreadPoolExecutor(max_workers=8) as pool:
            jobs = list(pool.map(lambda _: self.submit(), range(16)))
        self.assertEqual(len({job["id"] for job in jobs}), 1)
        self.assertEqual(self.store.meal("meal-1")["pendingJob"]["revision"], 1)
        with self.store.connection() as db:
            self.assertEqual(db.execute("SELECT count(*) FROM jobs").fetchone()[0], 1)

    def test_key_is_bound_to_payload_and_meal(self):
        self.submit()
        changed = request()
        changed["userInput"]["notes"] = "Different recipe"
        for kwargs in ({"payload": changed}, {"meal": "meal-2"}):
            with self.assertRaisesRegex(StoreError, "idempotency_conflict"):
                self.submit(**kwargs)
        self.assertEqual(self.store.meal("meal-1")["pendingJob"]["revision"], 1)

    def test_original_day_and_zone_are_immutable(self):
        self.submit()
        for key, value in (("localDate", "2026-10-30"), ("timeZone", "UTC"),
                           ("firstPhotoAddedAt", "2026-10-29T13:00:00+00:00")):
            changed = request()
            changed[key] = value
            with self.assertRaisesRegex(StoreError, "meal_date_is_immutable"):
                self.submit("correction", changed)

    def test_pending_failed_and_cancelled_revision_keep_previous_photo_and_result(self):
        first = self.accept()
        changed = request()
        changed["photos"][0]["id"] = "new-photo"
        second = self.submit("correction", changed)
        meal = self.store.meal("meal-1")
        self.assertEqual(meal["acceptedJob"]["id"], first["id"])
        self.assertEqual(meal["acceptedJob"]["photos"][0]["id"], "photo-1")
        claim = self.store.claim(3)
        self.store.finish(claim, error="provider_timeout")
        meal = self.store.meal("meal-1")
        self.assertEqual(meal["acceptedJob"]["result"]["dishName"], "first")
        self.assertEqual(meal["pendingJob"]["status"], "failed")
        self.assertEqual(self.store.photo(second["id"], "new-photo")["id"], "new-photo")
        self.store.cancel(second["id"])
        meal = self.store.meal("meal-1")
        self.assertIsNone(meal["pendingJob"])
        self.assertEqual(meal["acceptedJob"]["id"], first["id"])
        self.assertEqual(self.submit("correction", changed)["status"], "cancelled")

    def test_successful_non_food_replaces_old_result(self):
        self.accept()
        replacement = self.accept("correction", result={"outcome": "non_food"})
        meal = self.store.meal("meal-1")
        self.assertEqual(meal["acceptedJob"]["id"], replacement["id"])
        self.assertEqual(meal["acceptedJob"]["result"], {"outcome": "non_food"})
        self.assertIsNone(meal["pendingJob"])

    def test_newer_revision_fences_old_response(self):
        first = self.submit()
        old_claim = self.store.claim(3)
        second = self.submit("new-version")
        self.assertEqual(self.store.job(first["id"])["status"], "cancelled")
        self.assertFalse(self.store.finish(old_claim, result={"outcome": "food"}))
        self.assertEqual(self.store.meal("meal-1")["pendingJob"]["id"], second["id"])
        self.assertIsNone(self.store.meal("meal-1")["acceptedJob"])

    def test_restart_recovers_in_flight_work_with_new_attempt_fence(self):
        self.accept()
        second = self.submit("new-version")
        old_claim = self.store.claim(3)
        self.store = Store(self.path)
        self.store.recover()
        self.assertEqual(self.store.job(second["id"])["status"], "queued")
        new_claim = self.store.claim(3)
        self.assertEqual(new_claim["attempts"], 2)
        self.assertFalse(self.store.finish(old_claim, result={"outcome": "non_food"}))
        self.assertTrue(self.store.finish(new_claim, result={"outcome": "food"}))
        self.assertIsNone(self.store.claim(3))

    def test_attempt_budget_survives_repeated_crashes(self):
        job = self.submit()
        for _ in range(3):
            self.assertIsNotNone(self.store.claim(3))
            self.store.recover()
        self.assertIsNone(self.store.claim(3))
        self.assertEqual(self.store.job(job["id"])["status"], "failed")
        self.assertEqual(self.store.job(job["id"])["error"], "attempts_exhausted")

    def test_mock_mode_does_not_claim_paid_jobs_after_restart(self):
        paid = self.store.submit("meal-1", "paid", request(), "gemini", "gemini-3.8-flash")
        self.store.recover()
        self.assertIsNone(self.store.claim(3, "mock"))
        self.assertEqual(self.store.job(paid["id"])["status"], "queued")
        self.assertEqual(self.store.claim(3, "gemini")["id"], paid["id"])

    def test_retry_keeps_same_revision_and_persists_error_and_delay(self):
        job = self.submit()
        claim = self.store.claim(3)
        self.store.finish(claim, error="provider_rate_limited", retry=True)
        self.assertEqual(self.store.job(job["id"])["status"], "queued")
        self.assertIsNone(self.store.claim(3))
        with self.store.connection(write=True) as db:
            db.execute("UPDATE jobs SET available_at=0")
        claim = self.store.claim(3)
        self.assertEqual(claim["attempts"], 2)
        self.store.finish(claim, result={"outcome": "food"})
        self.assertEqual(self.store.job(job["id"])["revision"], 1)

    def test_delete_purges_all_snapshots_and_blocks_replay_and_late_result(self):
        first = self.accept()
        second = self.submit("correction")
        claim = self.store.claim(3)
        self.store.delete("meal-1")
        self.assertFalse(self.store.finish(claim, result={"outcome": "food"}))
        for action in (lambda: self.store.job(first["id"]), lambda: self.store.job(second["id"]),
                       lambda: self.store.photo(first["id"], "photo-1"), lambda: self.submit(),
                       lambda: self.submit("fresh-key")):
            with self.assertRaisesRegex(StoreError, "meal_deleted"):
                action()
        with self.store.connection() as db:
            rows = db.execute("SELECT request,result,error,attempt_token FROM jobs").fetchall()
            self.assertTrue(all(all(value is None for value in row) for row in rows))
        self.store.delete("meal-1")  # Idempotent deletion.


if __name__ == "__main__":
    unittest.main()
