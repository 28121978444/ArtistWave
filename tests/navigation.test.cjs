'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const script=fs.readFileSync('navigation.js','utf8');
const start=script.indexOf('  function parseYouTubeUrl(');
const end=script.indexOf('  function stopVideo()',start);
assert.ok(start>0&&end>start);
const parse=vm.runInNewContext(script.slice(start,end)+'\nparseYouTubeUrl',{URL});
test('YouTube video URL variants use the official embed endpoint',()=>{
  assert.equal(parse('https://www.youtube.com/watch?v=M7lc1UVf-VE'),'https://www.youtube.com/embed/M7lc1UVf-VE');
  assert.equal(parse('https://youtu.be/M7lc1UVf-VE?t=10'),'https://www.youtube.com/embed/M7lc1UVf-VE');
  assert.equal(parse('https://www.youtube.com/shorts/M7lc1UVf-VE'),'https://www.youtube.com/embed/M7lc1UVf-VE');
  assert.equal(parse('https://music.youtube.com/watch?v=M7lc1UVf-VE'),'https://www.youtube.com/embed/M7lc1UVf-VE');
});
test('YouTube playlist uses official videoseries visible player',()=>{
  assert.equal(parse('https://www.youtube.com/playlist?list=PL1234567890ABC'),'https://www.youtube.com/embed/videoseries?list=PL1234567890ABC');
});
test('unsafe and non-video links cannot reach the embed',()=>{
  for(const value of ['javascript:alert(1)','http://youtube.com/watch?v=M7lc1UVf-VE','https://youtube.com.evil.test/watch?v=M7lc1UVf-VE',
    'https://example.com/watch?v=M7lc1UVf-VE','https://youtube.com/watch?v=bad-id','abc','https://www.youtube.com/results?search_query=hello'])
    assert.equal(parse(value),null,value);
});
test('top-level navigation keeps account on right and local library tools collapsed',()=>{
  for(const id of ['modeAudio','studioNav','modeYoutube','youtubeWorkspace','youtubeLinkForm','youtubeFrame','youtubeSearchForm'])
    assert.ok(html.includes('id="'+id+'"'),id);
  const top=html.slice(html.indexOf('<header class="topbar">'),html.indexOf('</header>'));
  assert.ok(top.indexOf('class="mode-tabs"')<top.indexOf('class="top-right"'));
  assert.ok(top.includes('id="accountMenu"'));
  assert.ok(html.includes('<details class="sidebar-local-tools"'));
  assert.ok(html.includes('<script src="navigation.js" defer>'));
  const player=html.match(/<iframe id="youtubeFrame"[^>]*>/);
  assert.ok(player&&player[0].includes('allowfullscreen'));
});

test('switching Studio → YouTube → Entertainment hides inactive workspaces and scrolls to top',()=>{
  const nodes=new Map(),scrolls=[],calls=[];
  const make=id=>{
    const handlers={},classes=new Set();
    return {
      id,hidden:id==='studioWorkspace'||id==='youtubeWorkspace',
      dataset:{},value:'',textContent:'',handlers,
      classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),toggle:(x,on)=>on?classes.add(x):classes.delete(x),contains:x=>classes.has(x)},
      addEventListener:(event,fn)=>{(handlers[event]??=[]).push(fn)},
      setAttribute(){},removeAttribute(name){if(name==='src')this.src=''},
      click(){for(const fn of handlers.click||[])fn({preventDefault(){}})}
    };
  };
  const document={
    body:{dataset:{}},
    getElementById(id){if(!nodes.has(id))nodes.set(id,make(id));return nodes.get(id)}
  };
  const studio={open:()=>calls.push('open'),close:()=>calls.push('close'),stop:()=>calls.push('stop')};
  const window={
    ArtistWaveStudio:studio,
    ArtistWaveStudioHost:{pauseMain:()=>{},render:()=>{}},
    scrollTo:options=>scrolls.push(options)
  };
  vm.runInNewContext(script,{document,window,URL});
  const el=id=>document.getElementById(id);
  el('studioNav').click();
  assert.equal(document.body.dataset.mode,'studio');
  assert.equal(el('studioWorkspace').hidden,false);
  assert.equal(el('youtubeWorkspace').hidden,true);
  el('modeYoutube').click();
  assert.equal(document.body.dataset.mode,'youtube');
  assert.equal(el('studioWorkspace').hidden,true);
  assert.equal(el('youtubeWorkspace').hidden,false);
  el('modeAudio').click();
  assert.equal(document.body.dataset.mode,'audio');
  assert.equal(el('studioWorkspace').hidden,true);
  assert.equal(el('youtubeWorkspace').hidden,true);
  assert.equal(el('discoverSection').hidden,false);
  assert.equal(el('playlistSection').hidden,false);
  assert.equal(el('modeAudio').classList.contains('active'),true);
  assert.equal(scrolls.length,3);
  assert.equal(scrolls[2].top,0);
  assert.deepEqual(calls,['open','close','stop','close']);
});
test('short workspaces do not center the main content vertically',()=>{
  const css=fs.readFileSync('styles.css','utf8');
  assert.match(css,/body\[data-mode="youtube"\] \.main\s*\{\s*margin:0 auto;/);
  assert.match(css,/body\[data-mode="audio"\] \.studio-workspace/);
});

test('YouTube shows Google connection without claiming iframe login',()=>{
  const nodes=new Map();
  const make=id=>({
    id,textContent:'',hidden:false,dataset:{},
    classList:{toggle(){},add(){},remove(){}},
    addEventListener(){},removeAttribute(){},setAttribute(){}
  });
  const document={body:{dataset:{}},getElementById(id){if(!nodes.has(id))nodes.set(id,make(id));return nodes.get(id)}};
  let signed=false;
  const window={ArtistWaveCloud:{isSignedIn:()=>signed},scrollTo(){}};
  vm.runInNewContext(script,{document,window,URL});
  assert.match(document.getElementById('youtubeAccountStatus').textContent,/separate browser session/);
  signed=true;window.ArtistWaveNavigation.updateYouTubeAccount();
  assert.match(document.getElementById('youtubeAccountStatus').textContent,/existing YouTube browser session/);
  assert.match(document.getElementById('youtubeAccountHeading').textContent,/Google connected/);
  assert.doesNotMatch(document.getElementById('youtubeAccountStatus').textContent,/automatically signed into YouTube/);
  signed=false;window.ArtistWaveNavigation.updateYouTubeAccount();
  assert.match(document.getElementById('youtubeAccountStatus').textContent,/separate browser session/);
});
test('YouTube sign-in continuation opens the real site instead of a hidden iframe',()=>{
  const markup=fs.readFileSync('index.html','utf8');
  assert.match(markup,/<a id="youtubeSignInLink" href="https:\/\/www.youtube.com\/" target="_blank" rel="noopener noreferrer">/);
  assert.ok(!script.includes('https://www.googleapis.com/auth/youtube.readonly'));
});
