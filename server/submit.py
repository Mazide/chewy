#!/usr/bin/env python3
"""Submit a complete meal photo set to the local development server."""

import argparse
import base64
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit
from urllib.request import Request, urlopen
from uuid import uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


MAX_PHOTOS = 6
MAX_PHOTO_BYTES = 3 * 1024 * 1024
MAX_REQUEST_BYTES = 18 * 1024 * 1024
TERMINAL_STATUSES = {"succeeded", "failed", "cancelled"}


class ClientError(Exception):
    pass


class APIError(ClientError):
    def __init__(self, status, message):
        self.status = status
        super().__init__(f"HTTP {status}: {message}")


def api_request(base_url, path, *, payload=None, idempotency_key=None, timeout=30):
    headers = {"Accept": "application/json"}
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        if len(data) > MAX_REQUEST_BYTES:
            raise ClientError("Combined request exceeds 18 MiB; resize the photos before submitting.")
        headers["Content-Type"] = "application/json"
    if idempotency_key is not None:
        headers["Idempotency-Key"] = idempotency_key
    request = Request(base_url + path, data=data, headers=headers)
    try:
        with urlopen(request, timeout=timeout) as response:
            result = json.load(response)
    except HTTPError as error:
        try:
            body = json.load(error)
            message = body["error"]["message"]
            if not isinstance(message, str):
                message = error.reason
        except (ValueError, KeyError, TypeError):
            message = error.reason
        raise APIError(error.code, message) from error
    except (URLError, TimeoutError, OSError) as error:
        raise ClientError(f"Cannot reach the server: {error}") from error
    except ValueError as error:
        raise ClientError("Server returned invalid JSON.") from error
    if not isinstance(result, dict):
        raise ClientError("Server returned an unexpected response.")
    return result


def read_photo(path):
    try:
        with path.open("rb") as source:
            data = source.read(MAX_PHOTO_BYTES + 1)
    except OSError as error:
        raise ClientError(f"Cannot read {path}: {error.strerror}") from error
    if len(data) > MAX_PHOTO_BYTES:
        raise ClientError(f"{path}: image exceeds 3 MiB; resize it before submitting.")
    if data.startswith(b"\xff\xd8\xff"):
        mime_type = "image/jpeg"
    elif data.startswith(b"\x89PNG\r\n\x1a\n"):
        mime_type = "image/png"
    elif data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        mime_type = "image/webp"
    else:
        raise ClientError(f"{path}: expected a JPEG, PNG, or WebP image.")
    return {
        # Stable IDs make retrying the same photo set produce the same payload.
        "id": hashlib.sha256(data).hexdigest(),
        "mimeType": mime_type,
        "dataBase64": base64.b64encode(data).decode("ascii"),
    }


def meal_metadata(base_url, meal_id, time_zone, first_added_at):
    if meal_id:
        try:
            meal = api_request(base_url, f"/v1/meals/{quote(meal_id, safe='')}")
        except APIError as error:
            if error.status != 404:
                raise
        else:
            try:
                return {key: meal[key] for key in (
                    "firstPhotoAddedAt", "localDate", "timeZone"
                )}
            except KeyError as error:
                raise ClientError("Server returned incomplete meal time metadata.") from error
    try:
        zone = timezone.utc if time_zone == "UTC" else ZoneInfo(time_zone)
    except (ZoneInfoNotFoundError, ValueError) as error:
        raise ClientError(f"Unknown IANA time zone: {time_zone}") from error
    local_time = first_added_at.astimezone(zone)
    return {
        "firstPhotoAddedAt": local_time.isoformat(),
        "localDate": local_time.date().isoformat(),
        "timeZone": time_zone,
    }


def wait_for_job(base_url, job, timeout):
    deadline = time.monotonic() + timeout
    while job.get("status") not in TERMINAL_STATUSES:
        if job.get("status") not in {"queued", "running"} or not job.get("id"):
            raise ClientError("Server returned an invalid job status or ID.")
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise ClientError(
                f"Timed out waiting for job {job['id']}; it may still complete. "
                "The submitted meal was not cancelled."
            )
        time.sleep(min(1, remaining))
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            continue
        job = api_request(
            base_url, f"/v1/jobs/{quote(job['id'], safe='')}",
            timeout=min(30, remaining),
        )
    return job


def positive_seconds(value):
    try:
        seconds = float(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("must be a positive number of seconds") from error
    if not math.isfinite(seconds) or seconds <= 0:
        raise argparse.ArgumentTypeError("must be a positive number of seconds")
    return seconds


def make_parser():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "images", metavar="IMAGE", nargs="+", type=Path,
        help="complete current photo set; include prior photos when correcting a meal",
    )
    parser.add_argument("--name", default="", help="user-supplied dish name")
    parser.add_argument("--notes", default="", help="user-supplied ingredients or correction")
    parser.add_argument("--portion", default="", help="free-text description of the portion eaten")
    parser.add_argument("--meal-id", help="reuse a meal ID for a correction or request retry")
    parser.add_argument("--idempotency-key", help="reuse with an unchanged request after a network error")
    parser.add_argument("--base-url", default="http://127.0.0.1:8787")
    parser.add_argument(
        "--time-zone", default="UTC",
        help="IANA zone for a new meal, e.g. Europe/London (default: UTC); existing meals keep their zone",
    )
    parser.add_argument("--wait", action="store_true", help="poll until the job finishes")
    parser.add_argument(
        "--timeout", type=positive_seconds, default=120,
        help="maximum polling duration in seconds with --wait (default: 120)",
    )
    return parser


def main(argv=None):
    parser = make_parser()
    args = parser.parse_args(argv)
    if len(args.images) > MAX_PHOTOS:
        parser.error("at most 6 images can be submitted together")
    for field, limit in (("name", 160), ("notes", 2000), ("portion", 120)):
        if len(getattr(args, field)) > limit:
            parser.error(f"--{field} must be at most {limit} characters")
    if args.meal_id is not None and not re.fullmatch(r"[A-Za-z0-9_-]{1,80}", args.meal_id):
        parser.error("--meal-id must use 1–80 letters, digits, underscores, or hyphens")
    if args.idempotency_key is not None and not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", args.idempotency_key):
        parser.error("--idempotency-key must use 1–128 letters, digits, underscores, or hyphens")
    parsed_url = urlsplit(args.base_url)
    if (parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc
            or parsed_url.username or parsed_url.password or parsed_url.query or parsed_url.fragment):
        parser.error("--base-url must be an HTTP(S) URL without credentials, query, or fragment")
    base_url = args.base_url.rstrip("/")
    try:
        # CLI invocation is when photos are added; capture time never comes from EXIF.
        first_added_at = datetime.now(timezone.utc)
        photos = [read_photo(path) for path in args.images]
        if len({photo["id"] for photo in photos}) != len(photos):
            raise ClientError("The same image was supplied more than once.")
        metadata = meal_metadata(base_url, args.meal_id, args.time_zone, first_added_at)
        meal_id = args.meal_id or str(uuid4())
        idempotency_key = args.idempotency_key or str(uuid4())
        payload = {
            **metadata,
            "photos": photos,
            "userInput": {"dishName": args.name, "notes": args.notes, "portion": args.portion},
        }
        print(f"meal-id: {meal_id}\nidempotency-key: {idempotency_key}", file=sys.stderr)
        job = api_request(
            base_url, f"/v1/meals/{quote(meal_id, safe='')}/analyses",
            payload=payload, idempotency_key=idempotency_key,
        )
        if args.wait:
            job = wait_for_job(base_url, job, args.timeout)
        print(json.dumps(job, indent=2, ensure_ascii=False))
        if job.get("status") in {"failed", "cancelled"}:
            print(f"Analysis {job['status']}.", file=sys.stderr)
            return 1
        return 0
    except (ClientError, ValueError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("Stopped waiting; any submitted job may still complete.", file=sys.stderr)
        return 130


if __name__ == "__main__":
    sys.exit(main())
