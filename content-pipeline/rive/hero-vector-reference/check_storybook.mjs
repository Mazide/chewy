// Smoke test the packaged Storybook entry, not only the standalone preview.
import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require=createRequire(new URL('../../../prototype/package.json',import.meta.url));
const {chromium}=require('playwright');
const root=fileURLToPath(new URL('../../../prototype/storybook-static/',import.meta.url));
const evidence=fileURLToPath(new URL('./evidence/',import.meta.url));
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
  try{
    const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if(!file.startsWith(root))throw new Error('outside build');
    res.setHeader('Content-Type',types[path.extname(file)]??'application/octet-stream');
    res.end(await readFile(file));
  }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1200,height:980},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const url=`http://127.0.0.1:${server.address().port}/iframe.html?id=workshop--hero-vector-reference&viewMode=story`;
  await page.goto(url);
  const frame=page.frameLocator('iframe[title="Чуви: видео как опора для векторного рига"]');
  await frame.locator('canvas[data-version="rive"]').waitFor();
  const loaded=await frame.locator('body').evaluate(async()=>{
    await window.heroVectorReference.ready;
    return window.heroVectorReference.state();
  });
  assert.equal(loaded.ready,true,JSON.stringify(loaded));
  assert.deepEqual(loaded.errors,[]);
  await frame.getByRole('button',{name:'Конечная поза',exact:true}).click();
  await frame.getByRole('button',{name:'Взгляд на время',exact:true}).click();
  const state=await frame.locator('body').evaluate(()=>window.heroVectorReference.state());
  assert.equal(state.ready,true);
  assert.deepEqual(state.errors,[]);
  assert.equal(await frame.locator('canvas').count(),2);
  assert.deepEqual(errors,[]);
  await mkdir(evidence,{recursive:true});
  await writeFile(path.join(evidence,'storybook.json'),JSON.stringify({passed:true,story:'workshop--hero-vector-reference',errors,controls:true},null,2)+'\n');
  console.log('PASS: built Storybook entry, actual Rive canvases, pose controls, no browser errors');
}finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
