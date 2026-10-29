// Isolated demo fixture; never touches the owner's browser storage.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const frames = process.argv[2] ?? '/tmp/chewy-fixed-camp';
await mkdir(frames, { recursive:true });
const browser = await chromium.launch({ headless:true });
try {
  const page = await browser.newPage({ viewport:{width:520,height:1100}, deviceScaleFactor:2, timezoneId:'Europe/London' });
  page.on('pageerror', error => { throw error; });
  const button = name => page.getByRole('button',{name,exact:true});
  await page.clock.install({time:new Date('2026-10-29T12:00:00Z')});
  await page.goto('http://localhost:6006/iframe.html?id=core-sandbox--all-screens&viewMode=story');
  await button('Добавить еду').click(); await button('Сфотографировать еду').click();
  await button('Сохранить и разобрать').click(); await button('Рюкзак').waitFor();
  await button('Инструменты пробы').click(); await button('Завершить анализ').click();
  await page.evaluate(() => {
    const key='chewy.demo-session.v1', session=JSON.parse(localStorage.getItem(key));
    session.inventory.owned=['flowers','lantern']; session.inventory.applied={garden:'flowers',decor:'lantern'};
    session.jobs.forEach(job => { job.seen=true; });
    localStorage.setItem(key,JSON.stringify(session));
  });
  await page.reload(); await button('Инструменты пробы').waitFor();
  await page.waitForFunction(() => document.querySelectorAll('canvas[data-frame]').length === 6);
  await page.clock.pauseAt(new Date('2026-10-29T12:00:30Z'));
  const scene=page.locator('.sandbox-phone');
  for(let i=0;i<288;i++) {
    await page.clock.runFor(1000/24);
    await page.evaluate(time => document.getAnimations().forEach(animation => { animation.pause(); animation.currentTime=time; }),i*1000/24);
    await scene.screenshot({path:`${frames}/frame-${String(i).padStart(3,'0')}.png`});
  }
} finally { await browser.close(); }
