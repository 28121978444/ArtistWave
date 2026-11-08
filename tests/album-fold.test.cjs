'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const styles=fs.readFileSync('styles.css','utf8');
const begin=source.indexOf("// Browsing compactness is independent");
const end=source.indexOf("function render(){",begin);
assert.ok(begin>0&&end>begin);
function fixture(stored=[]){
  const data=new Map([['artistwave:collapsed-albums:v1',JSON.stringify(stored)]]);
  const sections=[];
  const foldAll={textContent:'',disabled:false,attributes:{},setAttribute(k,v){this.attributes[k]=v},addEventListener(type,fn){this[type]=fn}};
  const tree={querySelectorAll:()=>sections};
  const sandbox={localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},Set,JSON,Array,
    $:id=>id==='albumFoldAll'?foldAll:tree};
  const mod=vm.runInNewContext(source.slice(begin,end)+
    '\n;({albumFoldKey,updateAlbumFold,updateAlbumFoldAll,toggleAllAlbums,getCollapsed:()=>collapsedAlbums})',sandbox);
  function makeSection(key,label,collapsed=false){
    const attrs={};
    const classNames=new Set(collapsed?['album-collapsed']:[]);
    const rows={hidden:collapsed};
    const button={textContent:'',title:'',attributes:attrs,setAttribute:(k,v)=>{attrs[k]=v}};
    const section={dataset:{albumKey:key,albumLabel:label},classList:{
      toggle:(name,on)=>on?classNames.add(name):classNames.delete(name),
      contains:name=>classNames.has(name)},querySelector:sel=>sel==='.album-tracks'?rows:button};
    sections.push(section);
    return {section,rows,button,classes:classNames};
  }
  return {mod,foldAll,sections,makeSection,data};
}
test('each album has a disclosure control linked to its track list',()=>{
  assert.match(html,/id="albumFoldAll"/);
  assert.match(source,/foldButton\.setAttribute\('aria-controls',rowsId\)/);
  assert.match(source,/rows\.id=rowsId/);
  assert.match(source,/updateAlbumFold\(section,rows,foldButton,collapsed\)/);
  assert.match(source,/foldButton\.onclick=/);
  assert.match(styles,/\.album-tracks\[hidden\]\{display:none!important\}/);
  assert.match(styles,/\.album-group\.album-collapsed \.album-header/);
});
test('collapsed album keeps tracks hidden, exposes expanded semantics and restores saved state',()=>{
  const f=fixture(['discover|artist|album']);
  const key=f.mod.albumFoldKey('discover',{key:'artist|album'});
  assert.equal(key,'discover|artist|album');
  assert.equal(f.mod.getCollapsed().has(key),true);
  const item=f.makeSection(key,'My Album');
  f.mod.updateAlbumFold(item.section,item.rows,item.button,true);
  assert.equal(item.rows.hidden,true);
  assert.equal(item.button.attributes['aria-expanded'],'false');
  assert.match(item.button.textContent,/Show tracks/);
  f.mod.updateAlbumFold(item.section,item.rows,item.button,false);
  assert.equal(item.rows.hidden,false);
  assert.equal(item.button.attributes['aria-expanded'],'true');
});
test('collapse all and expand all affect the visible albums and persist',()=>{
  const f=fixture();
  const a=f.makeSection('discover|a','Album A');
  const b=f.makeSection('discover|b','Album B');
  f.mod.updateAlbumFoldAll();
  assert.equal(f.foldAll.textContent,'▴ Collapse all');
  f.mod.toggleAllAlbums();
  assert.ok(a.rows.hidden&&b.rows.hidden);
  assert.equal(f.foldAll.textContent,'▾ Expand all');
  assert.deepEqual(JSON.parse(f.data.get('artistwave:collapsed-albums:v1')).sort(),['discover|a','discover|b']);
  f.mod.toggleAllAlbums();
  assert.ok(!a.rows.hidden&&!b.rows.hidden);
  assert.deepEqual(JSON.parse(f.data.get('artistwave:collapsed-albums:v1')),[]);
});
test('compact mode maintains independent album play button and one line on mobile',()=>{
  assert.match(source,/header\.append\(button\);[\s\S]*header\.append\(foldButton\)/);
  assert.match(styles,/@media\(max-width:700px\)\{\s*\.album-group\.album-collapsed \.album-header\{flex-wrap:nowrap\}/);
  assert.match(styles,/\[data-theme="day"\] \.album-fold-button/);
});
