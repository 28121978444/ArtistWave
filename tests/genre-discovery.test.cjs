'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const start=source.indexOf('const RAP_ERAS=');
const end=source.indexOf('const expandedGenre=',start);
const helpers=source.indexOf('function genreSearchMatches(');
const helperEnd=source.indexOf('function renderGenreTree()',helpers);
assert.ok(start>0&&end>start&&helpers>end&&helperEnd>helpers);

const norm=value=>String(value||'').normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const {MUSIC_GENRES,genreSearchMatches,matchingGenreEras}=vm.runInNewContext(
  source.slice(start,end)+source.slice(helpers,helperEnd)+'\n;({MUSIC_GENRES,genreSearchMatches,matchingGenreEras})',
  {norm,Number,Object}
);
test('preserves legacy genres while adding broad casual listening styles',()=>{
  const names=MUSIC_GENRES.map(g=>g.name);
  for(const name of ['Jazz','Rock','Rap','Reggae','Dance Pop','Latin Dance','Pop','R&B & Soul',
    'Blues','Country & Americana','Folk & Acoustic','Indie & Alternative','Punk, Emo & Ska',
    'Electronic & Chill','Ambient & Lo-fi','Classical & Piano','Global & World','Latin & Caribbean'])
    assert.ok(names.includes(name),name);
  assert.equal(new Set(names).size,names.length);
  assert.ok(names.length>=20);
});
test('all added genres have non-empty substyles and artist suggestions',()=>{
  for(const genre of MUSIC_GENRES){
    assert.ok(genre.sections.length>0,genre.name);
    for(const section of genre.sections){
      const eras=Object.entries(section.eras);
      assert.ok(eras.length>0,genre.name+': '+section.name);
      for(const [era,artists] of eras){
        assert.ok(artists.length>0,era);
        for(const [artist,note] of artists){
          assert.ok(artist.length>0&&note.length>0,era);
        }
      }
    }
  }
});
test('genre search matches genre, styles, artists, descriptions and folds accents',()=>{
  const pop=MUSIC_GENRES.find(g=>g.name==='Pop');
  const world=MUSIC_GENRES.find(g=>g.name==='Global & World');
  const blues=MUSIC_GENRES.find(g=>g.name==='Blues');
  assert.equal(genreSearchMatches(pop,norm('pop')),true);
  assert.equal(genreSearchMatches(pop,norm('Sabrina Carpenter')),true);
  assert.equal(genreSearchMatches(blues,norm('Delta')),true);
  assert.equal(genreSearchMatches(world,norm('Fanfare Ciocarlia')),true);
  assert.equal(genreSearchMatches(pop,norm('unknown style 234')),false);
  const sections=world.sections[0];
  const matches=matchingGenreEras(world,sections,norm('Balkan'));
  assert.equal(matches.length,1);
  assert.equal(matches[0][0],'Balkan & Eastern Europe');
});
test('sidebar has accessible genre filter and clear button',()=>{
  for(const id of ['genreFilter','genreFilterCount','genreFilterClear','genreTree'])
    assert.ok(html.includes('id="'+id+'"'),id);
  assert.ok(html.indexOf('id="genreFilter"')<html.indexOf('id="genreTree"'));
  assert.match(source,/\$\('genreFilter'\)\.addEventListener\('input',renderGenreTree\)/);
});

test('Surprise Me chooses curated artists and respects genre filters',()=>{
  const start=source.indexOf('const discoveryHistory=[];');
  const end=source.indexOf('function surpriseArtist(){',start);
  assert.ok(start>0&&end>start);
  const helpers=source.slice(start,end);
  const functions=vm.runInNewContext(helpers+'\n;({discoverableArtists,pickSurpriseArtist})',
    {genreSearchMatches,matchingGenreEras,norm,Number,Math,Set});
  const rock=functions.discoverableArtists(MUSIC_GENRES,norm('Blues'));
  assert.ok(rock.length>0);
  assert.ok(rock.every(p=>p.genre.name==='Blues'||p.style.toLowerCase().includes('blues')||
    p.name.toLowerCase().includes('blues')||p.section.name.toLowerCase().includes('blues')));
  const noMatches=functions.discoverableArtists(MUSIC_GENRES,'never heard of this synthetic style');
  assert.equal(noMatches.length,0);
  const only=functions.discoverableArtists(MUSIC_GENRES,norm('Sabrina Carpenter'));
  assert.ok(only.length>=1);
  assert.ok(only.some(x=>x.name==='Sabrina Carpenter'));
  assert.ok(only.every(x=>x.name==='Sabrina Carpenter'));
});
test('Surprise Me avoids previous artists when choices are available',()=>{
  const start=source.indexOf('function pickSurpriseArtist(');
  const end=source.indexOf('function surpriseArtist(){',start);
  const f=vm.runInNewContext(source.slice(start,end)+'\npickSurpriseArtist',{norm,Number,Math,Set});
  const picks=[{name:'One'},{name:'Two'},{name:'Three'}];
  assert.equal(f(picks,['one'],()=>0).name,'Two');
  assert.equal(f(picks,['one','two'],()=>0).name,'Three');
  assert.equal(f(picks,['one','two','three'],()=>0).name,'One');
  assert.equal(f([],[],()=>0),null);
  assert.ok(html.includes('id="surpriseArtist"'));
  assert.ok(html.includes('id="surpriseArtistHelp"'));
  assert.match(source,/\$\('surpriseArtist'\)\.addEventListener\('click',surpriseArtist\)/);
});
