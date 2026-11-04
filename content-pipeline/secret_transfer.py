#!/usr/bin/env python3
"""One-use, local RSA-OAEP/AES-GCM import of a Runway API key.

Only the public manifest leaves this machine. The import command accepts the
CHEWYKEY1 ciphertext on stdin, never a key or a ciphertext command argument.
No provider requests are made. Requires the cryptography package.
"""

from __future__ import annotations

import argparse
import base64
from contextlib import contextmanager
from datetime import datetime, timezone
import fcntl
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import time
import uuid

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from pipeline import Pipeline


PREFIX = "CHEWYKEY1."
AAD_PREFIX = b"chewy-runway-transfer-v1:"
RSA_BITS = 3072
TTL_SECONDS = 48 * 60 * 60
MAX_ENVELOPE = 8192
MAX_JSON = 6000
ID_PATTERN = re.compile(r"[0-9a-f]{32}\Z")
BASE64URL_PATTERN = re.compile(r"[A-Za-z0-9_-]+\Z")
INVALID_MESSAGE = "Код передачи повреждён или не подходит для этой формы."
LOCAL_MESSAGE = "Не удалось завершить передачу ключа. Создайте новую форму передачи."


class TransferError(Exception):
    """Contains only a fixed, safe message; never plaintext or crypto errors."""


def _iso(epoch: float) -> str:
    return datetime.fromtimestamp(epoch, timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _decode(value: object, *, maximum: int) -> bytes:
    if (not isinstance(value, str) or not value or len(value) > (maximum * 4 + 2) // 3
            or not BASE64URL_PATTERN.fullmatch(value)):
        raise TransferError(INVALID_MESSAGE)
    try:
        data = base64.b64decode(value + "=" * (-len(value) % 4), altchars=b"-_", validate=True)
    except (ValueError, TypeError):
        raise TransferError(INVALID_MESSAGE) from None
    # Reject alternate encodings of the same bytes, including nonzero pad bits.
    if len(data) > maximum or base64.urlsafe_b64encode(data).decode("ascii").rstrip("=") != value:
        raise TransferError(INVALID_MESSAGE)
    return data


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise TransferError(INVALID_MESSAGE)
        result[key] = value
    return result


def _envelope(value: object) -> dict:
    if not isinstance(value, str) or len(value) > MAX_ENVELOPE:
        raise TransferError(INVALID_MESSAGE)
    value = value.strip()
    if not value.startswith(PREFIX):
        raise TransferError(INVALID_MESSAGE)
    try:
        result = json.loads(_decode(value[len(PREFIX):], maximum=MAX_JSON), object_pairs_hook=_unique_object)
    except (ValueError, UnicodeError, RecursionError):
        raise TransferError(INVALID_MESSAGE) from None
    if (not isinstance(result, dict) or set(result) != {"v", "id", "ek", "iv", "ct"}
            or type(result["v"]) is not int or result["v"] != 1
            or not isinstance(result["id"], str) or not ID_PATTERN.fullmatch(result["id"])):
        raise TransferError(INVALID_MESSAGE)
    result["ek"] = _decode(result["ek"], maximum=RSA_BITS // 8)
    result["iv"] = _decode(result["iv"], maximum=12)
    result["ct"] = _decode(result["ct"], maximum=2048 + 16)
    if len(result["ek"]) != RSA_BITS // 8 or len(result["iv"]) != 12 or len(result["ct"]) < 8 + 16:
        raise TransferError(INVALID_MESSAGE)
    return result


def _atomic_private(path: Path, data: bytes) -> None:
    fd, temporary = tempfile.mkstemp(prefix=".pending-", dir=path.parent)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)


def _write_metadata(path: Path, value: dict) -> None:
    _atomic_private(path, json.dumps(value, ensure_ascii=False).encode("utf-8"))


def _read_private(path: Path, maximum: int) -> bytes:
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, "rb") as handle:
        data = handle.read(maximum + 1)
    if len(data) > maximum:
        raise TransferError(LOCAL_MESSAGE)
    return data


def _directory(path: Path) -> None:
    if path.is_symlink():
        raise TransferError(LOCAL_MESSAGE)
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    path.chmod(0o700)


@contextmanager
def _locked_root(pipeline: Pipeline):
    private = pipeline.workspace / "private"
    root = private / "transfer"
    _directory(private)
    _directory(root)
    fd = os.open(root / ".lock", os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "a+b") as lock:
        os.fchmod(lock.fileno(), 0o600)
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        try:
            yield root
        finally:
            fcntl.flock(lock.fileno(), fcntl.LOCK_UN)


def create_transfer(pipeline: Pipeline, *, now_epoch: float | None = None) -> dict:
    """Return a public manifest. The private key remains in ignored workspace."""
    try:
        current = time.time() if now_epoch is None else now_epoch
        private_key = rsa.generate_private_key(public_exponent=65537, key_size=RSA_BITS)
        public_der = private_key.public_key().public_bytes(
            serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
        transfer_id = uuid.uuid4().hex
        expires = current + TTL_SECONDS
        manifest = {"id": transfer_id, "expiresAt": _iso(expires),
                    "publicKeySpki": base64.b64encode(public_der).decode("ascii")}
        metadata = {"v": 1, "id": transfer_id, "createdAt": _iso(current), "expiresAt": manifest["expiresAt"],
                    "expiresEpoch": expires, "state": "pending"}
        with _locked_root(pipeline) as root:
            session = root / transfer_id
            session.mkdir(mode=0o700)
            _atomic_private(session / "private.pem", private_key.private_bytes(
                serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
            _write_metadata(session / "metadata.json", metadata)
        return manifest
    except TransferError:
        raise
    except Exception:
        raise TransferError(LOCAL_MESSAGE) from None


def import_transfer(pipeline: Pipeline, envelope: str, *, replace: bool = False,
                    now_epoch: float | None = None) -> dict:
    """Authenticate, consume once and persist through the existing Runway saver.

    A valid transfer is marked consumed before the key is saved. A crash or a
    disk error therefore fails closed and requires a new transfer, never replay.
    This process lock serializes imports; the pipeline lock protects local code.
    """
    try:
        value = _envelope(envelope)
        current = time.time() if now_epoch is None else now_epoch
        with pipeline.lock, _locked_root(pipeline) as root:
            session = root / value["id"]
            if session.is_symlink() or not session.is_dir():
                raise TransferError(INVALID_MESSAGE)
            metadata = json.loads(_read_private(session / "metadata.json", 4096), object_pairs_hook=_unique_object)
            if not isinstance(metadata, dict) or metadata.get("id") != value["id"] or metadata.get("v") != 1:
                raise TransferError(LOCAL_MESSAGE)
            if metadata.get("state") != "pending":
                raise TransferError("Эта форма передачи уже использована. Создайте новую форму.")
            expires = metadata.get("expiresEpoch")
            if not isinstance(expires, (int, float)) or isinstance(expires, bool) or not current < expires:
                (session / "private.pem").unlink(missing_ok=True)
                raise TransferError("Срок формы передачи истёк. Создайте новую форму.")
            # Presence is enough. Do not read the existing Runway secret here.
            if not replace and ((pipeline.workspace / "private/runway.json").exists()
                                or bool(os.environ.get("RUNWAYML_API_SECRET"))):
                raise TransferError("Ключ Runway уже настроен. Замена требует явного флага --replace.")
            try:
                private_key = serialization.load_pem_private_key(
                    _read_private(session / "private.pem", 16384), password=None)
                if not isinstance(private_key, rsa.RSAPrivateKey) or private_key.key_size != RSA_BITS:
                    raise TransferError(INVALID_MESSAGE)
                aes_key = private_key.decrypt(value["ek"], padding.OAEP(
                    mgf=padding.MGF1(algorithm=hashes.SHA256()), algorithm=hashes.SHA256(), label=None))
                if len(aes_key) != 32:
                    raise TransferError(INVALID_MESSAGE)
                plaintext = AESGCM(aes_key).decrypt(
                    value["iv"], value["ct"], AAD_PREFIX + value["id"].encode("ascii"))
                key = plaintext.decode("utf-8")
                pipeline.runway._validate_key(key)
            except Exception:
                raise TransferError(INVALID_MESSAGE) from None
            metadata.update(state="consumed", consumedAt=_iso(current))
            _write_metadata(session / "metadata.json", metadata)
            try:
                pipeline.runway.save_key(key)
            finally:
                (session / "private.pem").unlink(missing_ok=True)
            return {"ok": True, "configured": True, "source": "local", "transferId": value["id"]}
    except TransferError:
        raise
    except Exception:
        raise TransferError(LOCAL_MESSAGE) from None


class _SafeParser(argparse.ArgumentParser):
    def error(self, message):
        # argparse normally echoes unknown arguments, which may be a pasted key.
        self.exit(2, "Некорректные аргументы. Код передачи принимается только через stdin.\n")


def main(argv=None) -> int:
    parser = _SafeParser(description=__doc__)
    parser.add_argument("--workspace", type=Path, help="Local private workspace")
    commands = parser.add_subparsers(dest="command", required=True, parser_class=_SafeParser)
    commands.add_parser("create", help="Print only the public encryption manifest")
    importer = commands.add_parser("import", help="Read one encrypted CHEWYKEY1 envelope from stdin")
    importer.add_argument("--replace", action="store_true", help="Explicitly replace an existing Runway key")
    args = parser.parse_args(argv)
    try:
        pipeline = Pipeline(workspace=args.workspace)
        result = (create_transfer(pipeline) if args.command == "create" else
                  import_transfer(pipeline, sys.stdin.read(MAX_ENVELOPE + 1), replace=args.replace))
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except TransferError as error:
        print(str(error), file=sys.stderr)
        return 1
    except Exception:
        print(LOCAL_MESSAGE, file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
