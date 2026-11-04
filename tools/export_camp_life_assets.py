"""Pack the original 512px RGBA frames with one fixed crop, without resizing."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'content-pipeline/workspace/exports/camp-life-2026-10-29'
DEST = ROOT / 'prototype/public/assets/camp-life'
clips = {}
for kind in ['tent', 'flowers', 'lantern', 'bird', 'butterfly']:
    paths = sorted((SOURCE / kind / 'frames').glob('frame_*.png'))
    boxes = [Image.open(path).getbbox() for path in paths]
    crop = [max(0,min(b[0] for b in boxes)-2),max(0,min(b[1] for b in boxes)-2),min(512,max(b[2] for b in boxes)+2),min(512,max(b[3] for b in boxes)+2)]
    width, height = crop[2]-crop[0],crop[3]-crop[1]
    atlas = Image.new('RGBA',(8*width,((len(paths)+7)//8)*height))
    for i,path in enumerate(paths):
        frame=Image.open(path).crop(crop)
        atlas.paste(frame,((i%8)*width,(i//8)*height))
        if i==0: frame.save(DEST/kind/'poster.png')
    atlas.save(DEST/kind/'atlas.webp',lossless=True)
    clips[kind]=dict(fps=24,count=len(paths),columns=8,width=width,height=height,crop=[0,0,width,height],file='atlas.webp')
    (DEST/kind/'source.json').write_text(json.dumps(dict(source=str((SOURCE/kind/'frames').relative_to(ROOT)),processing='Original 512px RGBA frames; fixed union crop with 2px margin; lossless packing, no scaling or retiming',sourceCrop=crop,frameCount=len(paths)),indent=2)+'\n')
    print(kind,width,height,flush=True)
metadata = ROOT / 'prototype/src/core/camp-life.json'
current = json.loads(metadata.read_text())
current.update(clips)
metadata.write_text(json.dumps(current,indent=2)+'\n')
