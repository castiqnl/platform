import React from 'react';
import type {Layer,PosterFormat} from './Poster';
import {getTemplate,templateCatalog,type TemplateDefinition} from './templateCatalog';
import {measureTextEm} from './posterTypography';
import {useTemplateAtlas} from './templateAtlas';

const formatRatios:Record<PosterFormat,number>={portrait:1.25,story:1920/1080,square:1,wide:900/1600};
const playerTypes=['Doelpunt','Assist','Gele kaart','Rode kaart','Nieuwe speler','Verjaardag','Speler van de wedstrijd'];
const resultTypes=['Einduitslag','Ruststand','Toernooiresultaat'];
const structuredTypes=['Opstelling','Wissel','Weekenduitslagen'];
const fonts={condensed:'Barlow Condensed,Impact,sans-serif',serif:'DejaVu Serif,Georgia,serif',sans:'Inter,Arial,sans-serif'};
function luminance(hex:string){const h=hex.replace('#',''),v=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255).map(n=>n<=.04045?n/12.92:Math.pow((n+.055)/1.055,2.4));return v[0]*.2126+v[1]*.7152+v[2]*.0722;}
function textInk(t:TemplateDefinition,primary:string){if(t.tone==='paper'||t.tone==='silver')return luminance(primary)<.13?primary:'#101d2a';if(t.tone==='primary'&&[2,5,11,23].includes(t.id))return luminance(primary)>.34?'#07111d':'#ffffff';return '#ffffff';}
function labelFor(type:string){return ({Einduitslag:'FULL TIME',Ruststand:'HALF TIME',Doelpunt:'GOAL!',Assist:'ASSIST',Aftrap:'AFTRAP',Afgelasting:'AFGELAST','Speler van de wedstrijd':'SPELER VAN DE WEDSTRIJD','Nieuwe speler':'WELKOM',Wedstrijdverslag:'HET VERSLAG',Weekenduitslagen:'ONS WEEKEND',Toernooiresultaat:'TOERNOOI',Clubnieuws:'CLUBNIEUWS',Sponsorbericht:'ONZE PARTNERS'} as Record<string,string>)[type]||type.toUpperCase();}
function mainFor(type:string){return playerTypes.includes(type)?'ROBIN BAKKER':({Matchday:'14:30',Aftrap:'LET’S GO',Opstelling:'4 · 3 · 3',Wissel:'NIEUWE ENERGIE',Kampioenschap:'KAMPIOEN!',Afgelasting:'NIEUWE DATUM VOLGT',Clubnieuws:'SAMEN VOORUIT',Evenement:'CLUBDAG',Sponsorbericht:'SAMEN STERKER',Wedstrijdverslag:'DIT WAS ONS WEEKEND',Weekenduitslagen:'SAMEN TERUGBLIKKEN'} as Record<string,string>)[type]||'3 – 2';}

/** Four genuinely separate layers: club base, user photograph, fixed effect, live data. */
export function selectedDefaultLayers(type='Einduitslag',format:PosterFormat='portrait',family='Penseelkracht',primary='#1464f4',secondary='#ffffff'):Layer[]{
 const t=getTemplate(family)||templateCatalog[0],wide=format==='wide',story=format==='story',square=format==='square';
 const player=playerTypes.includes(type),result=resultTypes.includes(type),structured=structuredTypes.includes(type);
 const ink=textInk(t,primary),muted=ink==='#ffffff'?'#ecf1f6':'#1d3446',font=fonts[t.font];
 let x=t.align==='middle'?50:t.align==='end'?91:8,align=t.align,ly=69,sy=85,ls=t.font==='serif'?61:74,ss=t.font==='serif'?228:t.font==='sans'?225:273,tw=84;
 if(t.slant){ly=70;sy=85;tw=82;}
 if(t.id===4){x=8;tw=77;ls=78;ss=278;}
 if(t.id===5){x=8;ly=69;ls=82;ss=280;}
 if(t.id===6){ly=70;ss=278;}
 if(t.id===9){ly=70;ss=265;}
 if(t.id===12){x=91;tw=71;ls=76;ss=263;}
 if(t.id===24){ly=69;ss=261;tw=78;}
 if(t.id===29){ly=70;ss=270;}
 if(t.id===31){ly=69;ss=231;ls=64;}
 if(t.id===34){ls=57;ss=235;ly=68;}
 if(t.id===39){ly=70;ls=70;ss=266;}
 if(t.id===45){ls=62;ss=233;}
 if(t.id===46){ly=70;ss=226;ls=61;}
 if(t.id===47){ly=70;ss=225;ls=61;}
 if(t.id===48){ly=70;ss=225;ls=61;}
 if(story){ly=70;sy=85;ls*=1.12;ss*=1.1;}
 if(square){ly=69;sy=85;ls*=.8;ss*=.78;}
 if(wide){ly=67;sy=85;ls=40;ss=t.font==='serif'?108:t.font==='sans'?115:143;tw=76;x=t.align==='middle'?50:t.align==='end'?91:8;}
 if(!result){ss=wide?72:story?154:square?111:140;sy=84;}
 if(mainFor(type).length>15){ss=wide?56:square?86:108;}
 if(structured){ss=wide?29:42;ly=wide?69:71;sy=86;ls=wide?39:70;}
 // Cover the complete open frame without a hard edge above the photograph.
 // The user can move and resize this independent photo layer in the editor.
 const photoY=35.5,photoHeight=71;
 const shared={visible:true,locked:false,opacity:1};
 const layers:Layer[]=[
  {id:'photo',name:player?'Spelersfoto':'Jouw foto',kind:'photo',text:player?'/assets/player-1.webp':'/assets/match-pitch.webp',x:50,y:photoY,width:100,height:photoHeight,size:100,color:'#fff',...shared},
  {id:'crest',name:'Clubembleem',kind:'crest',text:'/assets/club-getijde.svg',binding:'club.logo',x:9,y:8,size:wide?45:62,width:8,color:'#ffffff',...shared,locked:true},
  {id:'club',name:'Clubnaam',kind:'text',text:'SC GETIJDE',binding:'club.name',x:16,y:wide?7:7.2,size:wide?17:24,width:72,align:'start',font:fonts.sans,weight:700,color:'#ffffff',...shared,locked:true},
  {id:'competition',name:'Team & competitie',kind:'text',text:'O14-1 / COMPETITIE',binding:'team.name',x:16,y:wide?11.5:10.3,size:wide?11:16,width:72,align:'start',font:fonts.sans,weight:500,color:'#ffffff',...shared},
  {id:'label',name:'Momenttitel',kind:'text',text:labelFor(type),x,y:ly,size:ls,width:tw,color:ink,align,font,weight:800,tracking:t.font==='serif'?-1:-.6,rotate:t.slant||0,...shared},
  {id:'score',name:player?'Spelersnaam':result?'Uitslag':'Kerntekst',kind:'text',text:mainFor(type),binding:player?'player.name':result?'match.score':'',x,y:sy,size:ss,width:tw,color:ink,align,font,weight:900,tracking:-1.4,rotate:t.slant||0,...shared},
  {id:'opponent',name:player?'Momentinformatie':'Tegenstander',kind:'text',text:player?type==='Verjaardag'?'VAN HARTE GEFELICITEERD':type==='Nieuwe speler'?'EEN NIEUW HOOFDSTUK':"53′ / ONS MOMENT":'SC GETIJDE · FC HAVENLICHT',binding:player?'event.detail':'match.opponent',x,y:91,size:wide?13:20,width:tw,color:muted,align,font:fonts.sans,weight:600,tracking:1.2,...shared},
  {id:'date',name:'Wedstrijdinformatie',kind:'text',text:'ZA 24 OKT · SPORTPARK GETIJDE',binding:'match.date',x,y:94,size:wide?10:14,width:tw,color:muted,align,font:fonts.sans,weight:500,tracking:.7,...shared,visible:false},
  {id:'accent',name:'Secundair clubaccent',kind:'rule',text:'',x,y:93.6,size:wide?1.7:3,width:7,color:secondary,align,...shared,visible:false},
  {id:'sponsor',name:'Clubpartner',kind:'sponsor',text:'CLUBPARTNER',binding:'sponsor.name',x:50,y:97,size:wide?10:15,width:82,color:muted,font:fonts.sans,weight:600,...shared,locked:true}
 ];
 return layers;
}

export type SelectedTemplatePosterProps={layers:Layer[];format?:PosterFormat;primary?:string;secondary?:string;family?:string;data?:Record<string,string>;selectedId?:string;onLayerPointerDown?:(e:React.PointerEvent,id:string)=>void;safe?:boolean;motion?:boolean;contentType?:string};
function fitText(text:string,size:number,maxWidth:number,font:string,weight:number,wrap:boolean,tracking=0){
 const lines:string[]=[];
 for(const paragraph of String(text).split('\n')){let line='';for(const word of paragraph.split(/\s+/)){const test=line?line+' '+word:word;if(wrap&&line&&measureTextEm(test,font,weight)*size>maxWidth&&lines.length===0){lines.push(line);line=word;}else line=test;}if(line)lines.push(line);}
 if(!lines.length)lines.push('');
 const limited=lines.length>2?[lines[0],lines.slice(1).join(' ')]:lines;
 const n=Math.min(size,...limited.map(line=>(maxWidth-Math.max(0,line.length-1)*tracking)/Math.max(.01,measureTextEm(line,font,weight))));
 return {lines:limited,size:Math.max(1,n),tracking,widths:limited.map(line=>Math.max(1,Math.min(maxWidth,measureTextEm(line,font,weight)*n+Math.max(0,line.length-1)*tracking)))};
}

export function SelectedTemplatePoster({layers,format='portrait',primary='#1464f4',secondary='#ffffff',family='Penseelkracht',data,selectedId,onLayerPointerDown,safe=false,motion=false,contentType}:SelectedTemplatePosterProps){
 const t=getTemplate(family)||templateCatalog[0],H=1000*(formatRatios[format]||1.25),wide=format==='wide',id=React.useId().replace(/[^a-zA-Z0-9_-]/g,''),u=(name:string)=>`url(#${name}${id})`;
 const atlas=useTemplateAtlas(t.atlas,primary,secondary);
 const type=contentType||'Einduitslag',structured=structuredTypes.includes(type),ink=textInk(t,primary);
 const base=t.light?'#f5f2e9':t.tone==='wood'?'#25170f':t.tone==='primary'?primary:'#080e17';
 const col=t.cell%3,row=Math.floor(t.cell/3),frameView=`${col*1000+9} ${row*1250+9} 982 1232`;
 const resolved=(l:Layer)=>l.binding&&data?.[l.binding]!==undefined?String(data[l.binding]):l.text;
 function selection(l:Layer,x:number,y:number,w:number,h:number){return l.id===selectedId?<rect x={x-5} y={y-5} width={w+10} height={h+10} fill="none" stroke="#c8ff24" strokeWidth="2" strokeDasharray="8 5"/>:null;}
 function renderLayer(l:Layer){
  const x=l.x*10,y=l.y*H/100,text=resolved(l),weight=l.weight??(['label','score'].includes(l.id)?900:600),align=l.align||'middle';
  const common={className:`poster-layer ${l.id===selectedId?'poster-selected':''}`,'data-layer-id':l.id,onPointerDown:(e:React.PointerEvent)=>onLayerPointerDown?.(e,l.id),style:{cursor:onLayerPointerDown?(l.locked?'pointer':'move'):undefined}};
  if(l.kind==='photo'){
   const w=l.width*10,h=H*(l.height??71)/100,px=x-w/2,py=y-h/2,cutout=text.includes('cutout');
   return <g key={l.id} {...common} data-photo-layer="true" opacity={l.opacity??1} transform={l.rotate?`rotate(${l.rotate} ${x} ${y})`:undefined}>
    <image href={text} x={px} y={py} width={w} height={h} preserveAspectRatio={cutout?'xMidYMax meet':'xMidYMin slice'} mask={u('photoFade')}/>
    {selection(l,px,py,w,h)}
   </g>;
  }
  if(l.kind==='crest')return <g key={l.id} {...common} opacity={l.opacity??1}><circle cx={x} cy={y} r={l.size*.57} fill="#071521" opacity=".72"/><image href={text} x={x-l.size/2} y={y-l.size/2} width={l.size} height={l.size} preserveAspectRatio="xMidYMid meet"/>{selection(l,x-l.size/2,y-l.size/2,l.size,l.size)}</g>;
  if(l.kind==='rule')return <g key={l.id} {...common} opacity={l.opacity??1}><rect x={align==='start'?x:align==='end'?x-l.width*10:x-l.width*5} y={y} width={l.width*10} height={l.size} rx={l.size/2} fill={l.color}/>{selection(l,x-l.width*5,y,l.width*10,l.size)}</g>;
  const maxWidth=Math.max(10,Math.min(l.width*10,align==='start'?975-x:align==='end'?x-25:2*Math.min(x-25,975-x))),font=l.font||(['label','score'].includes(l.id)?fonts[t.font]:fonts.sans),main=['label','score','club'].includes(l.id),m=fitText(text,l.size,maxWidth,font,weight,main&&!/^[\d\s–—-]+$/.test(text),l.tracking??(l.kind==='sponsor'?1.7:0)),gap=m.size*1.06,baseline=y-(m.lines.length-1)*gap;
  const color=l.color||ink,header=l.id==='club'||l.id==='competition';
  return <g key={l.id} {...common} opacity={l.opacity??1} transform={l.rotate?`rotate(${l.rotate} ${x} ${y})`:undefined}>
   <text x={x} y={baseline} fontFamily={font} fontSize={m.size} fontWeight={weight} letterSpacing={m.tracking} textAnchor={align} fill={l.outline?'none':color} stroke={l.outline?color:header?'#03111d':'none'} strokeOpacity={l.outline?1:.8} strokeWidth={l.outline?2:header?2.5:0} paintOrder="stroke fill">{m.lines.map((line,i)=><tspan key={i} x={x} dy={i?gap:0} textLength={m.widths[i]} lengthAdjust="spacingAndGlyphs">{line}</tspan>)}</text>
   {selection(l,align==='start'?x:align==='end'?x-maxWidth:x-maxWidth/2,baseline-m.size*.84,maxWidth,m.size+gap*(m.lines.length-1))}
  </g>;
 }
 const sx=75,sy=H*.18,sw=850,sh=H*.39,widgetInk=t.light?'#152b37':'#ffffff',widgetBase=t.light?'#fcfaf5':'#101c2b';
 const widget=type==='Opstelling'?<g data-content-layout="formation-pitch"><rect x={sx} y={sy} width={sw} height={sh} rx="12" fill="#163f35" fillOpacity=".96" stroke="#b4cdc3" strokeWidth="2"/><path d={`M${sx} ${sy+sh*.5}h${sw}M${sx+sw*.3} ${sy}v${sh*.16}h${sw*.4}v-${sh*.16}M${sx+sw*.3} ${sy+sh}v-${sh*.16}h${sw*.4}v${sh*.16}`} stroke="#b0c7b8" strokeWidth="2" fill="none"/><circle cx={sx+sw*.5} cy={sy+sh*.5} r={sh*.13} fill="none" stroke="#b0c7b8"/>{[[.5,.87],[.15,.65],[.38,.65],[.62,.65],[.85,.65],[.24,.4],[.5,.36],[.76,.4],[.18,.14],[.5,.12],[.82,.14]].map(([cx,cy],i)=><g key={i}><circle cx={sx+cx*sw} cy={sy+cy*sh} r={wide?13:22} fill={primary} stroke={secondary} strokeWidth="2"/><text x={sx+cx*sw} y={sy+cy*sh+(wide?4:7)} textAnchor="middle" fill={luminance(primary)>.34?'#08131d':'#ffffff'} fontFamily={fonts.sans} fontSize={wide?12:19} fontWeight="800">{data?.[`lineup.${i+1}.number`]||i+1}</text></g>)}</g>:type==='Weekenduitslagen'?<g data-content-layout="results-list">{[0,1,2].map(n=><g key={n} transform={`translate(${sx} ${sy+n*sh/3})`}><rect width={sw} height={sh/3-8} rx="7" fill={widgetBase} fillOpacity=".97"/><text x="20" y={sh/6} fill={widgetInk} fontSize={wide?14:25} fontFamily={fonts.sans} fontWeight="700">{data?.[`results.${n}.team`]||['O14-1','EERSTE ELFTAL','O19-1'][n]}</text><text x={sw*.51} y={sh/6+8} textAnchor="middle" fill={widgetInk} fontSize={wide?36:60} fontWeight="900" fontFamily={fonts.condensed}>{data?.[`results.${n}.score`]||(n===0?data?.['match.score']||'3 – 2':'–')}</text><text x={sw-20} y={sh/6} textAnchor="end" fill={widgetInk} fontSize={wide?12:18} fontFamily={fonts.sans}>{data?.[`results.${n}.opponent`]||(n===0?'FC HAVENLICHT':'NOG IN TE VULLEN')}</text></g>)}</g>:type==='Wissel'?<g data-content-layout="substitution-cards">{[0,1].map(n=><g key={n} transform={`translate(${sx+n*(sw/2+7)} ${sy})`}><rect width={sw/2-14} height={sh} rx="10" fill={widgetBase} fillOpacity=".97" stroke={n?'#d98e82':'#84c79a'} strokeWidth="2"/><path d={`M${sw/4-30} ${sh*.2}h60m-20 -18l20 18-20 18`} fill="none" stroke={n?'#d98e82':'#84c79a'} strokeWidth="5" transform={n?`rotate(180 ${sw/4} ${sh*.2})`:undefined}/><text x={sw/4-7} y={sh*.66} textAnchor="middle" fontFamily={fonts.condensed} fontSize={wide?76:135} fontWeight="900" fill={widgetInk}>{data?.[n?'sub.out.number':'sub.in.number']||(n?'9':'14')}</text><text x={sw/4-7} y={sh*.86} textAnchor="middle" fontFamily={fonts.sans} fontSize={wide?12:20} fill={widgetInk}>{n?'GAAT ERUIT':'KOMT ERIN'}</text></g>)}</g>:null;
 return <svg className={`poster-svg poster-selected-template template-${t.id} ${motion?'poster-motion':''}`} data-template-id={t.id} data-content-type={type} data-layout-version="4" viewBox={`0 0 1000 ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label={`${type} · ${t.name} · ${data?.['club.name']||'SC Getijde'}`} style={{display:'block',width:'100%',height:'100%',background:base}}>
  <defs>
   <clipPath id={'canvas'+id}><rect width="1000" height={H}/></clipPath>
   <linearGradient id={'photoAlpha'+id} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#ffffff"/><stop offset=".58" stopColor="#ffffff"/><stop offset=".77" stopColor="#ffffff" stopOpacity="0"/></linearGradient>
   <mask id={'photoFade'+id} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height={H}><rect width="1000" height={H} fill={u('photoAlpha')}/></mask>
   <linearGradient id={'baseGlow'+id} x1="0" y1="0" x2="1" y2="1"><stop stopColor={primary}/><stop offset="1" stopColor={secondary}/></linearGradient>
  </defs>
  <g clipPath={u('canvas')}>
   <g data-layer-group="onderlaag" aria-hidden="true"><rect width="1000" height={H} fill={base}/><path d={`M0 0H1000V${H*.4}L0 ${H*.68}Z`} fill={u('baseGlow')} opacity={t.light?.23:.36}/><path d={`M-160 0L400 ${H}H540L-20 0Z`} fill={secondary} opacity=".1"/></g>
   <g data-layer-group="gebruikersfoto">{layers.filter(l=>l.visible&&l.kind==='photo').map(renderLayer)}</g>
   <g data-layer-group="effectoverlay" aria-hidden="true" pointerEvents="none"><svg x="0" y="0" width="1000" height={H} viewBox={frameView} preserveAspectRatio="none" overflow="hidden"><image href={atlas} width="3000" height="3750" preserveAspectRatio="none"/></svg></g>
   {structured&&widget}
   <g data-layer-group="automatische-inhoud">{layers.filter(l=>l.visible&&l.kind!=='photo').map(renderLayer)}</g>
   {['Gele kaart','Rode kaart'].includes(type)&&<rect data-content-layout="disciplinary-card" x="816" y={H*.19} width="77" height={wide?83:117} rx="6" fill={type==='Rode kaart'?'#e93f46':'#f5d747'} transform={`rotate(8 850 ${H*.24})`}/>}
   {safe&&<g className="poster-safe-area" pointerEvents="none"><rect x="55" y={H*.06} width="890" height={H*.88} fill="none" stroke="#c8ff24" strokeWidth="2" strokeDasharray="8 8"/><text x="65" y={H*.06+18} fill="#c8ff24" fontSize="12" fontFamily={fonts.sans}>VEILIGE ZONE</text></g>}
  </g>
 </svg>;
}
export default SelectedTemplatePoster;
