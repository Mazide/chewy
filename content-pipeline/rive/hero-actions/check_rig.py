#!/usr/bin/env python3
"""Compile the saved source and prove independent controls in the real runtime.

Does not regenerate scene.rml. Frame comparisons test visible behaviour, not
only the presence of motion/wardrobe properties in an XML document.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parent / "hero-wardrobe/references/hero-from-editor.rml"


def run(command):
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(f"Command failed: {command}\n{result.stdout}\n{result.stderr}")
    return result.stdout


def pixels(path):
    return np.array(Image.open(path).convert("RGB"), dtype=np.int16)


def delta(a, b):
    values = np.abs(a-b)
    return {"changed_pixels": int((values.max(axis=2)>3).sum()), "mean_channel_delta": float(values.mean())}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rive", default=shutil.which("rive") or "/tmp/chewy-rive-cli/bin/rive")
    args = parser.parse_args()
    source_before, rig_before = SOURCE.read_bytes(), (ROOT/"scene.rml").read_bytes()
    manifest = json.loads((ROOT/"manifest.json").read_text())
    assert hashlib.sha256(source_before).hexdigest() == manifest["source_sha256"]
    document = ET.fromstring(rig_before)
    assert not list(document.iter("ImageAsset")), "The rig must stay vectors, not a baked image"
    assert not list(document.iter("ScriptAsset")), "No scripts or external signing requirement in this proof"
    verify = json.loads(run([args.rive, str(ROOT), "--verify", "--format=json"]).splitlines()[-1])
    assert verify["success"] and not verify["warnings"]
    inspection = json.loads(run([args.rive, "inspect", str(ROOT), "--json"]))
    assert not inspection["problems"], inspection["problems"]
    run([args.rive, str(ROOT), "--once"])
    exports = ROOT/"exports"
    exports.mkdir(exist_ok=True)
    shutil.copyfile(ROOT/"build/hero-actions.riv", exports/"hero-actions.riv")
    report = {"renderer": "Rive CLI 1.8.0", "verify_errors": 0, "verify_warnings": 0,
              "inspect_problems": [], "same_rig_two_outfits": True, "results": {},
              "native_tested": False, "final_art": False}
    with tempfile.TemporaryDirectory(prefix="chewy-rig-proof-") as tmp:
        temporary = Path(tmp)

        def capture(label, controls, publish=False):
            target = (exports if publish else temporary)/f"{label}.png"
            data = temporary/f"{label}.json"
            run([args.rive, str(ROOT), *controls, f"--screenshot={target}", f"--data-dump={data}"])
            properties = json.loads(data.read_text())["viewModel"]["properties"]
            return pixels(target), {item["name"]: item["value"] for item in properties}

        for outfit in ["camp", "trail"]:
            for action in ["idle", "walk", "sit", "reach"]:
                _, state = capture(f"{outfit}-{action}", [f"--data=action={action}", f"--data=outfit={outfit}",
                    "--data=prop=stick", "--advance=60"], publish=True)
                assert (state["action"], state["outfit"], state["prop"]) == (action, outfit, "stick")

        baseline, _ = capture("walk-baseline", ["--data=action=walk", "--advance=152"])
        switched, state = capture("walk-outfit-return", ["--data=action=walk", "--advance=60", "--data=outfit=trail",
            "--advance=30", "--data=outfit=camp", "--advance=60"])
        report["results"]["outfit_does_not_restart_walk"] = delta(baseline, switched)
        assert report["results"]["outfit_does_not_restart_walk"]["changed_pixels"] == 0
        assert state["action"] == "walk" and state["outfit"] == "camp"

        prop_return, _ = capture("walk-prop-return", ["--data=action=walk", "--advance=60", "--data=prop=stick",
            "--advance=30", "--data=prop=none", "--advance=60"])
        report["results"]["prop_does_not_restart_walk"] = delta(baseline, prop_return)
        assert report["results"]["prop_does_not_restart_walk"]["changed_pixels"] == 0

        idle, _ = capture("idle-baseline", ["--data=outfit=trail", "--data=prop=stick", "--advance=194"])
        returned, state = capture("sit-to-idle", ["--data=action=sit", "--data=outfit=trail", "--data=prop=stick",
            "--advance=90", "--data=action=idle", "--advance=193"], publish=True)
        report["results"]["sit_to_idle_complete_pose"] = delta(idle, returned)
        assert report["results"]["sit_to_idle_complete_pose"]["changed_pixels"] == 0
        assert (state["action"],state["outfit"],state["prop"]) == ("idle","trail","stick")

        a, _ = capture("walk-loop-a", ["--data=action=walk", "--advance=30"])
        b, _ = capture("walk-loop-b", ["--data=action=walk", "--advance=78"])
        report["results"]["walk_loop"] = delta(a,b)
        assert report["results"]["walk_loop"]["changed_pixels"] == 0
        c, _ = capture("walk-motion", ["--data=action=walk", "--advance=42"])
        report["results"]["walk_moves_limbs"] = delta(a,c)
        assert report["results"]["walk_moves_limbs"]["changed_pixels"] > 1000

        for action in ["idle", "sit", "reach"]:
            a, _ = capture(f"{action}-feet-a", [f"--data=action={action}","--advance=60"])
            b, _ = capture(f"{action}-feet-b", [f"--data=action={action}","--advance=105"])
            report["results"][f"{action}_feet_stable"] = delta(a[950:,:,:],b[950:,:,:])
            assert report["results"][f"{action}_feet_stable"]["changed_pixels"] == 0

        initial, _ = capture("root-initial", ["--data=action=walk", "--advance=152"])
        shifted, state = capture("root-shifted", ["--data=action=walk", "--advance=60", "--data=rootX=750", "--advance=91"])
        report["results"]["root_translation_independent"] = delta(initial[:,:-50,:],shifted[:,50:,:])
        assert report["results"]["root_translation_independent"]["changed_pixels"] == 0
        assert state["action"] == "walk" and state["rootX"] == 750
        _, state = capture("interrupt-sit", ["--data=action=walk", "--data=outfit=trail", "--advance=45", "--data=action=sit",
            "--advance=4", "--data=action=reach", "--data=prop=stick", "--advance=60"], publish=True)
        assert (state["action"],state["outfit"],state["prop"]) == ("reach","trail","stick")
        report["results"]["mid_transition_interruption"] = "walk → sit interrupted → reach, outfit and prop retained"

        # All advertised preview placements must fit with the longest prop,
        # including the mirrored reach. The background is a single solid colour.
        minimum_clearance = 10000
        edge_cases = 0
        for outfit in ["camp", "trail"]:
            for action in ["idle", "walk", "sit", "reach"]:
                for facing in [-1, 1]:
                    for root_x in manifest["preview_safe_root_x"]:
                        frame, _ = capture(f"bounds-{outfit}-{action}-{facing}-{root_x}", [
                            f"--data=action={action}", f"--data=outfit={outfit}", "--data=prop=stick",
                            f"--data=facing={facing}", f"--data=rootX={root_x}", "--advance=60"])
                        foreground = np.abs(frame-frame[0,0]).max(axis=2)>3
                        ys,xs = np.where(foreground)
                        clearance = min(int(xs.min()),frame.shape[1]-1-int(xs.max()),
                                        int(ys.min()),frame.shape[0]-1-int(ys.max()))
                        assert clearance>4, (outfit,action,facing,root_x,clearance)
                        minimum_clearance = min(minimum_clearance,clearance)
                        edge_cases += 1
        report["results"]["advertised_placement_bounds"] = {
            "combinations":edge_cases,"minimum_edge_clearance_px":minimum_clearance,
            "root_x_range":manifest["preview_safe_root_x"],"facing":[-1,1],"prop":"stick"}

    assert SOURCE.read_bytes() == source_before, "The original must not change"
    assert (ROOT/"scene.rml").read_bytes() == rig_before, "Validation must not regenerate the editable rig"
    report["source_unchanged"] = True
    report["editable_rig_unchanged"] = True
    report["riv_bytes"] = (exports/"hero-actions.riv").stat().st_size
    (exports/"qa.json").write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report,indent=2))


if __name__ == "__main__":
    main()
