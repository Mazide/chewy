#!/usr/bin/env python3
"""Arrange unmodified browser captures of the actual Rive runtime for review."""
from pathlib import Path
import subprocess
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parent
source=Path('/tmp/chewy-camp-states')
output=ROOT.parents[2]/'docs/exports/chewy-camp-states-2026-11-06.png'


def font(size,bold=False):
    file=subprocess.check_output(['fc-match','-f','%{file}','Noto Sans:style=Bold' if bold else 'Noto Sans'],text=True)
    return ImageFont.truetype(file,size)


page=Image.new('RGB',(1740,1160),'#f5f1e7'); draw=ImageDraw.Draw(page)
draw.text((34,26),'Лагерь · пять состояний в Rive',font=font(36,True),fill='#3e382c')
draw.text((36,80),'Палатка, припасы и растения — новые пробы. Костёр — прежний образец.',font=font(20),fill='#777264')
for index,label in enumerate(['Спящее','Начало','Активное','Живое','С запасом']):
    draw.text((220+index*298+140,136),label,font=font(22,True),fill='#46583b',anchor='mt')
for row,(slug,label,note) in enumerate([('tent','Палатка','Белок'),('provisions','Рюкзак','Связь обсуждаем'),('plants','Растения','Овощи и фрукты'),('campfire','Костёр','Прежняя проба')]):
    y=190+row*228
    draw.text((34,y+56),label,font=font(25,True),fill='#3e382c')
    draw.text((34,y+94),note,font=font(16),fill='#777264')
    for stage in range(5):
        tile=Image.open(source/f'{slug}-{stage}.png').convert('RGB')
        tile.thumbnail((282,180),Image.Resampling.LANCZOS)
        page.paste(tile,(220+stage*298,y+(180-tile.height)//2))
draw.text((36,1115),'Черновой арт · ручной выбор состояний · пищевые пороги не заданы',font=font(19),fill='#777264')
page.save(output)
print(output)
