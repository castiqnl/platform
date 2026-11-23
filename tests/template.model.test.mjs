import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createStudio,FORMATS,CASTIQ_PARTNER_LAYER_ID,getCastiqPartnerLayer} from '../src/template-studio/studio-model.mjs';
import {resizeSelection} from '../src/template-studio/resize-selection.mjs';

const seeds=JSON.parse(readFileSync(new URL('../src/template-studio/builtin-templates.json',import.meta.url),'utf8'));
const model=()=>createStudio(null,{templates:seeds,includeFixtures:false});
const bounds=layers=>({x:Math.min(...layers.map(l=>l.x)),y:Math.min(...layers.map(l=>l.y)),width:Math.max(...layers.map(l=>l.x+l.width))-Math.min(...layers.map(l=>l.x)),height:Math.max(...layers.map(l=>l.y+l.height))-Math.min(...layers.map(l=>l.y))});

test('27 exact SVG families each have four independent layouts and a single fixed partner layer',()=>{
 assert.equal(seeds.length,27);
 for(const seed of seeds)for(const format of Object.keys(FORMATS)){const layers=model().getLayers(seed.id,format);assert.equal(layers.filter(layer=>layer.id===CASTIQ_PARTNER_LAYER_ID).length,1);assert.deepEqual(layers.at(-1),getCastiqPartnerLayer(format));assert.notDeepEqual(layers,seeds[0].versions[0].layouts[format==='4:5'?'9:16':'4:5']);}
});
test('partner layer cannot move, hide, unlock, group, delete or reorder, including after draft and version reopening',()=>{
 const studio=model(),id=seeds[0].id;
 for(const format of Object.keys(FORMATS)){const fixed=studio.getLayers(id,format).at(-1);studio.updateLayer(id,format,fixed.id,{x:0,visible:false,locked:false,text:'https://invalid.example/changed.svg'});studio.removeLayer(id,format,fixed.id);studio.reorderLayer(id,format,fixed.id,-1);assert.equal(studio.groupLayers(id,format,['label',fixed.id]),null);assert.deepEqual(studio.getLayers(id,format).at(-1),fixed);}
 studio.saveDraft(id);const version=studio.publishDraft(id);for(const format of Object.keys(FORMATS))assert.deepEqual(version.layouts[format].at(-1),getCastiqPartnerLayer(format));
});
test('locked positions stay fixed while style changes remain possible; grouping and stack moves preserve complete units',()=>{
 const studio=model(),id=seeds[0].id,format='4:5';
 const before=studio.getLayers(id,format).find(l=>l.id==='club');studio.updateLayer(id,format,'club',{locked:true});studio.updateLayer(id,format,'club',{x:0,width:10,rotation:30,color:'#123456'});const locked=studio.getLayers(id,format).find(l=>l.id==='club');assert.equal(locked.x,before.x);assert.equal(locked.width,before.width);assert.equal(locked.rotation,before.rotation);assert.equal(locked.color,'#123456');
 const group=studio.groupLayers(id,format,['label','score'],'Twee tekstlagen');assert(group);studio.reorderLayers(id,format,['label'],1);let layers=studio.getLayers(id,format);assert.equal(layers.findIndex(l=>l.id==='score'),layers.findIndex(l=>l.id==='label')+1);studio.saveDraft(id);layers=studio.getLayers(id,format);assert(layers.filter(l=>l.groupId===group.id).every(l=>l.groupName==='Twee tekstlagen'));studio.ungroupLayers(id,format,['score']);assert(studio.getLayers(id,format).filter(l=>['label','score'].includes(l.id)).every(l=>!l.groupId));
});
test('one-format edits stay independent and publication keeps immutable prior snapshot layouts',()=>{
 const studio=model(),id=seeds[0].id,old=studio.getPublishedLayers(id,'4:5',1),story=studio.getLayers(id,'9:16');studio.updateLayer(id,'4:5','label',{text:'Nieuwe titel'});studio.saveDraft(id);assert.deepEqual(studio.getLayers(id,'9:16'),story);const v2=studio.publishDraft(id);assert.equal(v2.number,2);assert.deepEqual(studio.getPublishedLayers(id,'4:5',1),old);assert.equal(v2.layouts['4:5'].find(l=>l.id==='label').text,'Nieuwe titel');
});
test('text effects clamp to safe limits without altering unselected shape or another format',()=>{
 const studio=model(),id=seeds[0].id;const story=studio.getLayers(id,'9:16');studio.updateLayers(id,'4:5',['label','score'],{outlineEnabled:true,outlineWidth:41,shadowEnabled:true,shadowBlur:999,shadowOffsetX:-300,shadowOpacity:2});const layers=studio.getLayers(id,'4:5');for(const layer of layers.filter(l=>['label','score'].includes(l.id))){assert.equal(layer.outlineWidth,40);assert.equal(layer.shadowBlur,120);assert.equal(layer.shadowOffsetX,-200);assert.equal(layer.shadowOpacity,1);}assert.equal(layers.find(l=>l.id==='accent').shadowEnabled,undefined);assert.deepEqual(studio.getLayers(id,'9:16'),story);
});
test('single and multi-layer resize supports free, Shift-proportional and exact inspector axes',()=>{
 const text={id:'a',type:'text',x:100,y:100,width:200,height:100,fontSize:40},shape={id:'b',type:'shape',x:400,y:250,width:100,height:150,fontSize:54};
 let result=resizeSelection([text],bounds([text]),FORMATS['4:5'],{offsetX:100,offsetY:100});assert.deepEqual(result.get('a'),{x:100,y:100,width:300,height:200});
 result=resizeSelection([text],bounds([text]),FORMATS['4:5'],{offsetX:200,offsetY:100,proportional:true});assert.deepEqual(result.get('a'),{x:100,y:100,width:400,height:200,fontSize:80});
 const original=bounds([text,shape]);result=resizeSelection([text,shape],original,FORMATS['4:5'],{offsetX:original.width,offsetY:0});assert.equal(result.get('a').width,400);assert.equal(result.get('b').x,700);assert.equal(result.get('a').height,100);assert.equal(result.get('a').fontSize,undefined);
 result=resizeSelection([text,shape],original,FORMATS['4:5'],{offsetX:0,offsetY:original.height});assert.equal(result.get('a').fontSize,80);assert.equal(result.get('b').y,400);
 result=resizeSelection([text,shape],original,FORMATS['4:5'],{offsetX:original.width,offsetY:original.height,proportional:true});assert.equal(result.get('b').width,200);assert.equal(result.get('a').fontSize,80);
});
test('central hydration cannot read or write a Sites draft and accepts real club ids',()=>{
 let reads=0,writes=0;const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>{reads++;return '{"templates":[{"id":"sites-only"}]}';},setItem:()=>{writes++;}}});try{const studio=createStudio(null,{templates:[],includeFixtures:false,clubs:[]});studio.replaceState({templates:[seeds[0]],clubs:[{id:'actual-club',name:'Werkelijke club'}]});studio.configureTemplate(seeds[0].id,{name:'Toegewezen',audience:'selected',clubIds:['actual-club'],defaultFor:false});assert.equal(studio.getPublishedTemplates('actual-club').length,1);assert.equal(studio.getPublishedTemplates('cl1').length,0);assert.equal(reads,0);assert.equal(writes,0);}finally{if(previous)Object.defineProperty(globalThis,'localStorage',previous);else delete globalThis.localStorage;}
});
