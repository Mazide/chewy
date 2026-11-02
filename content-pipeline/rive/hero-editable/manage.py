#!/usr/bin/env python3
"""Export the editable hero or safely import a manually corrected .rev."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / "camp-scene-vector"))
from editable_hero import validate_hero_document


def run(arguments):
    subprocess.run(arguments, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rive", default=shutil.which("rive") or "/tmp/chewy-rive-cli/bin/rive")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("export", help="Export an editable .rev; requires Rive login")
    importer = subparsers.add_parser("import", help="Validate and accept an edited .rev, keeping a backup")
    importer.add_argument("file", type=Path)
    args = parser.parse_args()
    if args.command == "export":
        validate_hero_document(ET.parse(ROOT / "scene.rml").getroot())
        (ROOT / "exports").mkdir(exist_ok=True)
        run([args.rive, str(ROOT), "--verify"])
        run([args.rive, str(ROOT), "--once", f"--rev={ROOT / 'exports/hero-editable.rev'}"])
        print(ROOT / "exports/hero-editable.rev")
        return

    source = args.file.expanduser().resolve(strict=True)
    if source.suffix.lower() != ".rev":
        parser.error("Expected an editable .rev file, not a runtime .riv.")
    with tempfile.TemporaryDirectory(prefix="chewy-hero-import-") as directory:
        candidate = Path(directory) / "candidate"
        run([args.rive, "create", str(candidate), f"--from-rev={source}"])
        markup = candidate / "scene.rml"
        if list(candidate.rglob("*.rml")) != [markup]:
            raise ValueError("Expected one scene.rml containing only the Hero artboard.")
        forbidden = [p for p in candidate.rglob("*") if p.suffix in {".luau", ".as", ".wgsl"}]
        if forbidden:
            raise ValueError("Contour editing must not introduce scripts or shaders.")
        validate_hero_document(ET.parse(markup).getroot())
        run([args.rive, str(candidate), "--verify"])
        inspection = subprocess.run([args.rive, "inspect", str(candidate), "--summary"], check=True, capture_output=True, text=True)
        if json.loads(inspection.stdout).get("problems"):
            raise ValueError(f"Rive inspect reported problems; source unchanged:\n{inspection.stdout}")
        # CLI may write IDs back during validation; accept those exact bytes.
        validate_hero_document(ET.parse(markup).getroot())
        history = ROOT / "history"
        history.mkdir(exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S.%fZ")
        backup = history / f"hero-{stamp}.rml.bak"
        shutil.copyfile(ROOT / "scene.rml", backup)
        pending = ROOT / ".scene.rml.pending"
        pending.write_bytes(markup.read_bytes())
        pending.replace(ROOT / "scene.rml")
        print(f"Imported edited Hero. Previous source: {backup}")
        print("Rebuild the camp to preview the corrected hero; the original Python drawing is no longer used.")


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as error:
        raise SystemExit(error.returncode) from None
