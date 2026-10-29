"""Local development API: python3 -m server.app. No third-party dependencies."""

import argparse
import base64
import binascii
import fcntl
import json
import os
import re
import signal
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from .analyzer import AnalysisError, analyze
from .store import Store, StoreError

# Leave room for the prompt/schema within Gemini's 20 MB inline-request limit.
MAX_BODY = 18 * 1024 * 1024
MAX_PHOTO = 3 * 1024 * 1024
MAX_ATTEMPTS = 3
IDENTIFIER = re.compile(r"[A-Za-z0-9_-]{1,80}\Z")


def validate_request(data):
    required = {"firstPhotoAddedAt", "localDate", "timeZone", "photos"}
    if not isinstance(data, dict) or not required <= data.keys() or data.keys() - required - {"userInput"}:
        raise StoreError("invalid_request_fields", 400)
    if any(not isinstance(data[key], str) for key in required - {"photos"}):
        raise StoreError("invalid_date", 400)
    try:
        added = datetime.fromisoformat(data["firstPhotoAddedAt"].replace("Z", "+00:00"))
        zone = ZoneInfo(data["timeZone"])
        if added.tzinfo is None or added.astimezone(zone).date().isoformat() != data["localDate"]:
            raise ValueError()
    except (ValueError, ZoneInfoNotFoundError, OverflowError):
        raise StoreError("invalid_date", 400) from None
    photos = data["photos"]
    if not isinstance(photos, list) or not 1 <= len(photos) <= 6:
        raise StoreError("expected_one_to_six_photos", 400)
    seen = set()
    for photo in photos:
        if not isinstance(photo, dict) or set(photo) != {"id", "mimeType", "dataBase64"}:
            raise StoreError("invalid_photo_fields", 400)
        if not isinstance(photo["id"], str) or not IDENTIFIER.fullmatch(photo["id"]) or photo["id"] in seen:
            raise StoreError("invalid_photo_id", 400)
        seen.add(photo["id"])
        if not isinstance(photo["dataBase64"], str) or len(photo["dataBase64"]) > ((MAX_PHOTO + 2) // 3) * 4:
            raise StoreError("photo_too_large", 413)
        try:
            raw = base64.b64decode(photo["dataBase64"], validate=True)
        except (binascii.Error, ValueError):
            raise StoreError("invalid_photo_encoding", 400) from None
        if len(raw) > MAX_PHOTO:
            raise StoreError("photo_too_large", 413)
        mime = photo["mimeType"]
        valid = ((mime == "image/jpeg" and raw.startswith(b"\xff\xd8\xff"))
                 or (mime == "image/png" and raw.startswith(b"\x89PNG\r\n\x1a\n"))
                 or (mime == "image/webp" and raw.startswith(b"RIFF") and raw[8:12] == b"WEBP"))
        if not valid:
            raise StoreError("unsupported_or_invalid_image", 400)
    user_input = data.get("userInput", {})
    limits = {"dishName": 160, "notes": 2000, "portion": 120}
    if not isinstance(user_input, dict) or user_input.keys() - limits.keys():
        raise StoreError("invalid_user_input", 400)
    if any(not isinstance(value, str) or len(value) > limits[key] for key, value in user_input.items()):
        raise StoreError("invalid_user_input", 400)
    return {**data, "firstPhotoAddedAt": added.astimezone(timezone.utc).isoformat(),
            "userInput": {key: user_input.get(key, "").strip() for key in limits}}


class Worker(threading.Thread):
    def __init__(self, store, *, provider="mock", api_key=None, analyzer=analyze, timeout=30):
        super().__init__(name="chewy-analysis", daemon=True)
        self.store, self.api_key, self.analyzer, self.timeout = store, api_key, analyzer, timeout
        self.provider = provider
        self.stopped = threading.Event()
        self.wake = threading.Event()

    def run(self):
        while not self.stopped.is_set():
            try:
                claim = self.store.claim(MAX_ATTEMPTS, self.provider)
            except Exception:
                print("Queue storage error; retrying.", flush=True)
                self.stopped.wait(1)
                continue
            if not claim:
                self.wake.wait(0.5)
                self.wake.clear()
                continue
            try:
                result = self.analyzer(claim["request"], provider=claim["provider"],
                                       api_key=self.api_key, model=claim["model"], timeout=self.timeout)
                completion = {"result": result}
            except AnalysisError as error:
                completion = {"error": error.code,
                              "retry": error.retryable and claim["attempts"] < MAX_ATTEMPTS}
            except Exception:
                completion = {"error": "internal_analysis_error"}
            # Retain the outcome through transient storage errors. Never repeat the
            # paid provider request just because saving its result failed.
            while True:
                try:
                    self.store.finish(claim, **completion)
                    break
                except Exception:
                    print("Cannot save analysis outcome; retrying storage.", flush=True)
                    if self.stopped.wait(1):
                        return

    def stop(self):
        self.stopped.set()
        self.wake.set()


def make_server(store, *, port=8787, provider="mock", model="gemini-3.8-flash", worker=None):
    if provider == "mock":
        model = "mock-no-recognition-v1"

    class Handler(BaseHTTPRequestHandler):
        server_version = "ChewyLocal/1"

        def setup(self):
            super().setup()
            self.connection.settimeout(20)

        def log_message(self, *_args):
            pass

        def reply(self, status, body, content_type="application/json; charset=utf-8"):
            raw = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Connection", "close")
            origin = self.headers.get("Origin")
            if origin and self.allowed_origin(origin):
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
                self.send_header("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type,Idempotency-Key")
            self.end_headers()
            self.close_connection = True
            self.wfile.write(raw)

        @staticmethod
        def allowed_origin(origin):
            try:
                parsed = urlsplit(origin)
                return parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1"}
            except ValueError:
                return False

        def dispatch(self):
            try:
                try:
                    host = urlsplit("http://" + self.headers.get("Host", "")).hostname
                except ValueError:
                    host = None
                if host not in {"localhost", "127.0.0.1"}:
                    raise StoreError("invalid_host", 403)
                if self.headers.get("Origin") and not self.allowed_origin(self.headers["Origin"]):
                    raise StoreError("origin_not_allowed", 403)
                if self.command == "OPTIONS":
                    return self.reply(200, {})
                path = urlsplit(self.path).path
                if self.command == "GET" and path in {"/", "/health"}:
                    return self.reply(200, {"status": "ok", "service": "chewy-local", "provider": provider})
                meal_match = re.fullmatch(r"/v1/meals/([A-Za-z0-9_-]{1,80})(/analyses)?", path)
                job_match = re.fullmatch(r"/v1/jobs/([A-Za-z0-9_-]{1,80})(/cancel)?", path)
                photo_match = re.fullmatch(r"/v1/jobs/([A-Za-z0-9_-]{1,80})/photos/([A-Za-z0-9_-]{1,80})", path)
                if self.command == "GET" and photo_match:
                    photo = store.photo(*photo_match.groups())
                    return self.reply(200, base64.b64decode(photo["dataBase64"]), photo["mimeType"])
                if meal_match:
                    meal_id, suffix = meal_match.groups()
                    if self.command == "GET" and not suffix:
                        return self.reply(200, store.meal(meal_id))
                    if self.command == "DELETE" and not suffix:
                        store.delete(meal_id)
                        return self.reply(200, {"deleted": True, "mealId": meal_id})
                    if self.command == "POST" and suffix:
                        key = self.headers.get("Idempotency-Key", "")
                        if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", key):
                            raise StoreError("invalid_idempotency_key", 400)
                        data = validate_request(self.read_json())
                        job = store.submit(meal_id, key, data, provider, model)
                        if worker:
                            worker.wake.set()
                        return self.reply(202, job)
                if job_match:
                    job_id, suffix = job_match.groups()
                    if self.command == "GET" and not suffix:
                        return self.reply(200, store.job(job_id))
                    if self.command == "POST" and suffix:
                        return self.reply(200, store.cancel(job_id))
                raise StoreError("route_not_found", 404)
            except StoreError as error:
                self.reply(error.status, {"error": {"code": error.code, "message": error.code}})
            except (BrokenPipeError, ConnectionResetError, TimeoutError):
                pass
            except Exception:
                self.reply(500, {"error": {"code": "internal_error", "message": "Request failed"}})

        def read_json(self):
            if self.headers.get_content_type() != "application/json":
                raise StoreError("expected_application_json", 415)
            if self.headers.get("Transfer-Encoding") or len(self.headers.get_all("Content-Length", [])) != 1:
                raise StoreError("expected_content_length", 400)
            try:
                size = int(self.headers["Content-Length"])
            except ValueError:
                raise StoreError("invalid_content_length", 400) from None
            if not 0 < size <= MAX_BODY:
                raise StoreError("request_too_large", 413)
            raw = self.rfile.read(size)
            if len(raw) != size:
                raise StoreError("incomplete_body", 400)
            try:
                return json.loads(raw)
            except (ValueError, UnicodeDecodeError):
                raise StoreError("invalid_json", 400) from None

        do_GET = dispatch
        do_POST = dispatch
        do_DELETE = dispatch
        do_OPTIONS = dispatch

    return ThreadingHTTPServer(("127.0.0.1", port), Handler)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8787)
    parser.add_argument("--data-dir", type=Path, default=Path(__file__).resolve().parent / ".data")
    parser.add_argument("--provider", choices=["mock", "gemini"], default="mock")
    parser.add_argument("--model", default=os.environ.get("GEMINI_MODEL", "gemini-3.8-flash"))
    args = parser.parse_args()
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if args.provider == "gemini" and not api_key:
        parser.error("GEMINI_API_KEY is required for --provider gemini")
    os.umask(0o077)
    args.data_dir.mkdir(parents=True, exist_ok=True)
    lock = (args.data_dir / "server.lock").open("a")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        parser.error("Another server is using this data directory")
    store = Store(args.data_dir / "chewy.sqlite3")
    # Bind before recovering jobs so a port conflict cannot change persisted state.
    try:
        server = make_server(store, port=args.port, provider=args.provider, model=args.model)
    except OSError:
        parser.error("Cannot listen on the requested local port")
    store.recover()
    worker = Worker(store, provider=args.provider, api_key=api_key)
    worker.start()
    def stop(_signum, _frame):
        raise KeyboardInterrupt
    signal.signal(signal.SIGTERM, stop)
    print(f"Chewy local API: http://127.0.0.1:{server.server_port} (provider={args.provider})", flush=True)
    try:
        server.serve_forever(poll_interval=0.25)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        worker.stop()
        worker.join(timeout=35)
        lock.close()


if __name__ == "__main__":
    main()
