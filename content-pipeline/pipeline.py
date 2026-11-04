#!/usr/bin/env python3
"""Local, reviewable content production; generated image bytes are never changed."""

from __future__ import annotations

import argparse
import base64
import binascii
from datetime import datetime, timezone
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import io
import json
import math
import mimetypes
import os
from pathlib import Path
import re
import stat
import tempfile
import threading
from urllib.parse import parse_qs, unquote, urlsplit
import uuid
import warnings
import zipfile
import zlib

from PIL import Image
from runway import Runway, RunwayError


HERE = Path(__file__).resolve().parent
MAX_IMAGE_BYTES = 20 * 1024 * 1024
MAX_BODY_BYTES = 28 * 1024 * 1024
MAX_PIXELS = 24_000_000
MAX_ANIMATION_BYTES = 100 * 1024 * 1024
MAX_ANIMATION_PIXELS = 128_000_000
MAX_ANIMATION_FRAMES = 240
ID_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]{0,95}\Z")


class PipelineError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")


def identifier(value: object) -> str:
    if not isinstance(value, str) or not ID_PATTERN.fullmatch(value):
        raise PipelineError("Некорректный идентификатор.")
    return value


def string(value: object, name: str, limit: int, *, empty: bool = False) -> str:
    if not isinstance(value, str) or len(value) > limit or (not empty and not value.strip()):
        raise PipelineError(f"Поле {name}: нужна строка длиной до {limit} символов.")
    return value


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def json_bytes(data: object) -> bytes:
    return (json.dumps(data, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def read_json(path: Path) -> dict:
    try:
        result = json.loads(path.read_text("utf-8"))
    except FileNotFoundError as exc:
        raise PipelineError("Запись не найдена.", 404) from exc
    except (UnicodeError, json.JSONDecodeError) as exc:
        raise PipelineError("Сохранённая запись повреждена.", 500) from exc
    if not isinstance(result, dict):
        raise PipelineError("Ожидался JSON-объект.", 500)
    return result


def create_file(path: Path, data: bytes) -> None:
    """Atomically publish a new file; never replace an existing history entry."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".pending-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.link(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)


def inspect_png(data: bytes, target: dict) -> dict:
    if not data or len(data) > MAX_IMAGE_BYTES:
        raise PipelineError("PNG должен быть непустым и не больше 20 MiB.", 413)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as candidate:
                if candidate.format != "PNG":
                    raise PipelineError("Поддерживается только настоящий PNG.")
                width, height = candidate.size
                if max(width, height) > 8192 or width * height > MAX_PIXELS:
                    raise PipelineError("Изображение слишком большое: максимум 8192 px по стороне и 24 млн пикселей.")
                if getattr(candidate, "n_frames", 1) != 1:
                    raise PipelineError("Нужен один статичный PNG, без APNG-анимации.")
                candidate.verify()
            with Image.open(io.BytesIO(data)) as candidate:
                candidate.load()
                mode = candidate.mode
                # Analysis only: no transformed image is saved or exported.
                alpha = candidate.convert("RGBA").getchannel("A")
                extrema = alpha.getextrema()
                bounds = alpha.getbbox()
                has_alpha = "A" in candidate.getbands() or "transparency" in candidate.info
    except PipelineError:
        raise
    except (OSError, ValueError, SyntaxError, Image.DecompressionBombError,
            Image.DecompressionBombWarning) as exc:
        raise PipelineError("PNG повреждён или не может быть безопасно прочитан.") from exc

    requires_alpha = bool(target.get("transparent", False))
    actual_transparency = bool(has_alpha and extrema[0] < 255)
    checks = [
        {"id": "png", "label": "Формат PNG", "status": "pass", "detail": "Файл полностью декодирован; оригинальные байты сохранены."},
        {"id": "dimensions", "label": "Размер холста", "status": "pass", "detail": f"{width} × {height} px; {len(data):,} байт."},
        {"id": "alpha", "label": "Настоящая прозрачность", "status": "pass" if actual_transparency or not requires_alpha else "fail",
         "detail": "Есть прозрачные пиксели." if actual_transparency else "Прозрачных пикселей нет."},
        {"id": "nonempty", "label": "Видимое содержимое", "status": "pass" if bounds else "fail",
         "detail": "Обнаружены непрозрачные пиксели." if bounds else "Изображение полностью прозрачное."},
    ]
    clipped = bool(bounds and (bounds[0] == 0 or bounds[1] == 0 or bounds[2] == width or bounds[3] == height))
    checks.append({"id": "edges", "label": "Поля вокруг силуэта", "status": "warn" if clipped else "pass",
                   "detail": "Содержимое касается края: проверьте, не обрезан ли силуэт." if clipped else "Силуэт не касается краёв холста."})
    display = target.get("maxDisplay", {})
    if display and bounds:
        large_enough = bounds[2] - bounds[0] >= display.get("width", 0) and bounds[3] - bounds[1] >= display.get("height", 0)
        checks.append({"id": "display", "label": "Размер для просмотра", "status": "pass" if large_enough else "warn",
                       "detail": "Видимая область покрывает заданный размер просмотра." if large_enough else "Видимая область меньше заданного размера просмотра; нужен визуальный контроль."})
    checks.append({"id": "human", "label": "Художественное ревью", "status": "warn",
                   "detail": "Стиль, смысл, контуры и пригодность для приложения проверяет владелец. Технический QA этого не подтверждает."})
    return {"pass": all(check["status"] != "fail" for check in checks), "width": width, "height": height,
            "mode": mode, "bytes": len(data), "sha256": digest(data), "bounds": list(bounds) if bounds else None,
            "hasAlpha": has_alpha, "hasTransparency": actual_transparency, "checks": checks}


def flat_filename(value: object, suffix: str) -> str:
    name = string(value, "filename", 240)
    if (name in {".", ".."} or any(char in name for char in "/\\:\x00")
            or name != Path(name).name or not name.lower().endswith(suffix)):
        raise PipelineError(f"Укажите имя {suffix} без пути.")
    return name


def motion_settings(fps: object, playback: object) -> tuple[float, str]:
    if isinstance(fps, bool) or not isinstance(fps, (int, float)) or not math.isfinite(fps) or not 1 <= fps <= 60:
        raise PipelineError("Частота кадров должна быть числом от 1 до 60 FPS.")
    if playback not in ("loop", "once", "pingpong"):
        raise PipelineError("Режим воспроизведения: loop, once или pingpong.")
    return fps, playback


def natural_key(name: str) -> tuple:
    # Numeric runs sort as numbers, and the name breaks leading-zero ties deterministically.
    return tuple((1, int(part)) if part.isdigit() else (0, part.casefold())
                 for part in re.split(r"([0-9]+)", name)) + ((2, name),)


def inspect_animation(data: bytes, target: dict) -> tuple[dict, list[dict]]:
    if not data or len(data) > MAX_ANIMATION_BYTES:
        raise PipelineError("ZIP должен быть непустым и не больше 100 MiB.", 413)
    frames = []
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            entries = archive.infolist()
            if not 2 <= len(entries) <= MAX_ANIMATION_FRAMES:
                raise PipelineError("В ZIP нужно от 2 до 240 PNG-кадров, без папок и других файлов.")
            names = set()
            total_bytes = 0
            for entry in entries:
                name = flat_filename(entry.filename, ".png")
                file_type = stat.S_IFMT(entry.external_attr >> 16)
                if (entry.is_dir() or file_type not in (0, stat.S_IFREG)
                        or entry.orig_filename != entry.filename or entry.flag_bits & 1
                        or entry.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED)):
                    raise PipelineError("ZIP поддерживает только обычные PNG-файлы без шифрования и ссылок.")
                if name.casefold() in names:
                    raise PipelineError("Имена кадров в ZIP не должны повторяться.")
                names.add(name.casefold())
                if not 0 < entry.file_size <= MAX_IMAGE_BYTES:
                    raise PipelineError("Каждый PNG-кадр должен быть непустым и не больше 20 MiB.", 413)
                total_bytes += entry.file_size
                if total_bytes > MAX_ANIMATION_BYTES:
                    raise PipelineError("Распакованные кадры превышают 100 MiB.", 413)
            total_pixels = 0
            canvas = None
            for entry in sorted(entries, key=lambda item: natural_key(item.filename)):
                frame_data = archive.read(entry)
                qa = inspect_png(frame_data, target)
                dimensions = (qa["width"], qa["height"])
                if canvas is not None and canvas != dimensions:
                    raise PipelineError("Все кадры должны иметь одинаковый размер холста.")
                canvas = dimensions
                total_pixels += qa["width"] * qa["height"]
                if total_pixels > MAX_ANIMATION_PIXELS:
                    raise PipelineError("Последовательность превышает 128 млн декодированных пикселей.", 413)
                frames.append({"filename": entry.filename, "data": frame_data, "qa": qa})
    except PipelineError:
        raise
    except (zipfile.BadZipFile, NotImplementedError, RuntimeError, OSError, ValueError, EOFError, zlib.error) as exc:
        raise PipelineError("ZIP повреждён или не может быть безопасно прочитан.") from exc
    checks = []
    check_templates = {check["id"]: check for frame in frames for check in frame["qa"]["checks"]}
    for original in check_templates.values():
        frame_checks = [(frame["filename"], check) for frame in frames for check in frame["qa"]["checks"]
                        if check["id"] == original["id"]]
        failures = [name for name, check in frame_checks if check["status"] == "fail"]
        warnings_ = [name for name, check in frame_checks if check["status"] == "warn"]
        status = "fail" if failures else "warn" if warnings_ else "pass"
        affected = failures or warnings_
        detail = (f"Кадры: {', '.join(affected[:5])}" + (f" и ещё {len(affected) - 5}. " if len(affected) > 5 else ". ")
                  if affected and original["id"] != "human" else f"Проверены все {len(frames)} кадров. ")
        checks.append({**original, "status": status, "detail": detail + (next(check["detail"] for _, check in frame_checks if check["status"] == status))})
    checks.append({"id": "motion", "label": "Изменение кадров", "status": "pass" if len({frame["qa"]["sha256"] for frame in frames}) > 1 else "warn",
                   "detail": "Наличие разных файлов не подтверждает качество движения." if len({frame["qa"]["sha256"] for frame in frames}) > 1 else "Все кадры одинаковы: видимого движения может не быть."})
    checks.append({"id": "temporal", "label": "Движение и стык цикла", "status": "warn",
                   "detail": "Проверьте движение в плеере: стабильность лица, стоп и масштаба, мерцание контура и стык цикла. Эти свойства автоматически не подтверждаются."})
    boxes = [frame["qa"]["bounds"] for frame in frames if frame["qa"]["bounds"]]
    bounds = [min(box[0] for box in boxes), min(box[1] for box in boxes), max(box[2] for box in boxes), max(box[3] for box in boxes)] if boxes else None
    qa = {"pass": all(frame["qa"]["pass"] for frame in frames), "width": canvas[0], "height": canvas[1],
          "mode": frames[0]["qa"]["mode"] if len({frame["qa"]["mode"] for frame in frames}) == 1 else "mixed",
          "bytes": len(data), "uncompressedBytes": total_bytes, "decodedPixels": total_pixels,
          "sha256": digest(data), "bounds": bounds, "hasAlpha": all(frame["qa"]["hasAlpha"] for frame in frames),
          "hasTransparency": all(frame["qa"]["hasTransparency"] for frame in frames), "checks": checks}
    return qa, frames


def pack_animation_directory(path: Path) -> bytes:
    entries = list(path.iterdir())
    if not 2 <= len(entries) <= MAX_ANIMATION_FRAMES:
        raise PipelineError("В папке нужно от 2 до 240 PNG-кадров, без вложенных папок и других файлов.")
    total = 0
    for entry in entries:
        flat_filename(entry.name, ".png")
        if entry.is_symlink() or not entry.is_file():
            raise PipelineError("Папка кадров должна содержать только обычные PNG-файлы.")
        size = entry.stat().st_size
        total += size
        if not 0 < size <= MAX_IMAGE_BYTES or total > MAX_ANIMATION_BYTES:
            raise PipelineError("Превышен предел размера PNG или последовательности.", 413)
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for entry in sorted(entries, key=lambda item: natural_key(item.name)):
            archive.write(entry, entry.name)
    return buffer.getvalue()


class Pipeline:
    def __init__(self, *, repo: Path | None = None, catalog: Path | None = None,
                 workspace: Path | None = None, web: Path | None = None):
        self.repo = (repo or HERE.parent).resolve()
        self.catalog_path = (catalog or HERE / "catalog.json").resolve()
        self.workspace = (workspace or HERE / "workspace").resolve()
        self.web = (web or HERE / "web").resolve()
        self.lock = threading.RLock()
        self.runway = Runway(self)

    def _path(self, *parts: str) -> Path:
        result = self.workspace.joinpath(*parts).resolve()
        if not result.is_relative_to(self.workspace):
            raise PipelineError("Недопустимый путь.")
        return result

    def catalog(self) -> dict:
        catalog = read_json(self.catalog_path)
        for key in ("jobs", "references"):
            values = catalog.get(key)
            if not isinstance(values, list) or any(not isinstance(item, dict) for item in values):
                raise PipelineError("Некорректный каталог.", 500)
            ids = [identifier(item.get("id")) for item in values]
            if len(ids) != len(set(ids)):
                raise PipelineError("Повтор идентификатора в каталоге.", 500)
        return catalog

    def job(self, job_id: str) -> dict:
        job_id = identifier(job_id)
        for job in self.catalog()["jobs"]:
            if job["id"] == job_id:
                return job
        raise PipelineError("Задание не найдено.", 404)

    def reference_path(self, ref: dict) -> Path:
        relative = ref.get("path")
        if not isinstance(relative, str) or Path(relative).is_absolute():
            raise PipelineError("Некорректный путь референса.")
        path = (self.repo / relative).resolve()
        if not path.is_relative_to(self.repo) or not path.is_file():
            raise PipelineError("Референс отсутствует или находится вне проекта.")
        return path

    def request(self, request_id: str) -> dict:
        return read_json(self._path("requests", identifier(request_id), "request.json"))

    def request_reference(self, request_id: str, ref_id: str) -> tuple[Path, str]:
        request = self.request(identifier(request_id))
        ref_id = identifier(ref_id)
        reference = next((ref for ref in request["references"] if ref["id"] == ref_id), None)
        if reference is None:
            raise PipelineError("Референс отсутствует в этом пакете.", 404)
        path = self._path(reference["snapshot"])
        if not path.is_file() or digest(path.read_bytes()) != reference["sha256"]:
            raise PipelineError("Сохранённый референс изменён или отсутствует.", 409)
        return path, mimetypes.guess_type(path.name)[0] or "application/octet-stream"

    def request_references(self, request: dict) -> list[dict]:
        references = []
        for reference in request["references"]:
            path, _ = self.request_reference(request["id"], reference["id"])
            with Image.open(path) as image:
                width, height = image.size
            references.append({"id": reference["id"], "title": reference.get("title", reference["id"]),
                               "role": reference.get("role", ""), "width": width, "height": height,
                               "url": f"/media/request-references/{request['id']}/{reference['id']}"})
        return references

    def prepare(self, job_id: str, prompt: str | None = None) -> dict:
        with self.lock:
            job = self.job(job_id)
            prompt = string(job.get("prompt") if prompt is None else prompt, "prompt", 24000)
            request_id = "r-" + uuid.uuid4().hex
            references = {ref["id"]: ref for ref in self.catalog()["references"]}
            snapshot_refs = []
            for ref_id in job.get("referenceIds", []):
                identifier(ref_id)
                if ref_id not in references:
                    raise PipelineError("В задании указан неизвестный референс.")
                reference = references[ref_id]
                source = self.reference_path(reference)
                data = source.read_bytes()
                suffix = source.suffix.lower()
                if suffix not in {".png", ".jpg", ".jpeg", ".webp"}:
                    raise PipelineError("Референс должен быть PNG, JPEG или WebP.")
                destination = self._path("requests", request_id, "references", ref_id + suffix)
                create_file(destination, data)
                snapshot_refs.append({**reference, "sha256": digest(data), "bytes": len(data),
                                      "snapshot": str(destination.relative_to(self.workspace)),
                                      "absolutePath": str(destination)})
            request = {"id": request_id, "jobId": job_id, "prompt": prompt,
                       "referenced_image_paths": [ref["absolutePath"] for ref in snapshot_refs],
                       "transparent_background": bool(job.get("target", {}).get("transparent", False)),
                       "createdAt": now(), "job": job, "references": snapshot_refs,
                       "status": "prepared", "generation": (
                           "Create motion in an external animation tool using this prompt and the reference snapshots. "
                           "Export 2–240 same-canvas transparent PNG frames with numbered names, package them flat in a ZIP, "
                           "then import the sequence with its FPS and playback mode. This workshop does not generate video automatically."
                           if job.get("kind") == "animation" else
                           "Run image_gen with this packet, then import its PNG result.")}
            create_file(self._path("requests", request_id, "request.json"), json_bytes(request))
            return {"request": request, "url": "/api/requests/" + request_id}

    def _attempt_base(self, attempt_id: str) -> dict:
        return read_json(self._path("attempts", identifier(attempt_id), "attempt.json"))

    def attempt(self, attempt_id: str, job_id: str | None = None) -> dict:
        result = self._attempt_base(attempt_id)
        if job_id is not None and result["jobId"] != identifier(job_id):
            raise PipelineError("Попытка относится к другому заданию.")
        reviews = sorted(self._path("attempts", attempt_id, "reviews").glob("*.json"))
        result["review"] = read_json(reviews[-1]) if reviews else {"status": "pending", "note": ""}
        exports = sorted(self._path("attempts", attempt_id, "exports").glob("*.json"))
        result["export"] = read_json(exports[-1]) if exports and result["review"]["status"] == "approved" else None
        return result

    def import_result(self, job_id: str, packet_id: str, data: bytes, filename: str,
                      tool: str, model: str | None = None) -> dict:
        with self.lock:
            self.job(job_id)
            request = self.request(packet_id)
            if request["jobId"] != job_id:
                raise PipelineError("Пакет относится к другому заданию.")
            if request["job"].get("kind") == "animation":
                raise PipelineError("Для анимации импортируйте ZIP с PNG-кадрами.")
            filename = flat_filename(filename, ".png")
            tool = string(tool, "tool", 120)
            if model is not None:
                model = string(model, "model", 120, empty=True)
            qa = inspect_png(data, request["job"].get("target", {}))
            attempt_id = "a-" + uuid.uuid4().hex
            result = {"id": attempt_id, "jobId": job_id, "packetId": packet_id, "kind": "image",
                      "url": "/media/attempts/" + attempt_id, "filename": filename,
                      "tool": tool, "model": model or None, "createdAt": now(), "qa": qa}
            create_file(self._path("attempts", attempt_id, "source.png"), data)
            create_file(self._path("attempts", attempt_id, "attempt.json"), json_bytes(result))
            return {"attempt": self.attempt(attempt_id)}

    def import_animation(self, job_id: str, packet_id: str, data: bytes, filename: str,
                         tool: str, model: str | None = None, fps: float | None = None,
                         playback: str | None = None) -> dict:
        with self.lock:
            self.job(job_id)
            request = self.request(packet_id)
            if request["jobId"] != job_id:
                raise PipelineError("Пакет относится к другому заданию.")
            if request["job"].get("kind") != "animation":
                raise PipelineError("ZIP кадров можно импортировать только в задание анимации.")
            filename = flat_filename(filename, ".zip")
            tool = string(tool, "tool", 120)
            if model is not None:
                model = string(model, "model", 120, empty=True)
            motion = request["job"].get("motion", {})
            fps, playback = motion_settings(fps if fps is not None else motion.get("fps", 24),
                                           playback if playback is not None else motion.get("playback", "loop"))
            qa, source_frames = inspect_animation(data, request["job"].get("target", {}))
            attempt_id = "a-" + uuid.uuid4().hex
            frames = [{"index": index, "filename": frame["filename"],
                       "url": f"/media/frames/{attempt_id}/{index}", "width": frame["qa"]["width"],
                       "height": frame["qa"]["height"], "sha256": frame["qa"]["sha256"]}
                      for index, frame in enumerate(source_frames)]
            cycle_frames = 2 * len(frames) - 2 if playback == "pingpong" else len(frames)
            animation = {"fps": fps, "playback": playback, "frameCount": len(frames),
                         "durationSeconds": cycle_frames / fps, "frames": frames}
            result = {"id": attempt_id, "jobId": job_id, "packetId": packet_id, "kind": "animation",
                      "url": frames[0]["url"], "filename": filename, "tool": tool, "model": model or None,
                      "createdAt": now(), "qa": qa, "animation": animation}
            create_file(self._path("attempts", attempt_id, "source.zip"), data)
            for frame, original in zip(frames, source_frames):
                create_file(self._path("attempts", attempt_id, "frames", f"{frame['index']:04d}.png"), original["data"])
            create_file(self._path("attempts", attempt_id, "attempt.json"), json_bytes(result))
            return {"attempt": self.attempt(attempt_id)}

    def animation_frame(self, attempt_id: str, frame_index: str) -> tuple[Path, str]:
        attempt = self._attempt_base(identifier(attempt_id))
        if not re.fullmatch(r"0|[1-9][0-9]{0,2}", frame_index) or attempt.get("kind") != "animation":
            raise PipelineError("Кадр не найден.", 404)
        index = int(frame_index)
        if index >= len(attempt["animation"]["frames"]):
            raise PipelineError("Кадр не найден.", 404)
        frame = attempt["animation"]["frames"][index]
        path = self._path("attempts", attempt_id, "frames", f"{index:04d}.png")
        if not path.is_file() or digest(path.read_bytes()) != frame["sha256"]:
            raise PipelineError("Сохранённый кадр изменён или отсутствует.", 409)
        return path, "image/png"

    def review(self, job_id: str, attempt_id: str, status: str, note: str = "") -> dict:
        with self.lock:
            attempt = self.attempt(attempt_id, job_id)
            if status not in {"approved", "rejected", "pending"}:
                raise PipelineError("Неизвестный статус ревью.")
            note = string(note, "note", 4000, empty=True)
            if status == "approved" and not attempt["qa"]["pass"]:
                raise PipelineError("Сначала исправьте технические ошибки исходника.", 409)
            reviewed_at = now()
            review = {"status": status, "note": note, "reviewedAt": reviewed_at, "reviewer": "local-owner"}
            event_id = reviewed_at.replace(":", "-") + "-" + uuid.uuid4().hex
            create_file(self._path("attempts", attempt_id, "reviews", event_id + ".json"), json_bytes(review))
            return {"attempt": self.attempt(attempt_id)}

    def export(self, job_id: str, attempt_id: str) -> dict:
        with self.lock:
            attempt = self.attempt(attempt_id, job_id)
            if not attempt["qa"]["pass"] or attempt["review"]["status"] != "approved":
                raise PipelineError("Пакет исходника доступен после технической проверки и одобрения владельцем.", 409)
            is_animation = attempt.get("kind") == "animation"
            source_name = "source.zip" if is_animation else "source.png"
            source = self._path("attempts", attempt_id, source_name).read_bytes()
            if digest(source) != attempt["qa"]["sha256"]:
                raise PipelineError("Исходник изменился после QA; нужен новый импорт.", 409)
            request = self.request(attempt["packetId"])
            exported_at = now()
            export_id = "e-" + uuid.uuid4().hex
            metadata = {"id": export_id, "url": "/exports/" + export_id + ".zip", "createdAt": exported_at,
                        "kind": "source-package", "attemptId": attempt_id}
            manifest = {"schemaVersion": 1, "kind": "source-package", "nativeReady": False,
                        "description": "Unchanged reviewed source, generation request and reference snapshots. Not a native asset export.",
                        "jobId": job_id, "attemptId": attempt_id, "packetId": attempt["packetId"],
                        "createdAt": exported_at, "source": {"file": source_name, "sha256": digest(source), "bytes": len(source)},
                        "provenance": {"tool": attempt["tool"], "model": attempt["model"], "createdAt": attempt["createdAt"]},
                        "qa": attempt["qa"], "review": attempt["review"], "job": request["job"]}
            portable_request = {**request, "referenced_image_paths": [], "references": []}
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
                archive.writestr(source_name, source)
                if is_animation:
                    animation = {**attempt["animation"], "frames": []}
                    for frame in attempt["animation"]["frames"]:
                        frame_path, _ = self.animation_frame(attempt_id, str(frame["index"]))
                        relative = "frames/" + frame["filename"]
                        archive.writestr(relative, frame_path.read_bytes())
                        animation["frames"].append({key: value for key, value in {**frame, "file": relative}.items() if key != "url"})
                    manifest["animation"] = animation
                    archive.writestr("animation.json", json_bytes(animation))
                archive.writestr("manifest.json", json_bytes(manifest))
                for ref in request["references"]:
                    relative = "references/" + Path(ref["snapshot"]).name
                    ref_data = self._path(ref["snapshot"]).read_bytes()
                    if digest(ref_data) != ref["sha256"]:
                        raise PipelineError("Сохранённый референс изменён; пакет не экспортирован.", 409)
                    archive.writestr(relative, ref_data)
                    portable_request["referenced_image_paths"].append(relative)
                    portable_request["references"].append({key: value for key, value in {**ref, "snapshot": relative}.items() if key != "absolutePath"})
                archive.writestr("request.json", json_bytes(portable_request))
            create_file(self._path("exports", export_id + ".zip"), buffer.getvalue())
            create_file(self._path("exports", export_id + ".json"), json_bytes(metadata))
            event_id = exported_at.replace(":", "-") + "-" + export_id
            create_file(self._path("attempts", attempt_id, "exports", event_id + ".json"), json_bytes(metadata))
            return metadata

    def state(self) -> dict:
        with self.lock:
            catalog = self.catalog()
            references = []
            for ref in catalog["references"]:
                try:
                    with Image.open(self.reference_path(ref)) as image:
                        width, height = image.size
                except (OSError, ValueError) as exc:
                    raise PipelineError("Не удалось прочитать референс.", 500) from exc
                references.append({**ref, "url": "/media/references/" + ref["id"], "width": width, "height": height})
            requests = [read_json(path) for path in self._path("requests").glob("*/request.json")]
            attempts = [self.attempt(path.parent.name) for path in self._path("attempts").glob("*/attempt.json")]
            jobs = []
            for job in catalog["jobs"]:
                jobs.append({**job,
                             "requests": [{"id": request["id"], "prompt": request["prompt"], "createdAt": request["createdAt"],
                                           "url": "/api/requests/" + request["id"],
                                           "references": self.request_references(request)}
                                          for request in sorted(requests, key=lambda item: item["createdAt"])
                                          if request["jobId"] == job["id"]],
                             "attempts": sorted([attempt for attempt in attempts if attempt["jobId"] == job["id"]], key=lambda item: item["createdAt"])})
            return {"title": catalog.get("title", "Content pipeline"), "references": references, "jobs": jobs}

    def media(self, kind: str, media_id: str) -> tuple[Path, str]:
        identifier(media_id)
        if kind == "references":
            ref = next((ref for ref in self.catalog()["references"] if ref["id"] == media_id), None)
            if not ref:
                raise PipelineError("Референс не найден.", 404)
            path = self.reference_path(ref)
            return path, mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        if kind == "attempts":
            attempt = self._attempt_base(media_id)
            if attempt.get("kind") == "animation":
                return self.animation_frame(media_id, "0")
            return self._path("attempts", media_id, "source.png"), "image/png"
        raise PipelineError("Файл не найден.", 404)


class PipelineServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, pipeline: Pipeline, port: int = 8766):
        self.pipeline = pipeline
        super().__init__(("127.0.0.1", port), PipelineHandler)


class PipelineHandler(BaseHTTPRequestHandler):
    server: PipelineServer

    def log_message(self, format: str, *args) -> None:
        pass

    def _send(self, status: int, data: bytes, content_type: str, filename: str | None = None,
              extra_headers: dict | None = None) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        self.send_header("Content-Security-Policy", "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
        if filename:
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        for name, value in (extra_headers or {}).items():
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(data)

    def _json(self, value: object, status: int = 200) -> None:
        self._send(status, json_bytes(value), "application/json; charset=utf-8")

    def _host(self) -> None:
        port = self.server.server_address[1]
        if self.headers.get("Host") not in {f"127.0.0.1:{port}", f"localhost:{port}"}:
            raise PipelineError("Разрешён только локальный адрес сервера.", 403)

    def _route(self) -> str:
        path = unquote(urlsplit(self.path).path)
        if "\\" in path or "\x00" in path or ".." in path.split("/"):
            raise PipelineError("Недопустимый путь.")
        return path

    def _handle(self, callback) -> None:
        try:
            self._host()
            callback()
        except (PipelineError, RunwayError) as exc:
            self._json({"error": str(exc)}, exc.status)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception:
            self._json({"error": "Не удалось выполнить операцию. Проверьте доступ к каталогу и workspace; предыдущие данные сохранены."}, 500)

    def do_GET(self) -> None:
        self._handle(self._get)

    def _get(self) -> None:
        path = self._route()
        pipeline = self.server.pipeline
        if path == "/api/state":
            return self._json(pipeline.state())
        if path == "/api/runway/status":
            return self._json(pipeline.runway.status())
        if path == "/api/runway/generations":
            query = parse_qs(urlsplit(self.path).query, keep_blank_values=True)
            packet_ids = query.get("packetId", [])
            if len(packet_ids) > 1:
                raise PipelineError("Нужен один packetId.")
            return self._json(pipeline.runway.generations(packet_ids[0] if packet_ids else None))
        if path.startswith("/api/runway/download/"):
            generation_id = identifier(path.removeprefix("/api/runway/download/"))
            return self._send(200, pipeline.runway.video(generation_id).read_bytes(), "video/mp4", generation_id + ".mp4")
        if path.startswith("/media/runway/"):
            generation_id = identifier(path.removeprefix("/media/runway/"))
            data = pipeline.runway.video(generation_id).read_bytes()
            requested_range = self.headers.get("Range")
            if requested_range:
                match = re.fullmatch(r"bytes=(\d*)-(\d*)", requested_range)
                start, end = 0, len(data) - 1
                if match and any(match.groups()):
                    if match[1]:
                        start = int(match[1])
                        end = min(int(match[2]), end) if match[2] else end
                    else:
                        start = max(0, len(data) - int(match[2]))
                else:
                    start = len(data)
                if start > end or start >= len(data):
                    return self._send(416, b"", "video/mp4", extra_headers={"Content-Range": f"bytes */{len(data)}"})
                return self._send(206, data[start:end + 1], "video/mp4",
                                  extra_headers={"Content-Range": f"bytes {start}-{end}/{len(data)}", "Accept-Ranges": "bytes"})
            return self._send(200, data, "video/mp4", extra_headers={"Accept-Ranges": "bytes"})
        if path.startswith("/api/requests/"):
            return self._json(pipeline.request(identifier(path.removeprefix("/api/requests/"))))
        if path.startswith("/media/"):
            parts = path.split("/")
            if len(parts) == 5 and parts[2] == "frames":
                file, content_type = pipeline.animation_frame(parts[3], parts[4])
                return self._send(200, file.read_bytes(), content_type)
            if len(parts) == 5 and parts[2] == "request-references":
                file, content_type = pipeline.request_reference(parts[3], parts[4])
                return self._send(200, file.read_bytes(), content_type)
            if len(parts) != 4:
                raise PipelineError("Файл не найден.", 404)
            file, content_type = pipeline.media(parts[2], parts[3])
            return self._send(200, file.read_bytes(), content_type)
        if path.startswith("/exports/") and path.endswith(".zip"):
            export_id = identifier(path.removeprefix("/exports/").removesuffix(".zip"))
            metadata = read_json(pipeline._path("exports", export_id + ".json"))
            attempt = pipeline.attempt(metadata["attemptId"])
            if attempt["review"]["status"] != "approved":
                raise PipelineError("Одобрение исходника отозвано.", 409)
            return self._send(200, pipeline._path("exports", export_id + ".zip").read_bytes(), "application/zip", export_id + ".zip")
        static = pipeline.web / ("index.html" if path == "/" else path.lstrip("/"))
        static = static.resolve()
        if not static.is_relative_to(pipeline.web) or not static.is_file() or static.suffix not in {".html", ".css", ".js", ".svg", ".ico", ".woff2"}:
            raise PipelineError("Страница не найдена.", 404)
        return self._send(200, static.read_bytes(), mimetypes.guess_type(static.name)[0] or "application/octet-stream")

    def do_POST(self) -> None:
        self._handle(self._post)

    def _post(self) -> None:
        path = self._route()
        port = self.server.server_address[1]
        origin = self.headers.get("Origin")
        if origin is not None and origin not in {f"http://127.0.0.1:{port}", f"http://localhost:{port}"}:
            raise PipelineError("Запросы с другого сайта запрещены.", 403)
        if self.headers.get_content_type() != "application/json" or self.headers.get("Transfer-Encoding"):
            raise PipelineError("Нужен application/json с Content-Length.", 415)
        try:
            length = int(self.headers.get("Content-Length", "-1"))
        except ValueError as exc:
            raise PipelineError("Некорректный размер запроса.") from exc
        body_limit = ((MAX_ANIMATION_BYTES + 2) // 3) * 4 + 65536 if path == "/api/import-animation" else MAX_BODY_BYTES
        if length < 0 or length > body_limit:
            raise PipelineError("Запрос слишком большой или не указан Content-Length.", 413)
        try:
            body = json.loads(self.rfile.read(length))
        except (ValueError, UnicodeError) as exc:
            raise PipelineError("Некорректный JSON.") from exc
        if not isinstance(body, dict):
            raise PipelineError("Ожидался JSON-объект.")
        pipeline = self.server.pipeline
        if path == "/api/runway/key":
            result = pipeline.runway.save_key(body.get("apiKey"))
        elif path == "/api/runway/generate":
            result = pipeline.runway.generate(body.get("jobId"), body.get("packetId"), body.get("referenceId"),
                                              body.get("model"), body.get("clientRequestId"))
        elif path == "/api/runway/refresh":
            result = pipeline.runway.refresh(body.get("generationId"))
        elif path == "/api/prepare":
            result = pipeline.prepare(body.get("jobId"), body.get("prompt"))
        elif path in {"/api/import", "/api/import-animation"}:
            encoded = body.get("dataBase64")
            is_animation = path == "/api/import-animation"
            size_limit = MAX_ANIMATION_BYTES if is_animation else MAX_IMAGE_BYTES
            if not isinstance(encoded, str) or len(encoded) > ((size_limit + 2) // 3) * 4:
                raise PipelineError("ZIP должен быть не больше 100 MiB." if is_animation else "PNG должен быть не больше 20 MiB.", 413)
            try:
                data = base64.b64decode(encoded, validate=True)
            except (binascii.Error, ValueError) as exc:
                raise PipelineError("Некорректный base64 исходника.") from exc
            if is_animation:
                result = pipeline.import_animation(body.get("jobId"), body.get("packetId"), data,
                                                   body.get("filename"), body.get("tool"), body.get("model"),
                                                   body.get("fps"), body.get("playback"))
            else:
                result = pipeline.import_result(body.get("jobId"), body.get("packetId"), data,
                                                body.get("filename"), body.get("tool"), body.get("model"))
        elif path == "/api/review":
            result = pipeline.review(body.get("jobId"), body.get("attemptId"), body.get("status"), body.get("note", ""))
        elif path == "/api/export":
            result = pipeline.export(body.get("jobId"), body.get("attemptId"))
        else:
            raise PipelineError("Операция не найдена.", 404)
        self._json(result)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", type=Path, help="Persist pipeline history here")
    parser.add_argument("--catalog", type=Path, help="Alternative catalog JSON")
    commands = parser.add_subparsers(dest="command", required=True)
    serve_parser = commands.add_parser("serve")
    serve_parser.add_argument("--port", type=int, default=8766)
    prepare_parser = commands.add_parser("prepare")
    prepare_parser.add_argument("job")
    prepare_parser.add_argument("--prompt")
    import_parser = commands.add_parser("import-result")
    import_parser.add_argument("job")
    import_parser.add_argument("path", type=Path)
    import_parser.add_argument("--packet", required=True)
    import_parser.add_argument("--tool", required=True)
    import_parser.add_argument("--model")
    animation_parser = commands.add_parser("import-animation")
    animation_parser.add_argument("job")
    animation_parser.add_argument("path", type=Path, help="Flat PNG directory or ZIP archive")
    animation_parser.add_argument("--packet", required=True)
    animation_parser.add_argument("--tool", required=True)
    animation_parser.add_argument("--model")
    animation_parser.add_argument("--fps", type=float, help="Default: prepared job motion FPS")
    animation_parser.add_argument("--playback", choices=("loop", "once", "pingpong"), help="Default: prepared job motion playback")
    commands.add_parser("state")
    args = parser.parse_args()
    pipeline = Pipeline(catalog=args.catalog, workspace=args.workspace)
    try:
        if args.command == "serve":
            pipeline.catalog()
            server = PipelineServer(pipeline, args.port)
            print(f"Chewy content pipeline: http://127.0.0.1:{server.server_address[1]}", flush=True)
            try:
                server.serve_forever()
            except KeyboardInterrupt:
                pass
            finally:
                server.server_close()
            return
        if args.command == "prepare":
            result = pipeline.prepare(args.job, args.prompt)
        elif args.command == "import-result":
            if args.path.stat().st_size > MAX_IMAGE_BYTES:
                raise PipelineError("PNG должен быть не больше 20 MiB.", 413)
            result = pipeline.import_result(args.job, args.packet, args.path.read_bytes(), args.path.name, args.tool, args.model)
        elif args.command == "import-animation":
            if args.path.is_dir():
                data = pack_animation_directory(args.path)
                filename = args.path.name + ".zip"
            else:
                if args.path.stat().st_size > MAX_ANIMATION_BYTES:
                    raise PipelineError("ZIP должен быть не больше 100 MiB.", 413)
                data, filename = args.path.read_bytes(), args.path.name
            result = pipeline.import_animation(args.job, args.packet, data, filename, args.tool, args.model, args.fps, args.playback)
        else:
            result = pipeline.state()
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except (PipelineError, OSError) as exc:
        parser.exit(1, str(exc) + "\n")


if __name__ == "__main__":
    main()
