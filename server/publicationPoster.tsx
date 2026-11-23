import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PosterSvg,type Layer,type PosterFormat} from '../src/Poster';
import {toPosterLayers,type StudioRatio} from '../src/template-studio/managedTemplates';

/** Uses only the approved immutable payload; never a current club/template row. */
export function posterMarkup(payload:any,ratio:StudioRatio){
 const render=payload.render,data=render.data,template=render.templateSnapshot||payload.templateSnapshot;
 const format=({'4:5':'portrait','9:16':'story','1:1':'square','16:9':'wide'} as const)[ratio];
 if(!template?.layouts?.[ratio])throw new Error('publication_template_snapshot_missing');
 const score=payload.noScore?'SAMEN GESPEELD':data.scoreConfirmed===false?'UITSLAG VOLGT':`${payload.homeScore??0} – ${payload.awayScore??0}`;
 const clubName=String(data.clubName||''),fixture=data.fixtureLabel||`${clubName} × ${payload.opponent||'CLUBMOMENT'}`;
 const fields={clubName:clubName.toUpperCase(),homeName:data.matchHome||clubName,awayName:data.matchAway||payload.opponent||'',clubLogo:data.clubLogo||'',homeLogo:!data.matchHome||data.matchHome===clubName?data.clubLogo||'':'',awayLogo:data.matchAway===clubName?data.clubLogo||'':'',photo:payload.photoUsage!=='no_photo'&&payload.photoConsent==='approved'?payload.image||'':'',title:payload.title||'',subtitle:payload.caption||'',competition:String(payload.team||'DE HELE CLUB').toUpperCase(),fixture,score,homeScore:payload.noScore?'':String(payload.homeScore??0),awayScore:payload.noScore?'':String(payload.awayScore??0),matchDate:data.matchDate||'',matchTime:data.matchTime||'',venue:data.matchLocation||'',matchInfo:[data.matchDate,data.matchLocation].filter(Boolean).join(' · '),sponsorLogo:payload.sponsorLogo||'',sponsorName:payload.sponsorName||'SAMEN ZIJN WIJ DE CLUB',playerName:String(payload.playerName||'').toUpperCase()};
 const layers:Layer[]=toPosterLayers(template.layouts[ratio],ratio,fields);
 if(data.momentTitle){const layer=layers.find(layer=>layer.id==='label');if(layer)layer.text=data.momentTitle;}
 if(payload.type==='Weekenduitslagen'){
  const entries=Array.isArray(payload.reportEntries)?payload.reportEntries:[];
  for(const [index,entry] of entries.slice(0,6).entries()){
   const y=22+index*6.2,wide=format==='wide';
   layers.push({id:`report-bg-${index}`,name:'Uitslagachtergrond',kind:'rule',text:'',x:8,y:y-3.4,size:wide?28:62,width:84,align:'start',color:'#0b1b2b',visible:true,locked:true,opacity:.96});
   layers.push({id:`report-team-${index}`,name:'Team in terugblik',kind:'text',text:String(entry.team||'CLUBMOMENT'),x:10,y,width:55,size:wide?17:29,align:'start',font:'Inter,Arial,sans-serif',weight:700,color:'#ffffff',visible:true,locked:true});
   layers.push({id:`report-score-${index}`,name:'Bevestigde uitslag',kind:'text',text:entry.score||'SAMEN GESPEELD',x:89,y,width:26,size:wide?19:34,align:'end',font:'Barlow Condensed,Impact,sans-serif',weight:800,color:'#ffffff',visible:true,locked:true});
  }
  if(!entries.length)layers.push({id:'report-empty',name:'Nog geen uitslagen',kind:'text',text:'VERHALEN VOLGEN',x:50,y:37,width:78,size:format==='wide'?34:57,align:'middle',color:'#b4c4d2',visible:true,locked:true});
 }
 if(payload.sponsorLogo&&!template.layouts[ratio].some((layer:any)=>layer.binding==='sponsorLogo'))layers.push({id:'assigned-sponsor-logo',name:'Sponsorlogo',kind:'crest',text:payload.sponsorLogo,x:9,y:96,size:42,width:5,color:'#ffffff',visible:true,locked:true,opacity:1});
 return renderToStaticMarkup(<PosterSvg layers={layers} partnerLogo={render.partnerLogo===true} contentType={payload.type==='Weekenduitslagen'?'Clubnieuws':payload.type} format={format as PosterFormat} primary={render.primary} secondary={render.secondary} family={template.family||render.family} data={{'club.name':clubName.toUpperCase(),'team.name':fields.competition,'match.score':score,'player.name':fields.playerName,'match.opponent':fixture,'sponsor.name':fields.sponsorName}}/>);
}
