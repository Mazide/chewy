/* Compare two exported Rive files. All actual motion is authored in the files. */
(() => {
  const poses = ['Morning', 'Growing', 'Full'];
  const motion = 'Breeze';
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const entries = ['baseline', 'pilot'].map(version => ({version, canvas:document.querySelector(`canvas[data-version="${version}"]`), player:null, loaded:false, staticPose:false, freezeNext:false}));
  const errors = [];
  let stage=2, playing=!media.matches, disposed=false, sampling=false, revision=null;
  const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
  let resolveReady;
  const ready=new Promise(resolve=>{resolveReady=resolve;});
  function sync(){
    const loaded=entries.every(e=>e.loaded);
    document.querySelectorAll('[data-stage]').forEach(button=>{button.disabled=!loaded;button.setAttribute('aria-pressed',String(Number(button.dataset.stage)===stage));});
    document.querySelector('#playback').disabled=!loaded;
    document.querySelector('#playback').textContent=playing?'Пауза':'Воспроизвести';
    document.querySelector('#status').textContent=errors.length?'Не удалось загрузить сравнение.':!loaded?'Загружаем обе версии…':document.hidden?'Просмотр приостановлен.':playing?'Обе версии играют в настоящем Rive runtime.':'Движение остановлено. Стадии можно сравнить в статике.';
  }
  function stop(entry){entry.freezeNext=false;entry.player.pause();entry.player.stopRendering();}
  function freezeAfterDraw(entry){entry.freezeNext=true;entry.player.startRendering();}
  function still(entry,time=0){
    stop(entry);
    entry.player.reset({artboard:'PlantStates',animations:entry.version==='pilot'?[poses[stage],motion]:[poses[stage]],autoBind:true,autoplay:false});
    entry.staticPose=true;
    entry.player.scrub(poses[stage],entry.version==='baseline'?time:0);
    if(entry.version==='pilot')entry.player.scrub(motion,time);
    freezeAfterDraw(entry);
  }
  function play(entry){
    entry.freezeNext=false;
    if(entry.staticPose){
      entry.player.reset({artboard:'PlantStates',stateMachines:'PlantStates',autoBind:true,autoplay:false});
      entry.player.viewModelInstance.number('stage').value=stage;
      entry.player.play('PlantStates');
      entry.player.advanceAndReportChanges(0);
      entry.player.advanceAndReportChanges(.7);
      entry.staticPose=false;
    }else entry.player.play('PlantStates');
    entry.player.startRendering();
  }
  function setStage(value){
    if(!Number.isInteger(value)||value<0||value>2)throw new RangeError('Unknown plant stage');
    stage=value;
    for(const entry of entries){if(!entry.loaded)continue;if(!playing||document.hidden)still(entry);else entry.player.viewModelInstance.number('stage').value=stage;}
    sync();
  }
  function pause(){playing=false;for(const entry of entries)if(entry.loaded)stop(entry);sync();}
  function resume(){playing=true;for(const entry of entries)if(entry.loaded&&!document.hidden)play(entry);sync();}
  async function capture(value,time){
    if(!Number.isFinite(time)||time<0)throw new RangeError('Invalid sample time');
    if(!Number.isInteger(value)||value<0||value>2)throw new RangeError('Unknown plant stage');
    await ready;pause();sampling=true;stage=value;
    for(const entry of entries)still(entry,time);
    await nextFrame();await nextFrame();await nextFrame();
    for(const entry of entries)stop(entry);
    sampling=false;sync();return state();
  }
  function state(){return {ready:entries.every(e=>e.loaded),stage,playing:playing&&!document.hidden,reducedMotion:media.matches,errors:[...errors],revision};}
  function fail(error){errors.push(String(error.message||error));document.querySelector('#error').hidden=false;document.querySelector('#error p').textContent=`Не удалось открыть пробу: ${error.message||error}`;sync();resolveReady(state());}
  async function mount(entry,url){
    const response=await fetch(url);if(!response.ok)throw new Error(`Файл ${entry.version} недоступен (${response.status})`);
    const buffer=await response.arrayBuffer();
    return new Promise((resolve,reject)=>{
      const player=new rive.Rive({buffer,canvas:entry.canvas,artboard:'PlantStates',stateMachines:'PlantStates',autoBind:true,autoplay:false,enableRiveAssetCDN:false,shouldDisableRiveListeners:true,
        drawingOptions:rive.DrawOptimizationOptions.AlwaysDraw,layout:new rive.Layout({fit:rive.Fit.Contain,alignment:rive.Alignment.Center}),
        onLoad:()=>queueMicrotask(()=>{
          if(disposed)return;
          try{
            if(!player.viewModelInstance?.number('stage'))throw new Error('В Rive отсутствует stage');
            entry.loaded=true;player.resizeDrawingSurfaceToCanvas();
            entry.staticPose=true;
            if(playing&&!document.hidden)play(entry);else still(entry);
            resolve();
          }catch(error){reject(error);}
        }),
        onAdvance:()=>{if(entry.freezeNext){entry.freezeNext=false;entry.player.pause();entry.player.stopRendering();}},
        onLoadError:()=>reject(new Error(`Rive не открыл ${entry.version}`)),
      });entry.player=player;
    });
  }
  async function start(){
    if(!window.rive)throw new Error('Не найден локальный Rive runtime');
    rive.RuntimeLoader.setWasmUrl(new URL('../vendor/rive.wasm',location.href).href);
    rive.RuntimeLoader.setWasmFallbackUrl(new URL('../vendor/rive_fallback.wasm',location.href).href);
    const requested=new URL(location.href).searchParams.get('run');
    let runDir;
    if(requested){if(!/^[A-Za-z0-9_-]+$/.test(requested))throw new Error('Некорректный номер сборки');runDir=`runs/${requested}`;revision=requested;}
    else{const response=await fetch('../exports/latest.json',{cache:'no-store'});if(!response.ok)throw new Error('Сначала выполните сборку pipeline.py');const latest=await response.json();runDir=latest.run_dir;revision=latest.run_id||runDir;}
    if(!/^runs\/[A-Za-z0-9_-]+$/.test(runDir))throw new Error('Некорректный путь выпуска');
    const base=new URL(`../exports/${runDir}/`,location.href);
    document.querySelector('#revision').textContent=revision;
    document.querySelector('#manifest').href=new URL('manifest.json',base).href;
    await rive.RuntimeLoader.awaitInstance();
    await Promise.all(entries.map(entry=>mount(entry,new URL(entry.version==='pilot'?'plants.riv':'baseline-plants.riv',base).href)));
    sync();resolveReady(state());
  }
  document.querySelectorAll('[data-stage]').forEach(button=>button.addEventListener('click',()=>setStage(Number(button.dataset.stage))));
  document.querySelector('#playback').addEventListener('click',()=>playing?pause():resume());
  document.querySelector('#size').addEventListener('click',event=>{
    const small=document.querySelector('.comparison').classList.toggle('small');event.currentTarget.setAttribute('aria-pressed',String(small));event.currentTarget.textContent=small?'Посмотреть крупно':'В размере лагеря';
  });
  document.querySelector('#retry').addEventListener('click',()=>location.reload());
  media.addEventListener('change',event=>{if(event.matches){playing=false;entries.forEach(entry=>{if(entry.loaded)still(entry);});sync();}});
  document.addEventListener('visibilitychange',()=>{for(const entry of entries){if(!entry.loaded)continue;if(document.hidden)stop(entry);else if(playing)play(entry);}sync();});
  const observer=new ResizeObserver(()=>{if(sampling)return;for(const entry of entries){if(!entry.loaded)continue;entry.player.resizeDrawingSurfaceToCanvas();if(!playing||document.hidden)freezeAfterDraw(entry);}});
  entries.forEach(entry=>observer.observe(entry.canvas));
  window.addEventListener('pagehide',()=>{disposed=true;observer.disconnect();entries.forEach(entry=>entry.player?.cleanup());},{once:true});
  window.motionPilot=Object.freeze({ready,state,setStage,pause,resume,capture});
  sync();start().catch(fail);
})();
