"""Offline transfer tests use synthetic keys; no network or real credentials."""

import base64
from contextlib import redirect_stderr, redirect_stdout
import io
import json
import os
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import Mock, patch

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from pipeline import Pipeline
from secret_transfer import (AAD_PREFIX, MAX_ENVELOPE, PREFIX, RSA_BITS, TTL_SECONDS,
                             TransferError, create_transfer, import_transfer, main)


SECRET = "rwy_FAKE_TRANSFER_TEST_ONLY_0123456789"
START = 1793260800


def encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def pack(value: dict) -> str:
    return PREFIX + encode(json.dumps(value, separators=(",", ":")).encode("utf-8"))


def encrypted(manifest: dict, plaintext: bytes = SECRET.encode("utf-8"), *, aad: bytes | None = None,
              public_key=None, aes_length=32) -> dict:
    public_key = public_key or serialization.load_der_public_key(base64.b64decode(manifest["publicKeySpki"]))
    aes_key = os.urandom(aes_length)
    iv = os.urandom(12)
    wrapped = public_key.encrypt(aes_key, padding.OAEP(
        mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None))
    ciphertext = AESGCM(aes_key).encrypt(iv, plaintext, aad if aad is not None else AAD_PREFIX + manifest["id"].encode("ascii"))
    return {"v": 1, "id": manifest["id"], "ek": encode(wrapped), "iv": encode(iv), "ct": encode(ciphertext)}


class SecretTransferTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.workspace = Path(temporary.name) / "workspace"
        self.pipeline = Pipeline(workspace=self.workspace)
        self.pipeline.runway.client = Mock()
        self.pipeline.runway.client.request.side_effect = AssertionError("Network use is forbidden")
        self.pipeline.runway.client.download.side_effect = AssertionError("Network use is forbidden")
        environment = patch.dict(os.environ, {}, clear=True)
        environment.start()
        self.addCleanup(environment.stop)
        self.manifest = create_transfer(self.pipeline, now_epoch=START)
        self.session = self.workspace / "private/transfer" / self.manifest["id"]
        self.runway_path = self.workspace / "private/runway.json"

    def import_value(self, value=None, **kwargs):
        return import_transfer(self.pipeline, pack(value or encrypted(self.manifest)), now_epoch=START + 1, **kwargs)

    def test_public_manifest_private_permissions_and_roundtrip(self):
        self.assertEqual(set(self.manifest), {"id", "expiresAt", "publicKeySpki"})
        public_key = serialization.load_der_public_key(base64.b64decode(self.manifest["publicKeySpki"]))
        self.assertEqual(public_key.key_size, RSA_BITS)
        for path in (self.workspace / "private", self.session.parent, self.session):
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o700)
        for path in (self.session / "private.pem", self.session / "metadata.json", self.session.parent / ".lock"):
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
        result = self.import_value()
        self.assertEqual(result, {"ok": True, "configured": True, "source": "local", "transferId": self.manifest["id"]})
        self.assertEqual(json.loads(self.runway_path.read_text())["apiKey"], SECRET)
        self.assertEqual(stat.S_IMODE(self.runway_path.stat().st_mode), 0o600)
        self.assertFalse((self.session / "private.pem").exists())
        self.assertEqual(json.loads((self.session / "metadata.json").read_text())["state"], "consumed")
        self.assertNotIn(SECRET, json.dumps(result))
        for path in self.session.parent.rglob("*"):
            if path.is_file():
                self.assertNotIn(SECRET.encode(), path.read_bytes())
        self.pipeline.runway.client.request.assert_not_called()
        self.pipeline.runway.client.download.assert_not_called()

    def test_replay_is_rejected_even_with_explicit_replace(self):
        value = encrypted(self.manifest)
        self.import_value(value)
        before = self.runway_path.read_bytes()
        for replace in (False, True):
            with self.assertRaises(TransferError):
                self.import_value(value, replace=replace)
        self.assertEqual(self.runway_path.read_bytes(), before)

    def test_wrong_rsa_key_fails_without_consuming(self):
        wrong_public = rsa.generate_private_key(public_exponent=65537, key_size=RSA_BITS).public_key()
        with self.assertRaises(TransferError):
            self.import_value(encrypted(self.manifest, public_key=wrong_public))
        self.assertFalse(self.runway_path.exists())
        self.assertTrue((self.session / "private.pem").exists())
        self.import_value()

    def test_tampered_ciphertext_iv_wrapping_and_aad_fail(self):
        original = encrypted(self.manifest)
        for field in ("ct", "iv", "ek"):
            tampered = dict(original)
            raw = base64.urlsafe_b64decode(tampered[field] + "=" * (-len(tampered[field]) % 4))
            tampered[field] = encode(bytes([raw[0] ^ 1]) + raw[1:])
            with self.subTest(field=field), self.assertRaises(TransferError):
                self.import_value(tampered)
        with self.assertRaises(TransferError):
            self.import_value(encrypted(self.manifest, aad=b"different-context"))
        self.assertFalse(self.runway_path.exists())
        self.import_value(original)

    def test_unknown_id_and_path_traversal_are_rejected(self):
        for transfer_id in ("0" * 32, "../runway", "A" * 32, "x" * 10000, None):
            value = encrypted(self.manifest)
            value["id"] = transfer_id
            with self.subTest(transfer_id=str(transfer_id)[:40]), self.assertRaises(TransferError):
                self.import_value(value)
        self.assertFalse(self.runway_path.exists())

    def test_expiration_at_boundary_destroys_private_transfer_key(self):
        with self.assertRaises(TransferError):
            import_transfer(self.pipeline, pack(encrypted(self.manifest)), now_epoch=START + TTL_SECONDS)
        self.assertFalse((self.session / "private.pem").exists())
        self.assertFalse(self.runway_path.exists())

    def test_schema_encoding_and_size_bounds_are_strict(self):
        original = encrypted(self.manifest)
        variants = [{**original, "v": True}, {**original, "v": 2}, {**original, "extra": "value"},
                    {key: value for key, value in original.items() if key != "ct"},
                    {**original, "iv": encode(b"x" * 13)}, {**original, "iv": encode(b"x" * 11)},
                    {**original, "ek": encode(b"x" * 385)}, {**original, "ek": encode(b"x" * 383)},
                    {**original, "ct": encode(b"x" * 2065)}, {**original, "ct": encode(b"x" * 23)},
                    {**original, "iv": original["iv"] + "="}, {**original, "ct": "!"},
                    {**original, "ct": None}]
        for index, variant in enumerate(variants):
            with self.subTest(index=index), self.assertRaises(TransferError):
                self.import_value(variant)
        for value in (SECRET, PREFIX + "!", PREFIX + "A", "x" * (MAX_ENVELOPE + 1),
                      PREFIX + encode(b'{"v":1,"v":1}'), PREFIX + encode(b"[]"), PREFIX + encode(b"\xff")):
            with self.assertRaises(TransferError):
                import_transfer(self.pipeline, value, now_epoch=START + 1)
        self.assertFalse(self.runway_path.exists())
        self.import_value(original)

    def test_non_256_bit_aes_is_rejected(self):
        with self.assertRaises(TransferError):
            self.import_value(encrypted(self.manifest, aes_length=16))
        self.assertFalse(self.runway_path.exists())

    def test_decrypted_plaintext_must_pass_runway_validation(self):
        for plaintext in (b"too-short"[:7], b"invalid key", b"invalid\nkey", b"\xff" * 10, b"x" * 2049):
            with self.subTest(length=len(plaintext)), self.assertRaises(TransferError) as error:
                self.import_value(encrypted(self.manifest, plaintext))
            self.assertNotIn(str(plaintext), str(error.exception))
        self.assertFalse(self.runway_path.exists())

    def test_existing_local_key_preserved_without_explicit_replace(self):
        previous = "rwy_FAKE_PREVIOUS_KEY_ONLY_0123456789"
        self.pipeline.runway.save_key(previous)
        before = self.runway_path.read_bytes()
        value = encrypted(self.manifest)
        with self.assertRaises(TransferError):
            self.import_value(value)
        self.assertEqual(self.runway_path.read_bytes(), before)
        self.assertTrue((self.session / "private.pem").exists())
        self.import_value(value, replace=True)
        self.assertEqual(json.loads(self.runway_path.read_text())["apiKey"], SECRET)

    def test_existing_environment_key_is_preserved_without_replace(self):
        with patch.dict(os.environ, {"RUNWAYML_API_SECRET": "rwy_FAKE_EXISTING_ENV_SECRET"}):
            with self.assertRaises(TransferError):
                self.import_value()
        self.assertFalse(self.runway_path.exists())

    def test_failed_save_consumes_transfer_and_hides_raw_exception(self):
        with patch.object(self.pipeline.runway, "save_key", side_effect=OSError(SECRET)):
            with self.assertRaises(TransferError) as error:
                self.import_value()
        self.assertNotIn(SECRET, str(error.exception))
        self.assertFalse((self.session / "private.pem").exists())
        self.assertEqual(json.loads((self.session / "metadata.json").read_text())["state"], "consumed")
        with self.assertRaises(TransferError):
            self.import_value(replace=True)

    def test_symlink_session_cannot_redirect_import(self):
        redirected = self.session.parent / ("0" * 32)
        redirected.symlink_to(self.session, target_is_directory=True)
        value = encrypted(self.manifest)
        value["id"] = "0" * 32
        with self.assertRaises(TransferError):
            self.import_value(value)
        self.assertFalse(self.runway_path.exists())

    def test_cli_uses_only_stdin_and_never_echoes_plaintext_or_raw_errors(self):
        output, errors = io.StringIO(), io.StringIO()
        with patch("sys.stdin", io.StringIO(SECRET)), redirect_stdout(output), redirect_stderr(errors):
            self.assertEqual(main(["--workspace", str(self.workspace), "import"]), 1)
        self.assertNotIn(SECRET, output.getvalue() + errors.getvalue())
        errors = io.StringIO()
        with redirect_stderr(errors), self.assertRaises(SystemExit):
            main(["--workspace", str(self.workspace), "import", SECRET])
        self.assertNotIn(SECRET, errors.getvalue())
        output, errors = io.StringIO(), io.StringIO()
        with patch("sys.stdin", io.StringIO(pack(encrypted(self.manifest)))), patch("secret_transfer.time.time", return_value=START + 1), \
                redirect_stdout(output), redirect_stderr(errors):
            self.assertEqual(main(["--workspace", str(self.workspace), "import"]), 0)
        self.assertTrue(json.loads(output.getvalue())["ok"])
        self.assertNotIn(SECRET, output.getvalue() + errors.getvalue())


if __name__ == "__main__":
    unittest.main()
