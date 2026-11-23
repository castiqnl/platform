import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const scratch=new URL('../node_modules/.cache/castiq-template-render-tests.mjs',import.meta.url);await mkdir(new URL('./',scratch),{recursive:true});
const built=await build({stdin:{contents:"export {PosterSvg} from './src/Poster'; export {toPosterLayers,sourceLayouts} from './src/template-studio/managedTemplates';",resolveDir:new URL('../',import.meta.url).pathname,loader:'tsx'},bundle:true,platform:'node',format:'esm',packages:'external',write:false});await writeFile(scratch,built.outputFiles[0].contents);const {PosterSvg,toPosterLayers,sourceLayouts}=await import(scratch.href+'?test='+Date.now());after(()=>rm(scratch,{force:true}));
const formats={'4:5':'portrait','9:16':'story','1:1':'square','16:9':'wide'};
function render(layers,format='portrait',partnerLogo=true){return renderToStaticMarkup(React.createElement(PosterSvg,{layers,format,partnerLogo,family:'Penseelkracht',contentType:'Clubnieuws'}));}

test('fixed partner is drawn exactly once in all four SVG formats, independent of corrupt duplicated input marks',()=>{
 const layouts=sourceLayouts('Penseelkracht','news');for(const[ratio,format]of Object.entries(formats)){const layers=toPosterLayers(layouts[ratio],ratio,{}),mark=layers.at(-1);const output=render([...layers,{...mark,x:0,y:0}],format);assert.equal((output.match(/data-castiq-partner="true"/g)||[]).length,1);assert.equal((render(layers,format,false).match(/data-castiq-partner="true"/g)||[]).length,0);}
});
test('canvas effects, ellipse geometry, rectangular radius and selected painter order reach the SVG renderer',()=>{
 const source=sourceLayouts('Penseelkracht','news')['4:5'];const label=source.find(layer=>layer.id==='label');Object.assign(label,{text:'TEST CONTOUR',outlineEnabled:true,outlineWidth:9,outlineColor:'#123456',shadowEnabled:true,shadowColor:'#654321',shadowBlur:20,shadowOffsetX:12,shadowOffsetY:-8,shadowOpacity:.5});
 source.push({...label,id:'ellipse',name:'Ellips',type:'shape',nativeKind:'rule',shape:'circle',x:40,y:100,width:240,height:120,color:'#abcdef'});source.push({...label,id:'rounded',name:'Rechthoek',type:'shape',nativeKind:'rule',shape:'rect',radius:30,x:80,y:200,width:300,height:180});
 const layers=toPosterLayers(source,'4:5',{photo:'/assets/match-pitch.webp'}),output=render(layers);assert.match(output,/stroke="#123456"/);assert.match(output,/flood-color="#654321"/);assert.match(output,/<ellipse[^>]*fill="#abcdef"/);assert(output.includes('data-layer-id="rounded"'));assert(output.indexOf('data-layer-id="ellipse"')<output.indexOf('data-layer-id="rounded"'));
 const photo=layers.find(layer=>layer.id==='photo');const raised=render([...layers.filter(layer=>layer.id!=='photo'),photo]);assert(raised.indexOf('data-layer-id="rounded"')<raised.indexOf('data-layer-id="photo"'));assert.equal((raised.match(/data-photo-layer="true"/g)||[]).length,1);
});
