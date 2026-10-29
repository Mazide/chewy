"""Explicit, single-submit Runway video drafts. No background polling or retries.

API/prices checked 2026-10-29 against docs.dev.runwayml.com:
guides/using-the-api, guides/pricing, assets/inputs, assets/outputs and api.
"""

from __future__ import annotations

import base64
from datetime import datetime, timezone
import hashlib
import io
import ipaddress
import json
import math
import os
from pathlib import Path
import re
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
import uuid
import warnings

from PIL import Image


API_BASE = "https://api.dev.runwayml.com"
API_VERSION = "2024-11-06"
DURATION = 5
MAX_DATA_URI_BYTES = 5 * 1024 * 1024
MAX_VIDEO_BYTES = 100 * 1024 * 1024
ACTIVE_STATUSES = {"SUBMITTING", "UNKNOWN", "PENDING", "THROTTLED", "RUNNING"}
REMOTE_STATUSES = {"PENDING", "THROTTLED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELED"}
MODELS = {
    "gen4.5": {"id": "gen4.5", "label": "Gen-4.5", "estimatedCostUsd": 0.60, "credits": 60, "promptLimit": 1000,
               "minimumSide": 64, "inputAspectRange": (0.5, 2)},
    "kling3.0_standard": {"id": "kling3.0_standard", "label": "Kling 3.0 Standard · без звука", "estimatedCostUsd": 0.45, "credits": 45, "promptLimit": 2500,
                         "minimumSide": 300, "inputAspectRange": (0.4, 2.5)},
}
ID_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]{0,95}\Z")


class RunwayError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


class ProviderError(Exception):
    """Only a status code crosses the transport boundary, never a response or key."""
    def __init__(self, status: int | None = None):
        super().__init__("Runway transport failed")
        self.status = status


class NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, newurl):
        return None


def timestamp() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")


def valid_id(value: object) -> str:
    if not isinstance(value, str) or not ID_PATTERN.fullmatch(value):
        raise RunwayError("Некорректный идентификатор.")
    return value


def atomic_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".pending-", dir=path.parent)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)


def read_object(path: Path) -> dict:
    try:
        value = json.loads(path.read_text("utf-8"))
    except FileNotFoundError:
        raise RunwayError("Запись Runway не найдена.", 404) from None
    except (OSError, ValueError, UnicodeError):
        raise RunwayError("Не удалось прочитать локальную запись Runway.", 500) from None
    if not isinstance(value, dict):
        raise RunwayError("Некорректная локальная запись Runway.", 500)
    return value


def safe_download_url(value: object) -> str:
    if not isinstance(value, str) or len(value) > 16000 or any(ord(char) < 32 for char in value):
        raise ProviderError()
    try:
        parsed = urlsplit(value)
        host = parsed.hostname or ""
        if (parsed.scheme != "https" or parsed.username or parsed.password or parsed.port not in (None, 443)
                or not host or "." not in host or host.endswith((".localhost", ".local", ".internal"))):
            raise ProviderError()
        try:
            ipaddress.ip_address(host)
        except ValueError:
            pass
        else:
            raise ProviderError()
    except ValueError:
        raise ProviderError() from None
    return value


class RunwayClient:
    """Mockable urllib adapter. Every method performs exactly one HTTP request."""
    def __init__(self):
        self.opener = build_opener(NoRedirects())

    def request(self, method: str, path: str, key: str, payload: dict | None = None) -> dict:
        if not path.startswith("/v1/"):
            raise ProviderError()
        headers = {"Authorization": "Bearer " + key, "X-Runway-Version": API_VERSION,
                   "Accept": "application/json", "User-Agent": "ChewyContentPipeline/1"}
        data = None
        if payload is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(payload).encode("utf-8")
        try:
            with self.opener.open(Request(API_BASE + path, data=data, headers=headers, method=method), timeout=20) as response:
                raw = response.read(1024 * 1024 + 1)
                if len(raw) > 1024 * 1024:
                    raise ProviderError()
                result = json.loads(raw)
                if not isinstance(result, dict):
                    raise ProviderError()
                return result
        except HTTPError as exc:
            status = exc.code
            exc.close()
            raise ProviderError(status) from None
        except (OSError, ValueError, URLError):
            raise ProviderError() from None

    def download(self, url: str) -> bytes:
        # Output URLs come only from the authenticated task response. No API key
        # is sent to their CDN, and redirects cannot forward credentials.
        url = safe_download_url(url)
        try:
            with self.opener.open(Request(url, headers={"User-Agent": "ChewyContentPipeline/1"}), timeout=30) as response:
                content_type = response.headers.get_content_type()
                if content_type not in ("video/mp4", "application/octet-stream"):
                    raise ProviderError()
                length = response.headers.get("Content-Length")
                if length is not None and (not length.isdigit() or int(length) > MAX_VIDEO_BYTES):
                    raise ProviderError()
                chunks, total = [], 0
                while True:
                    chunk = response.read(min(1024 * 1024, MAX_VIDEO_BYTES + 1 - total))
                    if not chunk:
                        break
                    chunks.append(chunk)
                    total += len(chunk)
                    if total > MAX_VIDEO_BYTES:
                        raise ProviderError()
                data = b"".join(chunks)
                if length is not None and len(data) != int(length):
                    raise ProviderError()
        except HTTPError as exc:
            status = exc.code
            exc.close()
            raise ProviderError(status) from None
        except (OSError, ValueError, URLError):
            raise ProviderError() from None
        if len(data) < 16 or data[4:8] != b"ftyp" or not 8 <= int.from_bytes(data[:4], "big") <= len(data):
            raise ProviderError()
        return data


class Runway:
    def __init__(self, pipeline, client=None):
        self.pipeline = pipeline
        self.client = client or RunwayClient()

    def _key(self) -> tuple[str | None, str | None]:
        path = self.pipeline._path("private", "runway.json")
        if path.is_file():
            key = read_object(path).get("apiKey")
            return self._validate_key(key), "local"
        key = os.environ.get("RUNWAYML_API_SECRET")
        return (self._validate_key(key), "environment") if key else (None, None)

    @staticmethod
    def _validate_key(value: object) -> str:
        if not isinstance(value, str) or not 8 <= len(value) <= 2048 or any(not 33 <= ord(char) <= 126 for char in value):
            raise RunwayError("Нужен API-ключ Runway без пробелов и переносов строки.")
        return value

    def status(self) -> dict:
        key, source = self._key()
        return {"configured": bool(key), "source": source, "duration": DURATION,
                "models": [{field: model[field] for field in ("id", "label", "estimatedCostUsd")} for model in MODELS.values()]}

    def save_key(self, key: object) -> dict:
        key = self._validate_key(key)
        with self.pipeline.lock:
            private = self.pipeline._path("private")
            private.mkdir(parents=True, exist_ok=True)
            private.chmod(0o700)
            atomic_json(self.pipeline._path("private", "runway.json"), {"apiKey": key})
            return self.status()

    def _record_path(self, generation_id: str) -> Path:
        return self.pipeline._path("runway", "generations", valid_id(generation_id), "generation.json")

    def _records(self) -> list[dict]:
        return [read_object(path) for path in self.pipeline._path("runway", "generations").glob("*/generation.json")]

    @staticmethod
    def _public(record: dict) -> dict:
        fields = ("id", "jobId", "packetId", "referenceId", "model", "status", "estimatedCostUsd", "createdAt", "updatedAt",
                  "taskId", "videoUrl", "downloadUrl", "error", "ratio", "duration", "kind", "nativeReady")
        public = {field: record[field] for field in fields if field in record}
        if public.get("status") == "SUBMITTING":
            public["status"] = "UNKNOWN"
            public["error"] = "Отправка не получила подтверждения. Проверьте Runway; повторный платный запрос заблокирован."
        return public

    def generations(self, packet_id: str | None = None) -> dict:
        if packet_id is not None:
            valid_id(packet_id)
            self.pipeline.request(packet_id)
        with self.pipeline.lock:
            records = sorted(self._records(), key=lambda item: item["createdAt"])
            return {"generations": [self._public(record) for record in records if packet_id is None or record["packetId"] == packet_id]}

    def _input(self, job_id: str, packet_id: str, reference_id: str, model_id: str) -> tuple[dict, dict, str]:
        self.pipeline.job(valid_id(job_id))
        request = self.pipeline.request(valid_id(packet_id))
        if request["jobId"] != job_id or request["job"].get("kind") != "animation":
            raise RunwayError("Для видео нужен сохранённый запрос задания анимации.")
        if not isinstance(model_id, str) or model_id not in MODELS:
            raise RunwayError("Выберите поддерживаемую модель Runway.")
        prompt = request.get("prompt")
        limit = MODELS[model_id]["promptLimit"]
        try:
            prompt_length = len(prompt.encode("utf-16-le")) // 2 if isinstance(prompt, str) else 0
        except UnicodeError:
            prompt_length = 0
        if not isinstance(prompt, str) or not prompt.strip() or not 2 <= prompt_length <= limit:
            raise RunwayError(f"Промпт для этой модели должен содержать от 2 до {limit} символов UTF-16. Создайте новый запрос с исправленным промптом.")
        path, _ = self.pipeline.request_reference(packet_id, valid_id(reference_id))
        data = path.read_bytes()
        # A stricter raw-byte precheck keeps the encoded URI below the API's 5 MiB cap.
        if not data or ((len(data) + 2) // 3) * 4 + 32 > MAX_DATA_URI_BYTES:
            raise RunwayError("Референс слишком большой для Runway Data URI (максимум 5 MiB после base64).", 413)
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(io.BytesIO(data)) as image:
                    if image.format not in ("PNG", "JPEG", "WEBP") or getattr(image, "n_frames", 1) != 1:
                        raise RunwayError("Нужен статичный референс PNG, JPEG или WebP.")
                    width, height = image.size
                    minimum_side = MODELS[model_id]["minimumSide"]
                    if width * height > 24_000_000 or max(width, height) > 8192 or min(width, height) < minimum_side:
                        raise RunwayError(f"Референс для этой модели должен быть от {minimum_side} px по стороне, до 8192 px и 24 млн пикселей.")
                    minimum_ratio, maximum_ratio = MODELS[model_id]["inputAspectRange"]
                    if not minimum_ratio <= width / height <= maximum_ratio:
                        raise RunwayError(f"Пропорция референса (ширина ÷ высота) для этой модели должна быть от {minimum_ratio} до {maximum_ratio}. Нужен другой референс.")
                    media_type = {"PNG": "image/png", "JPEG": "image/jpeg", "WEBP": "image/webp"}[image.format]
                    image.verify()
                with Image.open(io.BytesIO(data)) as image:
                    image.load()
                    if not image.convert("RGBA").getchannel("A").getbbox():
                        raise RunwayError("Референс полностью прозрачен.")
        except (OSError, ValueError, SyntaxError, Image.DecompressionBombError, Image.DecompressionBombWarning):
            raise RunwayError("Не удалось проверить изображение референса.") from None
        ratios = (("1280:720", 1280 / 720), ("720:1280", 720 / 1280), ("960:960", 1))
        ratio = min(ratios, key=lambda item: abs(math.log((width / height) / item[1])))[0]
        payload = {"model": model_id, "promptText": prompt, "promptImage": f"data:{media_type};base64," + base64.b64encode(data).decode("ascii"),
                   "ratio": ratio, "duration": DURATION}
        if model_id == "kling3.0_standard":
            payload["audio"] = False
        return request, payload, hashlib.sha256(data).hexdigest()

    @staticmethod
    def _provider_error(status: int | None, *, preflight: bool = False) -> str:
        if status in (401, 403):
            return "Runway не принял API-ключ или не разрешил доступ. Проверьте ключ в Runway Dev."
        if status == 402:
            return "Недостаточно API-кредитов Runway Dev. Подписка Runway и баланс API могут быть отдельными."
        if status == 429:
            return "Runway ограничил частоту запросов. Автоматического повтора нет."
        return "Не удалось проверить доступ к Runway. Генерация не отправлена." if preflight else "Runway не подтвердил создание задачи. Проверьте Runway перед новым запуском."

    def generate(self, job_id: str, packet_id: str, reference_id: str, model_id: str, client_request_id: str) -> dict:
        valid_id(client_request_id)
        with self.pipeline.lock:
            request, payload, reference_sha = self._input(job_id, packet_id, reference_id, model_id)
            records = self._records()
            for record in records:
                if record.get("clientRequestId") == client_request_id:
                    if (record["jobId"], record["packetId"], record["referenceId"], record["model"]) != (job_id, packet_id, reference_id, model_id):
                        raise RunwayError("Этот clientRequestId уже относится к другому запуску.", 409)
                    return {"generation": self._public(record)}
            if any(record["packetId"] == packet_id and record["status"] in ACTIVE_STATUSES for record in records):
                raise RunwayError("Для этого запроса уже есть активная или неподтверждённая задача Runway. Обновите её статус.", 409)
            key, _ = self._key()
            if not key:
                raise RunwayError("Сначала сохраните API-ключ Runway Dev.", 409)
            try:
                organization = self.client.request("GET", "/v1/organization", key)
                balance = organization.get("creditBalance")
                if isinstance(balance, (int, float)) and not isinstance(balance, bool) and math.isfinite(balance) and balance < MODELS[model_id]["credits"]:
                    raise RunwayError("Недостаточно API-кредитов Runway Dev для выбранного пятисекундного видео.", 409)
            except ProviderError as exc:
                # Older API deployments may lack the read-only organization endpoint.
                if exc.status not in (404, 405):
                    raise RunwayError(self._provider_error(exc.status, preflight=True), 409) from None
            generation_id = "v-" + uuid.uuid4().hex
            created = timestamp()
            record = {"id": generation_id, "jobId": job_id, "packetId": packet_id, "referenceId": reference_id,
                      "referenceSha256": reference_sha, "model": model_id, "clientRequestId": client_request_id,
                      "status": "SUBMITTING", "estimatedCostUsd": MODELS[model_id]["estimatedCostUsd"],
                      "createdAt": created, "updatedAt": created, "duration": DURATION, "ratio": payload["ratio"],
                      "kind": "video-draft", "nativeReady": False}
            path = self._record_path(generation_id)
            atomic_json(path, record)  # Durable before the only paid call; never auto-resubmit.
            try:
                response = self.client.request("POST", "/v1/image_to_video", key, payload)
                task_id = str(uuid.UUID(response.get("id", "")))
                record.update(taskId=task_id, status="PENDING")
            except ProviderError as exc:
                record["status"] = "FAILED" if exc.status is not None and 400 <= exc.status < 500 and exc.status != 408 else "UNKNOWN"
                record["error"] = self._provider_error(exc.status)
            except (ValueError, TypeError, AttributeError):
                record["status"] = "UNKNOWN"
                record["error"] = self._provider_error(None)
            record["updatedAt"] = timestamp()
            atomic_json(path, record)
            return {"generation": self._public(record)}

    def refresh(self, generation_id: str) -> dict:
        with self.pipeline.lock:
            path = self._record_path(generation_id)
            record = read_object(path)
            if not record.get("taskId") or record["status"] in ("FAILED", "CANCELED") or record.get("videoUrl"):
                return {"generation": self._public(record)}
            if time.time() - record.get("lastRefreshEpoch", 0) < 5:
                return {"generation": self._public(record)}
            key, _ = self._key()
            if not key:
                raise RunwayError("Для проверки статуса нужен API-ключ Runway Dev.", 409)
            record["lastRefreshEpoch"] = time.time()
            try:
                response = self.client.request("GET", "/v1/tasks/" + str(uuid.UUID(record["taskId"])), key)
                status = response.get("status")
                if status not in REMOTE_STATUSES:
                    raise ProviderError()
                record["status"] = status
                record.pop("error", None)
                if status in ("FAILED", "CANCELED"):
                    record["error"] = "Runway завершил задачу без видео. Автоматического повтора генерации нет."
                elif status == "SUCCEEDED":
                    output = response.get("output")
                    if not isinstance(output, list) or not output:
                        raise ProviderError()
                    try:
                        data = self.client.download(safe_download_url(output[0]))
                        if not data or len(data) > MAX_VIDEO_BYTES or len(data) < 16 or data[4:8] != b"ftyp":
                            raise ProviderError()
                        video_path = self.pipeline._path("runway", "generations", generation_id, "source.mp4")
                        if video_path.exists():
                            # A process may have saved the file immediately before a crash.
                            if hashlib.sha256(video_path.read_bytes()).hexdigest() != hashlib.sha256(data).hexdigest():
                                raise ProviderError()
                        else:
                            fd, temporary = tempfile.mkstemp(prefix=".video-", dir=video_path.parent)
                            try:
                                with os.fdopen(fd, "wb") as handle:
                                    handle.write(data)
                                    handle.flush()
                                    os.fsync(handle.fileno())
                                os.link(temporary, video_path)
                            finally:
                                Path(temporary).unlink(missing_ok=True)
                        record.update(videoUrl="/media/runway/" + generation_id,
                                      downloadUrl="/api/runway/download/" + generation_id,
                                      videoSha256=hashlib.sha256(data).hexdigest(), videoBytes=len(data))
                    except (ProviderError, OSError):
                        record["error"] = "Видео готово в Runway, но MP4 не сохранён. Обновите статус, чтобы повторить скачивание без новой генерации."
            except (ProviderError, ValueError, TypeError, AttributeError):
                record["error"] = "Не удалось обновить статус Runway. Существующая задача сохранена; новая генерация не запущена."
            record["updatedAt"] = timestamp()
            atomic_json(path, record)
            return {"generation": self._public(record)}

    def video(self, generation_id: str) -> Path:
        record = read_object(self._record_path(generation_id))
        if not record.get("videoUrl") or record.get("status") != "SUCCEEDED":
            raise RunwayError("Локальный MP4 пока не сохранён.", 404)
        path = self.pipeline._path("runway", "generations", generation_id, "source.mp4")
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != record.get("videoSha256"):
            raise RunwayError("Локальный MP4 изменён или отсутствует.", 409)
        return path
