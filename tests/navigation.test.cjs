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
