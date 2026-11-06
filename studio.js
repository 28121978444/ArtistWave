'use strict';
/* ArtistWave Showdance Studio: routine planner and live section rehearsal.
 * No file export/rehosting. All competition duration limits are user-configured. */
(function(){
  const $=id=>document.getElementById(id);
  const music=$('studioAudio');
  const STORE='artistwave:studio-routines:v1';
  const makeId=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():('routine-'+Date.now()+'-'+Math.random().toString(36).slice(2));
  const trimText=(value,max=90)=>String(value||'').trim().slice(0,max);
  const seconds=value=>Math.max(0,Math.min(9000,Number.isFinite(Number(value))?Number(value):0));
  const asClock=time=>Math.floor(time/60)+':'+String(Math.floor(time%60)).padStart(2,'0');
  const norm=value=>trimText(value,250).normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const safeTrack=t=>{
    if(!t||!t.title||!t.artist)return null;
    const source=['LOCAL','ARCHIVE','AUDIUS','JAMENDO'].includes(t.source)?t.source:'ARCHIVE';
    const url=source!=='LOCAL'&&/^https:\/\//.test(t.url||'')?String(t.url).slice(0,1800):'';
    return {id:trimText(t.id,300),artist:trimText(t.artist,160),title:trimText(t.title,160),
      collection:trimText(t.collection,160),source,url};
  };
  const cleanSegment=(segment,index)=>{
    const track=safeTrack(segment?.track);
    if(!track)return null;
    const start=seconds(segment.start),end=seconds(segment.end);
    return {id:trimText(segment.id,120)||'section-'+index,track,start,
      end:Math.max(start+1,Math.min(9000,end||start+30)),cue:trimText(segment.cue,120)};
  };
  const cleanRoutines=input=>Array.isArray(input)?input.slice(0,75).filter(x=>x&&typeof x==='object').map((r,i)=>({
    id:trimText(r.id,120)||'routine-'+i,
    name:trimText(r.name,90)||'Untitled routine',
    athlete:trimText(r.athlete,90),
    discipline:['Artistic gymnastics','Rhythmic gymnastics','Acrobatic gymnastics','Dance / showdance','Group gymnastics','Other gym performance'].includes(r.discipline)?r.discipline:'Artistic gymnastics',
    target:Math.max(15,Math.min(900,Math.round(Number(r.target)||90))),
    segments:(Array.isArray(r.segments)?r.segments:[]).slice(0,30).map(cleanSegment).filter(Boolean)
  })):[];
  const blank=()=>({id:makeId(),name:'New gym routine',athlete:'',discipline:'Artistic gymnastics',target:90,segments:[]});
  const state={routines:[],selected:'',playing:false,playIndex:-1,playToken:0,loading:false,guestSnapshot:[]};
  try{state.routines=cleanRoutines(JSON.parse(localStorage.getItem(STORE)||'[]'))}catch{}
  const host=()=>window.ArtistWaveStudioHost||{};
  const active=()=>state.routines.find(r=>r.id===state.selected)||null;
  const collectTracks=()=>{
    const library=(host().tracks?.()||[]).filter(t=>t&&t.url&&t.artist&&t.title);
    const distinct=new Map();
    for(const t of library){
      const key=norm(t.artist)+'|'+norm(t.title)+'|'+t.source;
      if(!distinct.has(key))distinct.set(key,t);
    }
    return [...distinct.values()].slice(0,6000);
  };
  const resolveTrack=reference=>{
    const available=collectTracks();
    return available.find(t=>t.id===reference.id&&t.source===reference.source)||
      available.find(t=>norm(t.artist)===norm(reference.artist)&&norm(t.title)===norm(reference.title)&&t.source===reference.source)||
      (reference.source!=='LOCAL'&&/^https:\/\//.test(reference.url||'')?reference:null);
  };
  function status(message,error=false){
    $('studioPlaybackStatus').textContent=message;
    $('studioPlaybackStatus').classList.toggle('error',error);
  }
  function storeChanges(){
    const snapshot=cleanRoutines(state.routines);
    if(!window.ArtistWaveCloud?.isSignedIn?.()){
      try{localStorage.setItem(STORE,JSON.stringify(snapshot))}catch{status('Unable to save routines in this browser.',true)}
    }else window.ArtistWaveCloud.changed();
    render();
  }
  function stop(){
    state.playToken++;
    state.playing=false;state.playIndex=-1;
    music.pause();music.removeAttribute('src');music.load();
    $('studioPlay').disabled=false;
    status('Ready to rehearse');
  }
  function startSection(index,token){
    if(token!==state.playToken)return;
    const routine=active(),segment=routine?.segments[index];
    if(!segment){stop();status('Routine rehearsal completed');return}
    const track=resolveTrack(segment.track);
    if(!track||!track.url){stop();status('Section '+(index+1)+' is unavailable. Reopen the local music folder or search this song.',true);return}
    state.playIndex=index;
    status('Section '+(index+1)+'/'+routine.segments.length+' · '+(segment.cue||segment.track.title));
    $('studioPlay').disabled=true;
    state.loading=true;
    music.src=track.url;
    music.load();
    const begin=()=>{
      if(token!==state.playToken)return;
      if(Number.isFinite(music.duration)&&segment.start>=music.duration){
        stop();status('Section '+(index+1)+' begins beyond this audio file’s duration.',true);return;
      }
      try{music.currentTime=segment.start}catch{}
      const result=music.play();
      if(result?.catch)result.catch(()=>{if(token===state.playToken){stop();status('Could not play section '+(index+1)+'. Try a local file.',true)}});
    };
    if(music.readyState>=1)begin();
    else music.onloadedmetadata=begin;
    render();
  }
  function play(){
    const routine=active();
    if(!routine?.segments.length){status('Add a song section before rehearsing.',true);return}
    host().pauseMain?.();
    stop();
    state.playing=true;
    startSection(0,state.playToken);
  }
  function updateTime(){
    if(!state.playing)return;
    const routine=active(),segment=routine?.segments[state.playIndex];
    if(!segment)return;
    if(music.currentTime>=segment.end-0.04){
      const token=state.playToken;
      startSection(state.playIndex+1,token);
    }
  }
  music.addEventListener('timeupdate',updateTime);
  music.addEventListener('ended',()=>{if(state.playing)startSection(state.playIndex+1,state.playToken)});
  music.addEventListener('error',()=>{if(state.playing){const section=state.playIndex+1;stop();status('Audio error in section '+section+'. Reopen or replace its track.',true)}});
  function addRoutine(){
    stop();
    const r=blank();
    state.routines.unshift(r);state.selected=r.id;
    storeChanges();
    $('studioName').focus();
  }
  function selectRoutine(id){
    if(!state.routines.some(r=>r.id===id))return;
    stop();state.selected=id;render();
  }
  function editRoutine(){
    const r=active();if(!r)return;
    r.name=trimText($('studioName').value,90)||'Untitled routine';
    r.athlete=trimText($('studioAthlete').value,90);
    r.discipline=$('studioDiscipline').value;
    r.target=Math.max(15,Math.min(900,Math.round(Number($('studioTarget').value)||90)));
    storeChanges();
  }
  function addTrack(){
    const r=active(),tracks=collectTracks();
    if(!r)return;
    if(r.segments.length>=30){status('Each routine supports up to 30 sections.',true);return}
    const track=tracks[Number($('studioTrackSelect').value)];
    if(!track){status('Find an artist or add a music folder, then choose a song.',true);return}
    r.segments.push({id:makeId(),track:safeTrack(track),start:0,end:30,cue:''});
    storeChanges();
  }
  function editSegment(id,changes){
    const r=active(),segment=r?.segments.find(x=>x.id===id);
    if(!segment)return;
    Object.assign(segment,changes);
    segment.start=seconds(segment.start);
    segment.end=Math.max(segment.start+1,Math.min(9000,seconds(segment.end)));
    segment.cue=trimText(segment.cue,120);
    storeChanges();
  }
  function moveSegment(id,direction){
    const list=active()?.segments;if(!list)return;
    const i=list.findIndex(s=>s.id===id),j=i+direction;
    if(i<0||j<0||j>=list.length)return;
    stop();[list[i],list[j]]=[list[j],list[i]];storeChanges();
  }
  function removeSegment(id){
    const r=active();if(!r)return;
    stop();r.segments=r.segments.filter(s=>s.id!==id);storeChanges();
  }
  function field(label,value,min,max,step,handler){
    const wrap=document.createElement('label');wrap.className='studio-segment-field';
    const span=document.createElement('span');span.textContent=label;
    const input=document.createElement('input');input.type='number';input.min=String(min);input.max=String(max);
    input.step=String(step);input.value=String(value);
    input.addEventListener('change',()=>handler(input.value));wrap.append(span,input);return wrap;
  }
  function renderSegments(r){
    const container=$('studioSegments');container.replaceChildren();
    if(!r?.segments.length){
      const empty=document.createElement('p');empty.className='studio-empty';
      empty.textContent='No sections yet. Search for music in ArtistWave, then add it here.';
      container.append(empty);return;
    }
    r.segments.forEach((seg,i)=>{
      const row=document.createElement('article');row.className='studio-segment';
      const header=document.createElement('div');header.className='studio-segment-header';
      const caption=document.createElement('strong');caption.textContent=(i+1)+'. '+seg.track.title;
      const badge=document.createElement('span');badge.className='studio-segment-source';badge.textContent=seg.track.artist+' · '+seg.track.source;
      header.append(caption,badge);
      const controls=document.createElement('div');controls.className='studio-segment-fields';
      controls.append(
        field('Start (sec)',seg.start,0,9000,0.1,v=>editSegment(seg.id,{start:Number(v)})),
        field('End (sec)',seg.end,1,9000,0.1,v=>editSegment(seg.id,{end:Number(v)}))
      );
      const cue=document.createElement('label');cue.className='studio-segment-cue';
      const cueText=document.createElement('span');cueText.textContent='Choreography cue';
      const cueInput=document.createElement('input');cueInput.maxLength=120;cueInput.value=seg.cue||'';
      cueInput.placeholder='e.g. first tumbling pass';cueInput.addEventListener('change',()=>editSegment(seg.id,{cue:cueInput.value}));
      cue.append(cueText,cueInput);controls.append(cue);
      const actions=document.createElement('div');actions.className='studio-segment-actions';
      for(const [label,title,fn] of [['↑','Move section earlier',()=>moveSegment(seg.id,-1)],['↓','Move section later',()=>moveSegment(seg.id,1)],['×','Remove section',()=>removeSegment(seg.id)]]){
        const button=document.createElement('button');button.type='button';button.textContent=label;button.title=title;button.setAttribute('aria-label',title+' '+seg.track.title);button.onclick=fn;
        actions.append(button);
      }
      row.append(header,controls,actions);
      container.append(row);
    });
  }
  function render(){
    const current=active();
    const select=$('studioRoutineSelect'),previous=state.selected;
    select.replaceChildren();
    const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Choose a routine';select.append(placeholder);
    for(const r of state.routines){const o=document.createElement('option');o.value=r.id;o.textContent=r.name+' · '+(r.athlete||r.discipline);select.append(o)}
    select.value=previous;
    $('studioName').value=current?.name||'';
    $('studioAthlete').value=current?.athlete||'';
    $('studioDiscipline').value=current?.discipline||'Artistic gymnastics';
    $('studioTarget').value=String(current?.target||90);
    const trackSelect=$('studioTrackSelect'),old=trackSelect.value,tracks=collectTracks();
    trackSelect.replaceChildren();
    if(!tracks.length){const o=document.createElement('option');o.value='';o.textContent='Search for music or open a local folder first';trackSelect.append(o)}
    tracks.forEach((t,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=t.artist+' — '+t.title+' ['+t.source+']';trackSelect.append(o)});
    if(tracks[Number(old)])trackSelect.value=old;
    $('studioAddTrack').disabled=!current||!tracks.length;
    $('studioDelete').disabled=!current;
    $('studioSave').disabled=!current;
    renderSegments(current);
    const total=(current?.segments||[]).reduce((sum,s)=>sum+Math.max(0,s.end-s.start),0);
    const target=current?.target||90;
    $('studioTotal').textContent=asClock(total)+' / '+asClock(target);
    $('studioDurationFill').style.width=Math.min(100,total/target*100)+'%';
    $('studioDurationFill').classList.toggle('over-target',total>target);
    $('studioTimingStatus').textContent=current?.segments.length?
      (total>target?'⚠ Routine exceeds the target by '+asClock(total-target)+'.':
        'Planned time '+asClock(total)+'. '+asClock(Math.max(0,target-total))+' remaining.'):
      'Add music sections from your current playlist or favorites.';
  }
  function open(){
    $('studioWorkspace').hidden=false;
    for(const id of ['discoverSection','playlistSection','genreResults','albumJump'])$(id).hidden=true;
    $('locationName').textContent='Showdance Studio';
    $('studioNav').classList.add('active');
    render();$('studioWorkspace').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function close(){
    stop();$('studioWorkspace').hidden=true;
    for(const id of ['discoverSection','playlistSection'])$(id).hidden=false;
    $('albumJump').hidden=false;
    $('studioNav').classList.remove('active');
    $('locationName').textContent='Discover';
    host().render?.();
  }
  function cloudLoad(data){
    stop();
    state.routines=cleanRoutines(data);
    state.selected=state.routines[0]?.id||'';
    render();
  }
  function init(){
    if(!state.routines.length){state.routines=[blank()];state.selected=state.routines[0].id}
    else state.selected=state.routines[0].id;
    $('studioNav').onclick=open;$('studioClose').onclick=close;
    $('studioNew').onclick=addRoutine;
    $('studioRoutineSelect').onchange=e=>selectRoutine(e.target.value);
    $('studioSave').onclick=editRoutine;
    $('studioDelete').onclick=()=>{
      const r=active();if(!r||!window.confirm('Delete routine "'+r.name+'"?'))return;
      stop();state.routines=state.routines.filter(x=>x.id!==r.id);
      if(!state.routines.length)state.routines.push(blank());
      state.selected=state.routines[0].id;storeChanges();
    };
    for(const name of ['studioName','studioAthlete','studioDiscipline','studioTarget'])
      $(name).addEventListener('change',editRoutine);
    $('studioAddTrack').onclick=addTrack;
    $('studioPlay').onclick=play;$('studioStop').onclick=stop;
    window.addEventListener('artistwave:cloud-load',e=>{
      if(Array.isArray(e.detail?.routines))cloudLoad(e.detail.routines);
    });
    window.ArtistWaveCloud.getRoutines=()=>cleanRoutines(state.routines);
    window.ArtistWaveStudio={open,close,stop,cleanRoutines,resolveTrack,getRoutines:()=>state.routines};
    render();
  }
  init();
})();
