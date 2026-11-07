/* The canvases play exported Rive state machines; the page only sets stage. */
(() => {
  const poses = ['Morning', 'Growing', 'Full'];
  const labels = ['Начало дня', 'В процессе', 'Полное'];
  const specs = [
    { id:'tent', name:'Палатка', board:'TentStates', mapping:'Белок · обустройство', text:['Полусложенная палатка: ткань лежит низко, опоры ещё не подняты.','Каркас поднимается, ткань постепенно расправляется.','Палатка полностью собрана, ткань слегка колышется.'] },
    { id:'campfire', name:'Костёр', board:'CampfireStates', mapping:'Углеводы · огонь', text:['Небольшое пламя между знакомыми поленьями.','Огонь поднимается и становится ярче.','Полное пламя с яркой сердцевиной.'] },
    { id:'plants', name:'Растения', board:'PlantStates', mapping:'Овощи и фрукты · зелень', text:['Маленький росток среди травы.','Больше стеблей и листьев, первая ромашка.','Пышная зелень и несколько ромашек.'] },
    { id:'lamp', name:'Масляная лампа', board:'LampStates', mapping:'Жиры · масло и свет', text:['На дне резервуара немного масла, фитиль светится слабо.','Масла становится больше, огонёк и свет усиливаются.','Наполненный резервуар и яркое мягкое свечение.'] },
  ];
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let playing = !media.matches, disposed = false;
  const entries = specs.map(spec => {
    const card = document.createElement('section'); card.className='card'; card.dataset.asset=spec.id;
    card.innerHTML=`<h2>${spec.name}</h2><p class="mapping">${spec.mapping}</p><div class="canvas-wrap" aria-busy="true"><canvas aria-label="${spec.name}"></canvas></div><p class="description" aria-live="polite"></p><div class="stages" role="group" aria-label="${spec.name}: состояние"></div><div class="error" role="alert" hidden><p></p><button>Загрузить снова</button></div>`;
    document.querySelector('#cards').append(card);
    const entry={...spec,card,canvas:card.querySelector('canvas'),stage:0,player:null,vm:null,loaded:false,error:null,serial:0,freezeNext:false,staticPose:false};
    labels.forEach((label,stage)=>{const button=document.createElement('button');button.textContent=label;button.addEventListener('click',()=>set(entry.id,stage));card.querySelector('.stages').append(button);});
    card.querySelector('.error button').addEventListener('click',()=>mount(entry));
    return entry;
  });
  const allButtons=labels.map((label,stage)=>{const button=document.createElement('button');button.textContent=label;button.addEventListener('click',()=>setAll(stage));document.querySelector('.all-stages').append(button);return button;});

  function sync() {
    for(const entry of entries){
      entry.card.querySelector('.description').textContent=entry.text[entry.stage];
      entry.card.querySelector('.canvas-wrap').setAttribute('aria-busy',String(!entry.loaded&&!entry.error));
      entry.card.querySelectorAll('.stages button').forEach((button,i)=>{button.disabled=!entry.loaded;button.setAttribute('aria-pressed',String(entry.stage===i));});
      entry.canvas.setAttribute('aria-label',`${entry.name}: ${entry.text[entry.stage]}`);
    }
    const ready=entries.every(entry=>entry.loaded);
    allButtons.forEach((button,i)=>{button.disabled=!ready;button.setAttribute('aria-pressed',String(entries.every(entry=>entry.stage===i)));});
    document.querySelector('#morning').disabled=!ready;
    document.querySelector('#playback').disabled=!entries.some(entry=>entry.loaded);
    document.querySelector('#playback').textContent=playing?'Пауза':'Воспроизвести';
    document.querySelector('#status').textContent=entries.some(entry=>entry.error)?'Один из предметов не загрузился. Можно повторить загрузку.':!ready?'Загружаем предметы…':document.hidden?'Просмотр приостановлен.':playing?'Движение включено. Ступени можно выбирать независимо.':'Движение остановлено. Все ступени можно сравнить в статике.';
  }
  function freeze(entry){
    if(!entry.loaded)return;
    entry.player.pause();entry.freezeNext=true;entry.player.startRendering();
  }
  function drawStill(entry){
    // A paused state machine does not flush linear-animation geometry in this
    // runtime. Render the same file's named pose on a standalone artboard.
    entry.freezeNext=false;entry.player.pause();entry.player.stopRendering();
    entry.player.reset({artboard:entry.board,animations:poses[entry.stage],autoBind:true,autoplay:false});
    entry.vm=entry.player.viewModelInstance;entry.vm.number('stage').value=entry.stage;
    entry.staticPose=true;entry.freezeNext=true;
    entry.player.scrub(poses[entry.stage],0);entry.player.startRendering();
  }
  function play(entry){
    entry.freezeNext=false;
    if(entry.staticPose){
      entry.player.reset({artboard:entry.board,stateMachines:entry.board,autoBind:true,autoplay:false});
      entry.vm=entry.player.viewModelInstance;entry.vm.number('stage').value=entry.stage;
      entry.staticPose=false;entry.player.play(entry.board);
      entry.player.advanceAndReportChanges(0);entry.player.advanceAndReportChanges(.65);entry.player.advanceAndReportChanges(.65);
    }else entry.player.play(entry.board);
    entry.player.startRendering();
  }
  function apply(){for(const entry of entries){if(!entry.loaded)continue;if(playing&&!document.hidden)play(entry);else freeze(entry);}sync();}
  function set(id,stage){
    if(!Number.isInteger(stage)||stage<0||stage>=labels.length)throw new RangeError('Unknown stage');
    const entry=entries.find(entry=>entry.id===id);if(!entry)throw new RangeError('Unknown asset');
    entry.stage=stage;
    if(entry.loaded){entry.vm.number('stage').value=stage;if(!playing||document.hidden)drawStill(entry);}
    sync();
  }
  function setAll(stage){for(const entry of entries)set(entry.id,stage);}
  function fail(entry,message){entry.loaded=false;entry.error=message;entry.card.querySelector('.error p').textContent=message;entry.card.querySelector('.error').hidden=false;sync();}
  async function mount(entry){
    const serial=++entry.serial;entry.loaded=false;entry.error=null;entry.vm=null;
    if(entry.player){entry.player.cleanup();entry.player=null;}
    entry.card.querySelector('.error').hidden=true;sync();
    try{
      if(!window.rive)throw new Error('Не загрузился Rive. Обнови страницу.');
      rive.RuntimeLoader.setWasmUrl('/hero-actions/vendor/rive.wasm');
      rive.RuntimeLoader.setWasmFallbackUrl('/hero-actions/vendor/rive_fallback.wasm');
      const response=await fetch(`/camp-states/exports/${entry.id}.riv`);
      if(!response.ok)throw new Error('Не найден файл предмета. Повтори загрузку.');
      const buffer=await response.arrayBuffer();await rive.RuntimeLoader.awaitInstance();
      if(disposed||serial!==entry.serial)return;
      const player=new rive.Rive({buffer,canvas:entry.canvas,artboard:entry.board,stateMachines:entry.board,autoBind:true,autoplay:false,enableRiveAssetCDN:false,shouldDisableRiveListeners:true,
        drawingOptions:rive.DrawOptimizationOptions.AlwaysDraw,
        layout:new rive.Layout({fit:rive.Fit.Contain,alignment:rive.Alignment.Center}),
        onLoad:()=>queueMicrotask(()=>{
          if(disposed||serial!==entry.serial)return;
          entry.vm=player.viewModelInstance;
          if(!entry.vm?.number('stage')){fail(entry,'В файле отсутствует управление состоянием.');return;}
          entry.loaded=true;entry.vm.number('stage').value=entry.stage;player.resizeDrawingSurfaceToCanvas();
          if(playing&&!document.hidden)player.play(entry.board);else drawStill(entry);sync();
        }),
        onAdvance:()=>{if(entry.freezeNext){entry.freezeNext=false;entry.player.pause();entry.player.stopRendering();}},
        onLoadError:()=>{if(serial===entry.serial&&!disposed)fail(entry,'Rive не смог открыть предмет. Повтори загрузку.');},
      });entry.player=player;
    }catch(error){if(serial===entry.serial&&!disposed)fail(entry,error.message);}
  }
  document.querySelector('#playback').addEventListener('click',()=>{playing=!playing;apply();});
  document.querySelector('#morning').addEventListener('click',()=>setAll(0));
  media.addEventListener('change',event=>{if(event.matches){playing=false;apply();}});
  document.addEventListener('visibilitychange',apply);
  const observer=new ResizeObserver(()=>{for(const entry of entries){if(!entry.loaded)continue;entry.player.resizeDrawingSurfaceToCanvas();if(!playing||document.hidden)freeze(entry);}});
  entries.forEach(entry=>observer.observe(entry.canvas));
  window.addEventListener('pagehide',()=>{disposed=true;observer.disconnect();entries.forEach(entry=>{++entry.serial;entry.player?.cleanup();});},{once:true});
  window.chewyCampStates=Object.freeze({set,setAll,pause(){playing=false;apply();},resume(){playing=true;apply();},state:()=>Object.fromEntries(entries.map(entry=>[entry.id,{stage:entry.vm?.number('stage')?.value??entry.stage,ready:entry.loaded,error:entry.error,playing:entry.loaded&&playing&&!document.hidden}]))});
  sync();entries.forEach(mount);
})();
