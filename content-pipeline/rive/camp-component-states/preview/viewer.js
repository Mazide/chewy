/* The canvases play exported Rive state machines; the page only sets stage. */
(() => {
  const labels = ['Спящее', 'Начало', 'Активное', 'Живое', 'С запасом'];
  const specs = [
    { id:'tent', name:'Палатка', board:'TentStates', mapping:'Белок · обустройство', text:['Вход прикрыт, ткань отдыхает.','Вход приоткрывается, ткань слегка шевелится.','Полог поднят наполовину, палатка оживает.','Вход почти открыт, ткань заметно движется.','Вход раскрыт полностью, ткань свободно колышется.'] },
    { id:'provisions', name:'Рюкзак', board:'ProvisionsStates', mapping:'Припасы · углеводы пока под вопросом', text:['Мягкий закрытый рюкзак.','Из рюкзака выглядывает первый свёрток.','Внутри устроились несколько свёртков.','Рюкзак наполнен, припасы чуть покачиваются.','Ещё несколько свёртков уложены сверху.'] },
    { id:'plants', name:'Растительность', board:'PlantStates', mapping:'Овощи и фрукты · растения', text:['Компактный зелёный росток в том же горшке.','Росток расправляется и слегка покачивается.','Раскрываются боковые побеги и листья.','Зелень становится пышнее, раскрывается цветок.','Пышная зелень и несколько раскрытых цветов.'] },
    { id:'campfire', name:'Костёр', board:'Campfire', mapping:'Прежняя проба · для сравнения', text:['Уложенные поленья и тёмные угли.','Небольшое пламя и тёплые угли.','Пламя поднимается, появляется светлая сердцевина.','Полное пламя с редкими искрами.','Полный огонь и запас дров сбоку.'] },
  ];
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let playing = !media.matches, disposed = false;
  const entries = specs.map(spec => {
    const card = document.createElement('section'); card.className='card'; card.dataset.asset=spec.id;
    card.innerHTML=`<h2>${spec.name}</h2><p class="mapping">${spec.mapping}</p><div class="canvas-wrap" aria-busy="true"><canvas aria-label="${spec.name}"></canvas></div><p class="description" aria-live="polite"></p><div class="stages" role="group" aria-label="${spec.name}: состояние"></div><div class="error" role="alert" hidden><p></p><button>Загрузить снова</button></div>`;
    document.querySelector('#cards').append(card);
    const entry={...spec,card,canvas:card.querySelector('canvas'),stage:0,player:null,vm:null,loaded:false,error:null,serial:0,freezeNext:false,settle:0};
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
  function freeze(entry,insideAdvance=false){
    if(!entry.loaded)return;
    entry.player.pause();entry.player.stopRendering();
    if(!insideAdvance)entry.player.drawFrame();
    entry.player.stopRendering();
  }
  function drawStill(entry){entry.freezeNext=true;entry.settle=.5;entry.player.play(entry.board);}
  function apply(){for(const entry of entries){if(!entry.loaded)continue;if(playing&&!document.hidden){entry.freezeNext=false;entry.player.play(entry.board);}else freeze(entry);}sync();}
  function set(id,stage){
    if(!Number.isInteger(stage)||stage<0||stage>4)throw new RangeError('Unknown stage');
    const entry=entries.find(entry=>entry.id===id);if(!entry)throw new RangeError('Unknown asset');
    entry.stage=stage;
    if(entry.loaded){entry.vm.number('stage').value=stage;if(!playing||document.hidden)drawStill(entry);}
    sync();
  }
  function setAll(stage){for(const entry of entries)set(entry.id,stage);}
  function fail(entry,message){entry.loaded=false;entry.error=message;entry.card.querySelector('.error p').textContent=message;entry.card.querySelector('.error').hidden=false;sync();}
  async function mount(entry){
    const serial=++entry.serial;entry.loaded=false;entry.error=null;entry.vm=null;entry.freezeNext=false;entry.settle=0;
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
        onAdvance:()=>{
          if(!entry.freezeNext||!entry.loaded)return;
          // Manual advances emit onAdvance too; finish the blend before freezing.
          entry.freezeNext=false;
          if(entry.settle){const delta=entry.settle;entry.settle=0;player.advanceAndReportChanges(0);player.advanceAndReportChanges(delta);player.advanceAndReportChanges(delta);}
          freeze(entry,true);
        },
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
