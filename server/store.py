"""Single-machine durable analysis queue. Photos are stored with each revision."""

import hashlib
import json
import sqlite3
import time
import uuid
from contextlib import contextmanager
from pathlib import Path


class StoreError(Exception):
    def __init__(self, code, status=409):
        super().__init__(code)
        self.code = code
        self.status = status


class Store:
    def __init__(self, path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.executescript("""
                CREATE TABLE IF NOT EXISTS meals (
                    id TEXT PRIMARY KEY, first_photo_at TEXT NOT NULL,
                    local_date TEXT NOT NULL, time_zone TEXT NOT NULL,
                    revision INTEGER NOT NULL DEFAULT 0,
                    accepted_job_id TEXT, pending_job_id TEXT, deleted INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY, meal_id TEXT NOT NULL REFERENCES meals(id),
                    revision INTEGER NOT NULL, status TEXT NOT NULL,
                    provider TEXT NOT NULL, model TEXT NOT NULL,
                    request TEXT, result TEXT, error TEXT,
                    attempts INTEGER NOT NULL DEFAULT 0, attempt_token TEXT,
                    available_at REAL NOT NULL DEFAULT 0, created_at REAL NOT NULL,
                    UNIQUE(meal_id, revision)
                );
                CREATE INDEX IF NOT EXISTS jobs_queue ON jobs(status, available_at);
                CREATE TABLE IF NOT EXISTS requests (
                    key TEXT PRIMARY KEY, digest TEXT NOT NULL,
                    job_id TEXT NOT NULL REFERENCES jobs(id)
                );
            """)

    @contextmanager
    def connection(self, write=False):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        db.execute("PRAGMA secure_delete=ON")
        try:
            if write:
                db.execute("BEGIN IMMEDIATE")
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise
        finally:
            db.close()

    def submit(self, meal_id, key, request, provider, model):
        encoded = json.dumps(request, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        digest = hashlib.sha256((meal_id + "\n" + encoded).encode()).hexdigest()
        with self.connection(write=True) as db:
            meal = db.execute("SELECT * FROM meals WHERE id=?", (meal_id,)).fetchone()
            if meal and meal["deleted"]:
                raise StoreError("meal_deleted", 410)
            previous = db.execute("SELECT * FROM requests WHERE key=?", (key,)).fetchone()
            if previous:
                if previous["digest"] != digest:
                    raise StoreError("idempotency_conflict")
                return self._job(db, previous["job_id"])
            dates = (request["firstPhotoAddedAt"], request["localDate"], request["timeZone"])
            if meal:
                if dates != (meal["first_photo_at"], meal["local_date"], meal["time_zone"]):
                    raise StoreError("meal_date_is_immutable")
            else:
                db.execute("INSERT INTO meals(id,first_photo_at,local_date,time_zone) VALUES(?,?,?,?)",
                           (meal_id, *dates))
            # New input supersedes any outstanding attempt, retaining the accepted result.
            db.execute("UPDATE jobs SET status='cancelled',attempt_token=NULL "
                       "WHERE meal_id=? AND status IN ('queued','running')", (meal_id,))
            revision = (meal["revision"] if meal else 0) + 1
            job_id = str(uuid.uuid4())
            db.execute("INSERT INTO jobs(id,meal_id,revision,status,provider,model,request,created_at) "
                       "VALUES(?,?,?,'queued',?,?,?,?)",
                       (job_id, meal_id, revision, provider, model, encoded, time.time()))
            db.execute("INSERT INTO requests VALUES(?,?,?)", (key, digest, job_id))
            db.execute("UPDATE meals SET revision=?,pending_job_id=? WHERE id=?", (revision, job_id, meal_id))
            return self._job(db, job_id)

    def _job(self, db, job_id):
        row = db.execute("SELECT j.*,m.deleted FROM jobs j JOIN meals m ON m.id=j.meal_id "
                         "WHERE j.id=?", (job_id,)).fetchone()
        if not row:
            raise StoreError("job_not_found", 404)
        if row["deleted"]:
            raise StoreError("meal_deleted", 410)
        request = json.loads(row["request"])
        return {
            "id": row["id"], "mealId": row["meal_id"], "revision": row["revision"],
            "status": row["status"], "provider": row["provider"], "model": row["model"],
            "attempts": row["attempts"], "result": json.loads(row["result"]) if row["result"] else None,
            "error": row["error"], "userInput": request["userInput"],
            "photos": [{"id": photo["id"], "mimeType": photo["mimeType"],
                        "url": f"/v1/jobs/{job_id}/photos/{photo['id']}"} for photo in request["photos"]],
        }

    def job(self, job_id):
        with self.connection() as db:
            return self._job(db, job_id)

    def meal(self, meal_id):
        with self.connection() as db:
            row = db.execute("SELECT * FROM meals WHERE id=?", (meal_id,)).fetchone()
            if not row:
                raise StoreError("meal_not_found", 404)
            if row["deleted"]:
                raise StoreError("meal_deleted", 410)
            return {"id": row["id"], "firstPhotoAddedAt": row["first_photo_at"],
                    "localDate": row["local_date"], "timeZone": row["time_zone"],
                    "acceptedJob": self._job(db, row["accepted_job_id"]) if row["accepted_job_id"] else None,
                    "pendingJob": self._job(db, row["pending_job_id"]) if row["pending_job_id"] else None}

    def photo(self, job_id, photo_id):
        with self.connection() as db:
            self._job(db, job_id)
            request = json.loads(db.execute("SELECT request FROM jobs WHERE id=?", (job_id,)).fetchone()[0])
            for photo in request["photos"]:
                if photo["id"] == photo_id:
                    return photo
            raise StoreError("photo_not_found", 404)

    def cancel(self, job_id):
        with self.connection(write=True) as db:
            job = self._job(db, job_id)
            if job["status"] == "succeeded":
                raise StoreError("job_already_completed")
            db.execute("UPDATE jobs SET status='cancelled',attempt_token=NULL WHERE id=?", (job_id,))
            db.execute("UPDATE meals SET pending_job_id=NULL WHERE pending_job_id=?", (job_id,))
            return self._job(db, job_id)

    def delete(self, meal_id):
        with self.connection(write=True) as db:
            if not db.execute("SELECT id FROM meals WHERE id=?", (meal_id,)).fetchone():
                raise StoreError("meal_not_found", 404)
            db.execute("UPDATE meals SET deleted=1,accepted_job_id=NULL,pending_job_id=NULL WHERE id=?", (meal_id,))
            db.execute("UPDATE jobs SET status='cancelled',request=NULL,result=NULL,error=NULL,attempt_token=NULL "
                       "WHERE meal_id=?", (meal_id,))
        with self.connection() as db:
            db.execute("PRAGMA wal_checkpoint(TRUNCATE)")

    def recover(self):
        # Called only after acquiring the exclusive process lock.
        with self.connection(write=True) as db:
            db.execute("UPDATE jobs SET status='queued',attempt_token=NULL WHERE status='running'")

    def claim(self, max_attempts, provider=None):
        with self.connection(write=True) as db:
            db.execute("UPDATE jobs SET status='failed',error='attempts_exhausted' "
                       "WHERE status='queued' AND attempts>=? AND (? IS NULL OR provider=?)",
                       (max_attempts, provider, provider))
            row = db.execute("SELECT * FROM jobs WHERE status='queued' AND available_at<=? "
                             "AND (? IS NULL OR provider=?) ORDER BY created_at LIMIT 1",
                             (time.time(), provider, provider)).fetchone()
            if not row:
                return None
            token = str(uuid.uuid4())
            db.execute("UPDATE jobs SET status='running',attempts=attempts+1,attempt_token=?,error=NULL "
                       "WHERE id=?", (token, row["id"]))
            return {"id": row["id"], "token": token, "attempts": row["attempts"] + 1,
                    "provider": row["provider"], "model": row["model"], "request": json.loads(row["request"])}

    def finish(self, claim, *, result=None, error=None, retry=False):
        with self.connection(write=True) as db:
            row = db.execute("SELECT j.*,m.pending_job_id,m.deleted FROM jobs j JOIN meals m "
                             "ON m.id=j.meal_id WHERE j.id=?", (claim["id"],)).fetchone()
            if (not row or row["deleted"] or row["status"] != "running"
                    or row["attempt_token"] != claim["token"] or row["pending_job_id"] != claim["id"]):
                return False
            if result is not None:
                db.execute("UPDATE jobs SET status='succeeded',result=?,error=NULL,attempt_token=NULL WHERE id=?",
                           (json.dumps(result, ensure_ascii=False), claim["id"]))
                db.execute("UPDATE meals SET accepted_job_id=?,pending_job_id=NULL WHERE id=?",
                           (claim["id"], row["meal_id"]))
            else:
                db.execute("UPDATE jobs SET status=?,error=?,attempt_token=NULL,available_at=? WHERE id=?",
                           ("queued" if retry else "failed", error, time.time() + 2 ** claim["attempts"], claim["id"]))
            return True
