#!/usr/bin/env python3
"""Verify and compile saved RML without regenerating or overwriting authored art."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

ROOT=Path(__file__).resolve().parent


def run(command):
    result=subprocess.run(command,capture_output=True,text=True)
    if result.returncode:
        raise RuntimeError(result.stdout+result.stderr)
    return result.stdout


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--rive',default=shutil.which('rive') or '/tmp/chewy-rive-cli/bin/rive')
    args=parser.parse_args()
    exports=ROOT/'exports'; exports.mkdir(exist_ok=True)
    assets={}
    for slug,board in [('tent','TentStates'),('provisions','ProvisionsStates'),('plants','PlantStates')]:
        folder=ROOT/slug; source=(folder/'scene.rml').read_bytes()
        verification=json.loads(run([args.rive,str(folder),'--verify','--format=json']).splitlines()[-1])
        assert verification['success'] and not verification['warnings']
        inspection=json.loads(run([args.rive,'inspect',str(folder),'--summary']))
        assert not inspection['problems']
        assert inspection['artboards'][0]['types']['AnimationState']==5
        run([args.rive,str(folder),'--once'])
        assert (folder/'scene.rml').read_bytes()==source,'Compilation changed the authored source'
        shutil.copyfile(folder/'build'/f'{slug}.riv',exports/f'{slug}.riv')
        assets[slug]={'artboard':board,'state_machine':board,'view_model':board,'property':'stage','values':[0,1,2,3,4],'initial':0,'source_sha256':hashlib.sha256(source).hexdigest(),'bytes':(exports/f'{slug}.riv').stat().st_size,'verify_errors':0,'verify_warnings':0,'inspect_problems':[]}
        print(f'{slug}: saved source verified and compiled',flush=True)
    fire=ROOT.parent/'campfire/exports/campfire.riv'
    shutil.copyfile(fire,exports/'campfire.riv')
    assets['campfire']={'source':'../campfire/exports/campfire.riv','sha256':hashlib.sha256(fire.read_bytes()).hexdigest(),'artboard':'Campfire','property':'stage','values':[0,1,2,3,4],'asset_default':2,'viewer_initial':0,'status':'existing unapproved study'}
    manifest={'date':'2026-11-06','renderer':'Rive CLI 1.8.0','status':'draft-for-owner-review','assets':assets,'gameplay_thresholds':False,'native_tested':False,'final_art':False}
    (exports/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')


if __name__=='__main__': main()
