import React from 'react';
import {PosterTextShadow,posterTextPaint,type TextEffects} from './posterTextEffects';
import {CastiqPartnerMark} from './CastiqPartnerMark';
import {CASTIQ_PARTNER_LAYER_ID} from './template-studio/studio-model.mjs';
import FamilyArtwork from './FamilyArtwork';
import {measureTextEm} from './posterTypography';
import {templateCatalog,getTemplate,resolveTemplateName} from './templateCatalog';
import {SelectedTemplatePoster,selectedDefaultLayers} from './SelectedTemplatePoster';

export type PosterFormat='story'|'portrait'|'square'|'wide';
export type Layer=TextEffects&{id:string;name:string;kind:'text'|'photo'|'crest'|'sponsor'|'rule';text:string;binding?:string;x:number;y:number;size:number;color:string;visible:boolean;locked:boolean;width:number;font?:string;align?:'start'|'middle'|'end';height?:number;rotate?:number;weight?:number;opacity?:number;outline?:boolean;tracking?:number;shape?:'rect'|'circle';radius?:number;fit?:'cover'|'contain'};
export const posterFormats:Record<PosterFormat,{label:string;w:number;h:number}>={story:{label:'Story',w:1080,h:1920},portrait:{label:'Feed',w:1080,h:1350},square:{label:'Vierkant',w:1080,h:1080},wide:{label:'Breed',w:1600,h:900}};
export const contentTypes=['Matchday','Opstelling','Aftrap','Doelpunt','Assist','Gele kaart','Rode kaart','Wissel','Ruststand','Einduitslag','Speler van de wedstrijd','Wedstrijdverslag','Nieuwe speler','Verjaardag','Kampioenschap','Toernooiresultaat','Afgelasting','Clubnieuws','Evenement','Sponsorbericht','Weekenduitslagen'];
export const styleFamilies=templateCatalog.map(t=>t.name);
export const familyNotes=templateCatalog.map(t=>t.description);
const playerTypes=['Doelpunt','Assist','Gele kaart','Rode kaart','Nieuwe speler','Verjaardag','Speler van de wedstrijd'];
const resultTypes=['Einduitslag','Ruststand','Toernooiresultaat'];
const lightFamilies=['Clean','Editorial','Heritage','Community'];

export function legacyDefaultLayers(type='Einduitslag',format:PosterFormat='portrait',family='Broadcast',primary='#1464f4'):Layer[]{
 const wide=format==='wide',story=format==='story',square=format==='square',light=lightFamilies.includes(family),player=playerTypes.includes(type);
 const ink=light?'#182b3d':'#ffffff',muted=light?'#56636c':'#c7d3e0';
 const main=player?'ROBIN BAKKER':type==='Matchday'?'14:30':type==='Aftrap'?'LET’S GO':type==='Opstelling'?'4 · 3 · 3':type==='Wissel'?'NIEUWE ENERGIE':type==='Kampioenschap'?'KAMPIOEN!':type==='Afgelasting'?'NIEUWE DATUM VOLGT':type==='Clubnieuws'?'SAMEN VOORUIT':type==='Evenement'?'CLUBDAG':type==='Sponsorbericht'?'ONZE PARTNERS':type==='Wedstrijdverslag'?'DIT WAS ONS WEEKEND':type==='Weekenduitslagen'?'HET CLUBWEEKEND':'3 — 2';
 const headline=type==='Doelpunt'?'GOAL!':type==='Einduitslag'?'FULL TIME':type==='Ruststand'?'HALF TIME':type==='Afgelasting'?'AFGELAST':type==='Speler van de wedstrijd'?'PLAYER OF THE MATCH':type==='Nieuwe speler'?'WELKOM':type==='Wedstrijdverslag'?'HET VERSLAG':type==='Weekenduitslagen'?'ALLE UITSLAGEN':type==='Toernooiresultaat'?'TOERNOOI':type.toUpperCase();
 let left=50,align:'start'|'middle'='middle',labelY=43,scoreY=65,opponentY=79,dateY=85,photoX=50,photoY=26,photoW=100,photoH=62,labelSize=86,scoreSize=resultTypes.includes(type)?204:player?99:main.length>15?75:132,width=86,crestX=10,clubX=18,headerY=8;
 if(family==='Grit'){left=8;align='start';labelY=49;scoreY=69;opponentY=81;photoY=34;photoH=68;labelSize=111;scoreSize=resultTypes.includes(type)?236:player?113:105;width=84;}
 if(family==='Clean'){left=8;align='start';labelY=52;scoreY=71;opponentY=83;photoX=75;photoY=29;photoW=42;photoH=39;labelSize=70;scoreSize=resultTypes.includes(type)?218:108;}
 if(family==='Spotlight'){left=8;align='start';labelY=39;scoreY=59;opponentY=78;photoX=73;photoY=43;photoW=65;photoH=78;labelSize=76;scoreSize=resultTypes.includes(type)?195:112;width=55;}
 if(family==='Editorial'){left=8;align='start';labelY=63;scoreY=78;opponentY=86;dateY=90;photoX=50;photoY=32;photoW=84;photoH=36;labelSize=61;scoreSize=resultTypes.includes(type)?166:87;}
 if(family==='Signal'){left=8;align='start';labelY=43;scoreY=65;photoX=79;photoY=25;photoW=39;photoH=34;labelSize=98;scoreSize=resultTypes.includes(type)?240:128;width=84;}
 if(family==='Heritage'){left=50;labelY=62;scoreY=77;opponentY=85;dateY=90;photoY=38;photoW=75;photoH=29;labelSize=64;scoreSize=resultTypes.includes(type)?164:88;crestX=50;clubX=50;headerY=16;}
 if(family==='Energy'){left=8;align='start';labelY=44;scoreY=67;photoX=54;photoY=29;photoW=94;photoH=63;labelSize=118;scoreSize=resultTypes.includes(type)?245:116;}
 if(family==='Premium'){left=50;labelY=47;scoreY=66;photoY=27;photoW=86;photoH=50;labelSize=62;scoreSize=resultTypes.includes(type)?182:103;}
 if(family==='Community'){left=8;align='start';labelY=58;scoreY=76;opponentY=85;dateY=90;photoX=48;photoY=31;photoW=79;photoH=34;labelSize=76;scoreSize=resultTypes.includes(type)?180:100;}
 if(story){labelY+=1;scoreY+=1;opponentY=Math.min(82,opponentY);dateY=87;}
 if(square){labelSize*=.84;scoreSize*=.83;}
 if(wide){left=7;align='start';labelY=34;scoreY=65;opponentY=79;dateY=88;photoX=77;photoY=48;photoW=47;photoH=100;labelSize=47;scoreSize=resultTypes.includes(type)?137:75;width=49;crestX=8;clubX=14;headerY=12;}
 const structured=['Opstelling','Wissel','Weekenduitslagen'].includes(type);
 if(structured){labelY=wide?30:29;labelSize=wide?44:70;scoreY=wide?83:81;scoreSize=wide?26:37;opponentY=wide?91:87;dateY=wide?95:91;}
 const serif=family==='Editorial'||family==='Heritage';
 const layers:Layer[]=[
  {id:'photo',name:player?'Spelersportret':'Wedstrijdbeeld',kind:'photo',text:player?'/assets/player-1.webp':family==='Community'?'/assets/team-photo.webp':'/assets/match-action.webp',x:photoX,y:photoY,width:photoW,height:photoH,size:100,color:'#fff',visible:true,locked:false,rotate:family==='Community'&&!wide?-3:0},
  {id:'crest',name:'Clubembleem',kind:'crest',text:'/assets/club-getijde.svg',binding:'club.logo',x:crestX,y:family==='Heritage'&&!wide?8:headerY+1,size:wide?55:family==='Heritage'?84:70,color:ink,visible:true,locked:true,width:8},
  {id:'club',name:'Clubnaam',kind:'text',text:'SC GETIJDE',binding:'club.name',x:clubX,y:headerY,size:wide?18:family==='Heritage'?26:25,color:family==='Premium'?'#d6c7a3':ink,visible:true,locked:true,width:wide?39:70,align:family==='Heritage'&&!wide?'middle':'start'},
  {id:'competition',name:'Team & competitie',kind:'text',text:'O14-1  /  COMPETITIE',binding:'team.name',x:clubX,y:headerY+(wide?5:3.5),size:wide?12:17,color:muted,visible:true,locked:false,width:wide?39:69,align:family==='Heritage'&&!wide?'middle':'start'},
  {id:'accent',name:'Clubaccent',kind:'rule',text:'',x:left,y:labelY-(wide?10:8),size:family==='Grit'?8:3,color:family==='Premium'?'#cdbb91':primary,visible:!structured,locked:false,width:family==='Grit'?17:9},
  {id:'label',name:'Momenttitel',kind:'text',text:headline,x:left,y:labelY,size:labelSize,color:family==='Premium'?'#d4c4a0':ink,visible:true,locked:false,width,align,font:serif?'Georgia,Times New Roman,DejaVu Serif,serif':undefined,rotate:family==='Energy'?-3:0},
  {id:'score',name:player?'Spelersnaam':resultTypes.includes(type)?'Uitslag':'Kerntekst',kind:'text',text:main,binding:player?'player.name':resultTypes.includes(type)?'match.score':'',x:left,y:scoreY,size:scoreSize,color:family==='Clean'?primary:ink,visible:true,locked:false,width,align,font:serif?'Georgia,Times New Roman,DejaVu Serif,serif':undefined},
  {id:'opponent',name:player?'Momentinformatie':'Tegenstander',kind:'text',text:player?type==='Verjaardag'?'VAN HARTE GEFELICITEERD':type==='Nieuwe speler'?'EEN NIEUW HOOFDSTUK':"53′ / ONS MOMENT":'SC GETIJDE  ×  FC HAVENLICHT',binding:player?'event.detail':'match.opponent',x:left,y:opponentY,size:wide?17:22,color:muted,visible:true,locked:false,width:wide?49:84,align},
  {id:'date',name:'Wedstrijdinformatie',kind:'text',text:'ZA 24 OKT  /  SPORTPARK GETIJDE',binding:'match.date',x:left,y:dateY,size:wide?12:16,color:muted,visible:!structured,locked:false,width:wide?49:84,align},
  {id:'sponsor',name:'Sponsorblok',kind:'sponsor',text:'JOUW CLUBSPONSOR',binding:'sponsor.name',x:wide?75:50,y:story?92:95,size:wide?12:17,color:family==='Premium'?'#c3b390':muted,visible:!['Rode kaart','Afgelasting'].includes(type),locked:true,width:wide?37:84}
 ];
 return layers;
}

/** Version 3 uses a separate composition for every family and aspect ratio. */
function legacyStyledDefaultLayers(type='Einduitslag',format:PosterFormat='portrait',family='Broadcast',primary='#1464f4'):Layer[]{
 const wide=format==='wide',story=format==='story',square=format==='square',player=playerTypes.includes(type),result=resultTypes.includes(type),light=lightFamilies.includes(family);
 const old=legacyDefaultLayers(type,format,family,primary),ink=light?'#142c3a':'#fff',muted=light?'#425c65':'#c2d5df';
 let x=7,align:'start'|'middle'|'end'='start',ly=29,sy=80,ls=145,ss=result?340:player?140:125,tw=87,px=50,py=50,pw=100,ph=100,oy=89,dy=94,rot=0,photoOpacity=1;
 if(family==='Clean'){ly=30;sy=65;ls=67;ss=result?235:120;tw=43;px=79;py=51;pw=49;ph=102;oy=84;dy=91;}
 if(family==='Grit'){x=5;ly=28;sy=83;ls=167;ss=result?365:155;px=52;py=48;pw=104;ph=47;rot=-3;oy=90;dy=94;}
 if(family==='Spotlight'){x=50;align='middle';ly=34;sy=84;ls=187;ss=result?330:135;px=50;py=53;pw=106;ph=90;oy=91;dy=95;}
 if(family==='Editorial'){x=7;ly=72;sy=87;ls=74;ss=result?205:105;px=50;py=41;pw=88;ph=48;oy=92;dy=96;}
 if(family==='Signal'){x=6;ly=30;sy=82;ls=158;ss=result?365:145;px=75;py=46;pw=68;ph=58;oy=90;dy=95;}
 if(family==='Heritage'){x=50;align='middle';ly=30;sy=51;ls=72;ss=result?238:110;px=50;py=71;pw=82;ph=28;oy=90;dy=94;}
 if(family==='Energy'){x=5;ly=27;sy=85;ls=174;ss=result?370:150;px=63;py=54;pw=105;ph=93;rot=-6;oy=91;dy=95;}
 if(family==='Premium'){x=50;align='middle';ly=30;sy=69;ls=73;ss=result?360:143;px=50;py=50;pw=100;ph=100;photoOpacity=player?.85:.42;oy=86;dy=93;}
 if(family==='Community'){x=8;ly=72;sy=86;ls=66;ss=result?270:118;px=49;py=36;pw=99;ph=56;oy=92;dy=96;}
 if(story){if(['Grit','Energy','Broadcast'].includes(family)){ly=25;sy=80;}if(family==='Editorial'){py=40;ph=47;ly=70;sy=84;oy=91;dy=95;}if(family==='Heritage'){sy=48;py=69;ph=31;}if(family==='Clean'){ly=33;sy=65;oy=84;}if(family==='Community'){py=36;ph=57;ly=71;sy=83;}ss*=1.05;}
 if(square){ls*=.88;ss*=.86;if(family==='Editorial'){py=40;ph=45;ly=71;sy=86;oy=93;dy=97;}if(family==='Community'){py=34;ph=51;ly=67;sy=84;}if(family==='Heritage'){ly=29;sy=50;py=70;ph=26;}if(family==='Spotlight'){sy=84;ly=33;}}
 if(wide){
  x=6;ly=34;sy=77;ls=86;ss=result?230:110;tw=62;px=75;py=50;pw=55;ph=112;oy=88;dy=95;
  if(family==='Broadcast'){px=50;pw=100;ph=100;ly=36;sy=78;ss=result?250:110;}
  if(family==='Clean'){ly=33;sy=73;ls=58;ss=result?195:100;tw=43;px=79;pw=49;oy=87;dy=95;}
  if(family==='Grit'){x=5;ly=36;sy=79;ls=105;ss=result?252:118;tw=60;px=78;py=50;pw=60;ph=108;}
  if(family==='Spotlight'){x=7;align='start';ly=44;sy=80;ls=119;ss=result?210:103;tw=66;px=77;py=57;pw=65;ph=130;}
  if(family==='Editorial'){x=56;ly=43;sy=75;ls=58;ss=result?143:83;tw=38;px=28;py=61;pw=47;ph=73;oy=88;dy=96;}
  if(family==='Signal'){x=6;ly=35;sy=80;ls=95;ss=result?250:120;tw=61;px=80;py=52;pw=55;ph=90;}
  if(family==='Heritage'){x=46;align='middle';ly=32;sy=62;ls=60;ss=result?190:86;tw=46;px=79;py=62;pw=32;ph=64;oy=82;dy=93;}
  if(family==='Energy'){x=4;ly=35;sy=82;ls=122;ss=result?270:125;tw=65;px=77;py=59;pw=72;ph=140;}
  if(family==='Premium'){x=7;align='start';ly=33;sy=78;ls=61;ss=result?265:124;tw=76;px=70;pw=85;ph=110;}
  if(family==='Community'){x=65;ly=35;sy=74;ls=54;ss=result?155:92;tw=30;px=28;py=50;pw=61;ph=100;oy=87;dy=96;}
 }
 if(family==='Community'&&result&&!wide){ls=square?54:60;ly=square?68:71;ss=story?260:square?220:240;sy=story?84:87.5;}
 const structured=['Opstelling','Wissel','Weekenduitslagen'].includes(type),serif=['Editorial','Heritage'].includes(family),cutout=player||['Spotlight','Energy'].includes(family);
 if(player&&family==='Premium'){x=7;align='start';ly=wide?29:23;sy=wide?85:87;tw=86;ls=wide?75:100;}
 const src=player&&['Editorial','Heritage','Community'].includes(family)?'/assets/player-1.webp':cutout?'/assets/player-cutout.png':family==='Community'?'/assets/team-photo.webp':family==='Premium'?'/assets/team-celebration.webp':'/assets/match-action.webp';
 if(cutout&&!wide&&['Broadcast','Grit'].includes(family)){py=52;ph=83;pw=99;}
 if(player&&family==='Heritage'&&!wide){pw=58;ph=square?29:34;py=70;}
 if(player&&family==='Editorial'&&!wide){sy=story?88:square?88:89;ss=square?76:88;}
 if(structured){x=wide?6:7;align='start';ly=wide?27:23;ls=wide?65:90;sy=wide?88:86;ss=wide?30:40;tw=86;oy=wide?95:92;dy=96;photoOpacity=.12;}
 let layers=old.map(l=>({...l}));
 const patch=(id:string,v:Partial<Layer>)=>{layers=layers.map(l=>l.id===id?{...l,...v}:l);};
 patch('photo',{text:src,x:px,y:py,width:pw,height:ph,rotate:family==='Grit'&&!cutout?-4:family==='Community'&&!wide?-4:0,opacity:photoOpacity});
 patch('label',{x,y:ly,size:ls,width:tw,align,color:family==='Grit'&&!wide?'#08121c':family==='Clean'?ink:family==='Heritage'?'#493b25':family==='Editorial'||family==='Community'?ink:family==='Premium'?'#d6c7a7':'#fff',font:serif?'DejaVu Serif,Georgia,serif':family==='Clean'||family==='Community'?'Inter,Arial,sans-serif':'Barlow Condensed,Impact,sans-serif',weight:family==='Clean'?500:900,rotate:rot,outline:family==='Spotlight'&&!structured,tracking:family==='Clean'?-1.5:-1.8});
 patch('score',{x,y:sy,size:ss,width:tw,align,color:family==='Clean'?primary:family==='Heritage'?'#372e20':light?ink:'#fff',font:serif?'DejaVu Serif,Georgia,serif':family==='Clean'?'Inter,Arial,sans-serif':'Barlow Condensed,Impact,sans-serif',weight:family==='Clean'?500:900,tracking:-2});
 patch('opponent',{x,y:oy,width:tw,align,size:wide?20:27,color:muted});patch('date',{x,y:dy,width:tw,align,size:wide?17:21,color:muted});
 patch('accent',{visible:false});patch('sponsor',{x:50,y:98,width:86,size:wide?14:18,color:muted});
 if(family==='Clean'){patch('crest',{x:9,y:10,size:62});patch('club',{x:16,y:9,width:38,size:28,color:ink});patch('competition',{x:16,y:13,width:38,size:18,color:muted});}
 else if(family==='Editorial'){patch('crest',{x:91,y:9,size:67});patch('club',{x:7,y:10,width:76,size:wide?53:62,color:ink,font:'DejaVu Serif,Georgia,serif',weight:900});patch('competition',{x:7,y:13.5,width:80,size:wide?16:18,color:muted});}
 else if(family==='Heritage'&&!wide){patch('crest',{x:50,y:10,size:108});patch('club',{x:50,y:20,width:82,size:45,align:'middle',font:'DejaVu Serif,Georgia,serif',color:'#493b25'});patch('competition',{x:50,y:24,width:82,size:19,align:'middle',color:muted});}
 else if(family==='Heritage'&&wide){patch('crest',{x:15,y:30,size:130});patch('club',{x:46,y:15,width:48,size:41,align:'middle',font:'DejaVu Serif,Georgia,serif',color:'#493b25'});patch('competition',{x:46,y:21,width:46,size:16,align:'middle'});}
 else if(family==='Community'&&wide){patch('crest',{x:68,y:11,size:55});patch('club',{x:74,y:10,width:25,size:22,color:ink});patch('competition',{x:74,y:16,width:25,size:14,color:muted});}
 else{patch('crest',{x:9,y:wide?11:8,size:wide?53:65});patch('club',{x:16,y:wide?10:7,width:wide?55:74,size:wide?25:31,color:light?ink:'#fff'});patch('competition',{x:16,y:wide?16:11,width:wide?55:74,size:wide?16:20,color:muted});}
 if(structured){const photo=layers.find(l=>l.id==='photo')!;return [photo,...layers.filter(l=>l.id!=='photo')];}
 if(['Spotlight','Energy'].includes(family)||family==='Grit'&&cutout){const label=layers.find(l=>l.id==='label')!,photo=layers.find(l=>l.id==='photo')!;layers=[label,photo,...layers.filter(l=>!['label','photo'].includes(l.id))];}
 return layers;
}
export function defaultLayers(type='Einduitslag',format:PosterFormat='portrait',family='Penseelkracht',primary='#1464f4',secondary='#ffffff'):Layer[]{
 return selectedDefaultLayers(type,format,resolveTemplateName(family),primary,secondary);
}
export function resolveLayerText(l:Layer,data?:Record<string,string>){return data&&l.binding&&data[l.binding]!==undefined?String(data[l.binding]):l.text;}
function textMetrics(text:string,size:number,width:number,font:string,wrap:boolean,spacing=0,weight=800){
 const tracking=spacing>0?Math.min(spacing,width*.14/Math.max(1,String(text).length-1)):spacing;
 const length=(s:string,n:number)=>measureTextEm(s,font,weight)*n+Math.max(0,s.length-1)*tracking;
 const lines:string[]=[];for(const para of String(text).split('\n')){let line='';for(const word of para.split(/\s+/)){const next=line?line+' '+word:word;if(wrap&&line&&length(next,size)>width&&lines.length<1){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);}if(!lines.length)lines.push('');
 const all=lines.length>2?[lines[0],lines.slice(1).join(' ')]:lines;
 const fit=Math.max(.1,Math.min(size,...all.map(line=>(width-Math.max(0,line.length-1)*tracking)/Math.max(.001,measureTextEm(line,font,weight)))));
 return {lines:all,size:fit,tracking,widths:all.map(line=>Math.min(width,Math.max(.1,length(line,fit))))};
}

type SvgProps={layers:Layer[];format?:PosterFormat;primary?:string;secondary?:string;family?:string;data?:Record<string,string>;selectedId?:string;onLayerPointerDown?:(e:React.PointerEvent,id:string)=>void;safe?:boolean;motion?:boolean;contentType?:string;partnerLogo?:boolean};
function LegacyPosterSvg({layers,format='portrait',primary='#1464f4',family='Broadcast',data,selectedId,onLayerPointerDown,safe=false,motion=false,contentType,partnerLogo=false}:SvgProps){
 const f=posterFormats[format]||posterFormats.portrait,H=1000*f.h/f.w,wide=format==='wide',light=lightFamilies.includes(family),id=React.useId().replace(/[^a-zA-Z0-9_-]/g,''),u=(n:string)=>`url(#${n}${id})`;
 const label=layers.find(l=>l.id==='label')?.text||'',type=contentType||(label==='FULL TIME'?'Einduitslag':label==='HALF TIME'?'Ruststand':label==='GOAL!'?'Doelpunt':label.charAt(0)+label.slice(1).toLowerCase()),structured=['Opstelling','Wissel','Weekenduitslagen'].includes(type);
 const ink=light?'#142c3a':'#fff',wx=wide?65:70,wy=H*(wide?.34:.31),ww=wide?870:860,wh=H*(wide?.45:.43);
 function renderLayer(l:Layer){
  if(l.id===CASTIQ_PARTNER_LAYER_ID)return null;
  const x=l.x*10,y=l.y*H/100,text=resolveLayerText(l,data),selected=l.id===selectedId,common={className:`poster-layer ${selected?'poster-selected':''}`,onPointerDown:(e:React.PointerEvent)=>onLayerPointerDown?.(e,l.id),style:{cursor:onLayerPointerDown?(l.locked?'pointer':'move'):undefined},'data-layer-id':l.id};
  if(l.kind==='photo'){
   const w=l.width*10,h=H*(l.height??85)/100,px=x-w/2,py=l.height!==undefined?y-h/2:y-H*.36,cutout=text.includes('player-cutout'),clip='photo'+id+l.id.replace(/[^a-zA-Z0-9]/g,'');
   const polygon=family==='Grit'?`M${px} ${py+20}L${px+w} ${py}V${py+h-25}L${px+w*.9} ${py+h}L${px+w*.8} ${py+h-14}L${px+w*.67} ${py+h+8}L${px+w*.5} ${py+h-9}L${px+w*.3} ${py+h+12}L${px} ${py+h-4}Z`:family==='Community'?`M${px+12} ${py+8}L${px+w} ${py}L${px+w-8} ${py+h-12}Q${px+w*.5} ${py+h+28} ${px} ${py+h-5}Z`:'';
   return <g key={l.id} {...common} data-photo-layer="true" opacity={l.opacity??1} transform={l.rotate?`rotate(${l.rotate} ${x} ${y})`:undefined}>
    <defs><clipPath id={clip}>{family==='Signal'?<ellipse cx={x} cy={y} rx={w/2} ry={h/2}/>:family==='Heritage'?<path d={`M${px} ${py+h}V${py+h*.27}Q${x} ${py-h*.3} ${px+w} ${py+h*.27}V${py+h}Z`}/>:polygon?<path d={polygon}/>:<rect x={px} y={py} width={w} height={h}/>}</clipPath></defs>
    {family==='Community'&&!cutout&&<rect x={px+14} y={py+15} width={w} height={h} fill={primary} opacity=".32"/>}
    <g clipPath={cutout?undefined:`url(#${clip})`}>
     <image href={text} x={px} y={py} width={w} height={h} preserveAspectRatio={cutout?family==='Clean'?'xMidYMax slice':'xMidYMax meet':playerTypes.includes(type)&&['Editorial','Heritage','Community'].includes(family)?'xMidYMid slice':'xMidYMin slice'} filter={cutout?u('subjectDepth'):['Grit','Heritage'].includes(family)?u('mono'):undefined}/>
     {!cutout&&['Broadcast','Spotlight','Premium'].includes(family)&&<rect x={px} y={py} width={w} height={h} fill={u(wide?'fadeWide':'fade')}/>}
     {cutout&&family==='Premium'&&<rect x="0" y={H*.67} width="1000" height={H*.33} fill={u('floor')}/>}
     {!cutout&&family==='Grit'&&<rect x={px} y={py} width={w} height={h} fill={primary} opacity=".15"/>}
    </g>
    {selected&&<rect x={px} y={py} width={w} height={h} fill="none" stroke="#c8ff24" strokeWidth="2" strokeDasharray="8 5"/>}
   </g>;
  }
  const font=l.font||(['label','score'].includes(l.id)?'Barlow Condensed,Impact,sans-serif':'Inter,Arial,sans-serif'),align=l.align||'middle',maxWidth=Math.max(40,Math.min(l.width*10,align==='start'?975-x:align==='end'?x-25:2*Math.min(x-25,975-x))),m=textMetrics(text,l.size,maxWidth,font,['score','label','club'].includes(l.id)&&!/^\d/.test(text),l.tracking??(['competition','date','opponent','sponsor'].includes(l.id)?1:0),l.weight??(['label','score'].includes(l.id)?900:600)),gap=m.size*1.02,baseline=y-(m.lines.length-1)*gap;
  const textLayer=l.kind==='text'||l.kind==='sponsor',shadowId='textshadow'+id+layers.indexOf(l);
  const shadow=l.shadowEnabled?`url(#${shadowId})`:undefined;
  return <g key={l.id} {...common} opacity={l.opacity??1} transform={l.rotate?`rotate(${l.rotate} ${x} ${y})`:undefined}>
   {textLayer&&<PosterTextShadow id={shadowId} layer={l}/>}
   {l.kind==='text'&&<text x={x} y={baseline} fontFamily={font} fontSize={m.size} fontWeight={l.weight??(['score','label'].includes(l.id)?900:600)} letterSpacing={m.tracking} textAnchor={align} {...posterTextPaint(l,l.color,!light&&l.id==='score'?{color:'#02080c50',width:1}:undefined)} filter={shadow}>{m.lines.map((line,i)=><tspan key={i} x={x} dy={i?gap:0} textLength={m.widths[i]} lengthAdjust="spacingAndGlyphs">{line}</tspan>)}</text>}
   {l.kind==='crest'&&<image href={text} x={x-l.size/2} y={y-l.size/2} width={l.size} height={l.size} preserveAspectRatio="xMidYMid meet"/>}
   {l.kind==='rule'&&(l.shape==='circle'?<ellipse cx={(align==='start'?x:x-l.width*5)+l.width*5} cy={y+l.size/2} rx={l.width*5} ry={l.size/2} fill={l.color}/>:<rect x={align==='start'?x:x-l.width*5} y={y} width={l.width*10} height={l.size} rx={l.radius||0} fill={l.color}/>)}
   {l.kind==='sponsor'&&<text x={x} y={y} textAnchor="middle" fontFamily="Inter,Arial,sans-serif" fontSize={m.size} fontWeight="600" letterSpacing="2" {...posterTextPaint(l,l.color)} filter={shadow}>{text}</text>}
   {selected&&<rect x={align==='start'?x-7:align==='end'?x-maxWidth-7:x-maxWidth/2-7} y={baseline-m.size*.85-6} width={l.kind==='crest'?l.size+14:maxWidth+14} height={l.kind==='crest'?l.size+14:m.size+gap*(m.lines.length-1)+14} fill="none" stroke="#c8ff24" strokeWidth="2" strokeDasharray="8 5"/>}
  </g>;
 }
 const widget=type==='Opstelling'?<g data-content-layout="formation-pitch"><rect x={wx} y={wy} width={ww} height={wh} rx="9" fill={light?'#dce5dc':'#082b2c'} fillOpacity=".97" stroke={light?'#96b3a1':'#9fc8b86b'} strokeWidth="2"/><path d={`M${wx} ${wy+wh*.5}h${ww}M${wx+ww*.3} ${wy}v${wh*.16}h${ww*.4}v-${wh*.16}M${wx+ww*.3} ${wy+wh}v-${wh*.16}h${ww*.4}v${wh*.16}`} stroke="#8fafa0" strokeWidth="2" fill="none"/><circle cx={wx+ww*.5} cy={wy+wh*.5} r={wh*.13} fill="none" stroke="#8fafa0"/>{[[.5,.88],[.17,.65],[.39,.65],[.61,.65],[.83,.65],[.25,.42],[.5,.38],[.75,.42],[.2,.15],[.5,.12],[.8,.15]].map(([cx,cy],i)=><g key={i}><circle cx={wx+cx*ww} cy={wy+cy*wh} r={wide?14:23} fill={primary} stroke="#fff" strokeWidth="2"/><text x={wx+cx*ww} y={wy+cy*wh+(wide?5:7)} textAnchor="middle" fill="#fff" fontFamily="Inter,Arial" fontSize={wide?13:20} fontWeight="800">{data?.[`lineup.${i+1}.number`]||i+1}</text></g>)}</g>:type==='Weekenduitslagen'?<g data-content-layout="results-list">{[0,1,2].map(n=><g key={n} transform={`translate(${wx} ${wy+n*wh/3})`}><rect width={ww} height={wh/3-10} rx="4" fill={light?'#fffaf0':'#0e2030'} fillOpacity=".97"/><text x="25" y={wh/6} fill={ink} fontSize={wide?17:28} fontFamily="Inter,Arial" fontWeight="700">{data?.[`results.${n}.team`]||(n===0?'O14-1':n===1?'EERSTE ELFTAL':'O19-1')}</text><text x={ww/2} y={wh/6+8} textAnchor="middle" fill={ink} fontSize={wide?44:66} fontWeight="900" fontFamily="Barlow Condensed,Impact">{data?.[`results.${n}.score`]||(n===0?data?.['match.score']||'3 — 2':'—')}</text><text x={ww-25} y={wh/6} textAnchor="end" fill={ink} fontSize={wide?14:22} fontFamily="Inter,Arial">{data?.[`results.${n}.opponent`]||(n===0?'FC HAVENLICHT':'NOG IN TE VULLEN')}</text></g>)}</g>:type==='Wissel'?<g data-content-layout="substitution-cards">{[0,1].map(n=><g key={n} transform={`translate(${wx+n*(ww/2+8)} ${wy})`}><rect width={ww/2-16} height={wh} rx="8" fill={light?'#fffaf0':'#0d2030'} stroke={n?'#d38d79':'#79bd86'} strokeWidth="2"/><path d={`M${ww/4-30} ${wh*.18}h60m-20 -20l20 20-20 20`} fill="none" stroke={n?'#eaa68e':'#74ca91'} strokeWidth="5" transform={n?`rotate(180 ${ww/4} ${wh*.18})`:undefined}/><text x={ww/4-8} y={wh*.63} textAnchor="middle" fontFamily="Barlow Condensed,Impact" fontSize={wide?90:155} fontWeight="900" fill={ink}>{data?.[n?'sub.out.number':'sub.in.number']||(n?'9':'14')}</text><text x={ww/4-8} y={wh*.84} textAnchor="middle" fontFamily="Inter,Arial" fontSize={wide?15:23} fill={ink}>{n?'GAAT ERUIT':'KOMT ERIN'}</text></g>)}</g>:null;
 return <svg className={`poster-svg poster-family-${family.toLowerCase()} ${motion?'poster-motion':''}`} data-content-type={type} data-layout-version="3" viewBox={`0 0 1000 ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label={`${type} in ${family}-stijl voor ${data?.['club.name']||'SC Getijde'}`} style={{display:'block',width:'100%',height:'100%',background:light?'#f3eee4':'#08121c'}}>
  <defs><clipPath id={'canvas'+id}><rect width="1000" height={H}/></clipPath><linearGradient id={'fade'+id} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#04101b" stopOpacity=".3"/><stop offset=".38" stopColor="#04101b" stopOpacity=".06"/><stop offset=".75" stopColor="#04101b" stopOpacity=".75"/><stop offset="1" stopColor="#04101b" stopOpacity=".98"/></linearGradient><linearGradient id={'fadeWide'+id}><stop stopColor="#04101b" stopOpacity=".94"/><stop offset=".5" stopColor="#04101b" stopOpacity=".45"/><stop offset="1" stopColor="#04101b" stopOpacity=".02"/></linearGradient><linearGradient id={'floor'+id} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#040a12" stopOpacity="0"/><stop offset=".5" stopColor="#040a12" stopOpacity=".78"/><stop offset="1" stopColor="#040a12" stopOpacity=".97"/></linearGradient><filter id={'mono'+id}><feColorMatrix type="saturate" values="0"/></filter><filter id={'subjectDepth'+id} x="-25%" y="-25%" width="160%" height="160%"><feDropShadow dx="5" dy="0" stdDeviation="6" floodColor={primary} floodOpacity=".3"/><feDropShadow dx="0" dy="22" stdDeviation="20" floodColor="#020710" floodOpacity=".4"/></filter></defs>
  <g clipPath={u('canvas')}><FamilyArtwork family={family} primary={primary} H={H} wide={wide} id={id}/>{structured?<>{layers.filter(l=>l.visible&&l.kind==='photo').map(renderLayer)}{widget}{layers.filter(l=>l.visible&&l.kind!=='photo').map(renderLayer)}</>:layers.filter(l=>l.visible).map(renderLayer)}{['Gele kaart','Rode kaart'].includes(type)&&<rect data-content-layout="disciplinary-card" x="820" y={H*.18} width="87" height="125" rx="7" fill={type==='Rode kaart'?'#ed4747':'#f5d747'} transform={`rotate(9 860 ${H*.25})`}/>} {safe&&<g className="poster-safe-area"><rect x="55" y={H*.06} width="890" height={H*.88} fill="none" stroke="#c8ff24" strokeWidth="2" strokeDasharray="8 8"/><text x="65" y={H*.06+18} fill="#c8ff24" fontSize="12" fontFamily="Inter,Arial">VEILIGE ZONE</text></g>}{partnerLogo&&<CastiqPartnerMark format={format}/>}</g>
 </svg>;
}
export function PosterSvg(props:SvgProps){
 return getTemplate(props.family||'Penseelkracht')?<SelectedTemplatePoster {...props}/>:<LegacyPosterSvg {...props}/>;
}
export default function Poster({type='Einduitslag',score='3 — 2',family='Penseelkracht',format='portrait',primary='#1464f4',secondary='#ffffff',player='JACK MORAUW',compact=false,className='',font,club='SC Getijde',team='O14-1 / COMPETITIE',opponent='FC Havenlicht'}:{type?:string;score?:string;family?:string;format?:string;primary?:string;secondary?:string;player?:string;compact?:boolean;className?:string;font?:string;club?:string;team?:string;opponent?:string}){
 const valid=(format in posterFormats?format:'portrait') as PosterFormat;
 const chosen=resolveTemplateName(family);
 return <div className={`poster ${compact?'poster-compact':''} ${className}`} style={{aspectRatio:`${posterFormats[valid].w}/${posterFormats[valid].h}`,overflow:'hidden',position:'relative'}}><PosterSvg layers={defaultLayers(type,valid,chosen,primary,secondary).map(l=>font&&l.kind==='text'?{...l,font}:l)} contentType={type} format={valid} family={chosen} primary={primary} secondary={secondary} data={{'match.score':score,'player.name':player,'club.name':club.toUpperCase(),'team.name':team.toUpperCase(),'match.opponent':club.toUpperCase()+' × '+opponent.toUpperCase()}}/></div>;
}
