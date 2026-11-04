import {newId} from './ids';
import React,{createContext,useContext,useEffect,useState,useRef,useCallback} from 'react';
import {templateCatalog} from './templateCatalog';
import {createDemoV1,normalizeV1,normalizeContent,reconcileDerivedContent,type Persistence} from './v1Workflow';
export type Role='club'|'team'|'platform';
export const formats=['Story','Portret','Vierkant','Breed'];
export const contentTypes=['Matchday','Opstelling','Aftrap','Doelpunt','Assist','Gele kaart','Rode kaart','Wissel','Ruststand','Einduitslag','Speler van de wedstrijd','Wedstrijdverslag','Nieuwe speler','Verjaardag','Kampioenschap','Toernooiresultaat','Afgelasting','Clubnieuws','Evenement','Sponsorbericht','Weekenduitslagen'];
export const families=templateCatalog.map(t=>t.name);
export type TemplateRequest={id:string;clubId:string;clubName:string;title:string;brief:string;status:'Nieuw'|'In behandeling'|'Gereed'|'Afgewezen';createdAt:string;templateId?:string};
export type CustomTemplate={id:string;name:string;clubId:string;baseFamily:string;description:string;active:boolean;createdAt:string;requestId?:string;design?:any};
export const channels=['Instagram Story','Facebook Story','Instagram-feed','Facebook-feed','X-post'];
export const initial={
 activeMatchId:'m1',
 v1:createDemoV1(),
 club:{id:'cl1',name:'SC Getijde',color:'#2463eb',accent:'#ffffff',hashtags:'#SCGetijde #SamenGetijde',youthNames:'Voornaam + initiaal',plan:'Club',trial:false},
 templateRequests:[] as TemplateRequest[],
 customTemplates:[] as CustomTemplate[],
 teams:[{id:'t1',name:'Eerste elftal',category:'Senioren',manager:'Noor Vermeer',family:'Penseelkracht',active:true},{id:'t2',name:'O19-1',category:'Jeugd',manager:'Mila Jansen',family:'Scheurlijn',active:true},{id:'t3',name:'O17-1',category:'Jeugd',manager:'Lars Peters',family:'Zwitsers sport',active:true},{id:'t4',name:'O14-1',category:'Jeugd',manager:'Sam de Wit',family:'Penseelkracht',active:true},{id:'t5',name:'O12-1',category:'Jeugd',manager:'Eline de Groot',family:'Tactiekatlas',active:true},{id:'t6',name:'O10-1',category:'Jeugd',manager:'Daan Vos',family:'Snelheid',active:true}],
 players:[{id:'p1',name:'Robin Bakker',number:9,position:'Aanvaller',team:'O14-1',consent:true,photo:'/assets/player-1.webp'},{id:'p2',name:'Jesse van Dijk',number:7,position:'Middenvelder',team:'O14-1',consent:true,photo:'/assets/player-2.webp'},{id:'p3',name:'Milan Smit',number:1,position:'Keeper',team:'O14-1',consent:false,photo:'/assets/player-3.webp'},{id:'p4',name:'Finn de Jong',number:4,position:'Verdediger',team:'O14-1',consent:true,photo:'/assets/player-4.webp'}],
 users:[{id:'u1',name:'Timo van Leeuwen',email:'timo@scgetijde.example',role:'Clubbeheerder',teams:'Alle teams'},{id:'u2',name:'Noor Vermeer',email:'noor@scgetijde.example',role:'Communicatiebeheerder',teams:'Alle teams'},{id:'u3',name:'Sam de Wit',email:'sam@scgetijde.example',role:'Teammanager',teams:'O14-1'},{id:'u4',name:'Mila Jansen',email:'mila@scgetijde.example',role:'Trainer',teams:'O19-1'}],
 matches:[{id:'m1',home:'SC Getijde',away:'FC Havenlicht',team:'O14-1',date:'2026-10-20',time:'18:30',location:'Sportpark Getijde · veld 1',status:'live',homeScore:2,awayScore:1},{id:'m2',home:'SC Getijde',away:'SV Noordhaven',team:'Eerste elftal',date:'2026-10-24',time:'14:30',location:'Sportpark Getijde · veld 1',status:'scheduled',homeScore:0,awayScore:0},{id:'m3',home:'VV Duinrand',away:'SC Getijde',team:'O19-1',date:'2026-10-24',time:'12:00',location:'Sportpark Duinrand',status:'scheduled',homeScore:0,awayScore:0},{id:'m4',home:'SC Getijde',away:'SV Noordhaven',team:'O14-1',date:'2026-10-17',time:'10:30',location:'Sportpark Getijde',status:'finished',homeScore:3,awayScore:2}],
 content:[{id:'c1',homeScore:3,awayScore:2,matchId:'m4',opponent:'SV Noordhaven',title:'Sterke tweede helft tegen Noordhaven',type:'Wedstrijdverslag',team:'O14-1',status:'review',version:1,caption:'Wat een tweede helft! Met veel inzet en samenspel knokten we ons terug naar een verdiende 3–2 overwinning. Trots op dit team! 💙 #SCGetijde #SamenGetijde',date:'2026-10-20T17:30',author:'Sam de Wit',image:'/assets/team-celebration.webp',feedback:'',jobs:[]},{id:'c2',homeScore:0,awayScore:0,matchId:'m2',opponent:'SV Noordhaven',approvedVersion:2,title:'Zaterdag is van ons.',type:'Matchday',team:'Eerste elftal',status:'scheduled',version:2,caption:'Thuis. Samen. Alles geven. Zaterdag om 14:30 ontvangen we SV Noordhaven. Zien we jou langs de lijn? #SCGetijde',date:'2026-10-24T09:00',author:'Noor Vermeer',image:'/assets/match-action.webp',feedback:'',jobs:[{channel:'Instagram-feed',status:'scheduled'},{channel:'Facebook-feed',status:'scheduled'}]},{id:'c3',homeScore:3,awayScore:2,matchId:'m4',opponent:'SV Noordhaven',approvedVersion:1,title:'Drie punten. Eén team.',type:'Einduitslag',team:'O14-1',status:'published',version:1,caption:'Eindstand: SC Getijde 3–2 SV Noordhaven. Drie punten blijven aan de kust! #SamenGetijde',date:'2026-10-17T12:20',author:'Sam de Wit',image:'/assets/team-photo.webp',feedback:'',jobs:[{channel:'Instagram Story',status:'published'},{channel:'Facebook Story',status:'published'},{channel:'X-post',status:'failed'}]},{id:'c4',homeScore:0,awayScore:0,matchId:'',opponent:'',title:'Onze nieuwe nummer 9',type:'Nieuwe speler',team:'Eerste elftal',status:'draft',version:1,caption:'Welkom bij de club! Een nieuw hoofdstuk in blauw en wit.',date:'2026-10-25T12:00',author:'Noor Vermeer',image:'/assets/player-1.webp',feedback:'',jobs:[]}] as any[],
 events:[{matchId:'m1',id:'e1',type:'Doelpunt',player:'Robin Bakker',minute:12},{matchId:'m1',id:'e2',type:'Tegendoelpunt',player:'FC Havenlicht',minute:28},{matchId:'m1',id:'e3',type:'Doelpunt',player:'Jesse van Dijk',minute:41}] as any[],
 clubs:[{id:'cl1',name:'SC Getijde',plan:'Club',teams:6,status:'Actief',contact:'Timo van Leeuwen'},{id:'cl2',name:'FC Havenlicht',plan:'Start',teams:5,status:'Actief',contact:'Lotte Bos'},{id:'cl3',name:'SV Noordhaven',plan:'Pro',teams:6,status:'Proefperiode',contact:'Bas Meijer'}],
 connections:[{name:'Instagram',handle:'@scgetijde',connected:true},{name:'Facebook',handle:'SC Getijde',connected:true},{name:'X',handle:'@scgetijde',connected:false},{name:'Sportlink',handle:'Club.Dataservice',connected:false}],
 rules:{} as Record<string,string>,
 activity:[{id:'a1',text:'Sam de Wit leverde een wedstrijdverslag aan',detail:'O14-1 · Versie 1 · Wacht op moderatie',time:'14:42'},{id:'a2',text:'Noor Vermeer plande een Matchday-post',detail:'Eerste elftal · Instagram en Facebook',time:'14:15'},{id:'a3',text:'X-publicatie vraagt aandacht',detail:'Einduitslag O14-1 · Bestemming tijdelijk niet beschikbaar',time:'12:20'}]
};
// Keep the fictitious pilot weekend current when the demo starts.
const saturday=new Date();saturday.setHours(12,0,0,0);saturday.setDate(saturday.getDate()+(6-saturday.getDay()+7)%7);
const demoDate=(offset=0)=>{const date=new Date(saturday);date.setDate(date.getDate()+offset);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;};
initial.matches=initial.matches.map(match=>({...match,date:demoDate(match.id==='m4'?-7:0)}));
initial.content=initial.content.map(item=>normalizeContent({...item,date:`${demoDate(item.id==='c3'?-7:0)}T${item.id==='c2'?'09:00':'17:30'}`,clubId:initial.club.id,scoreConfirmed:true}));
export type AppState=typeof initial;
const Context=createContext<any>(null);
const legacyFamilies:Record<string,number>={Broadcast:1,Clean:34,Grit:2,Spotlight:25,Editorial:31,Signal:5,Heritage:33,Energy:23,Premium:46,Community:39};
function migrateState(saved:any):AppState{
 const next={...initial,...saved,club:{...initial.club,...saved?.club},v1:normalizeV1(saved?.v1),templateRequests:Array.isArray(saved?.templateRequests)?saved.templateRequests:[],customTemplates:Array.isArray(saved?.customTemplates)?saved.customTemplates:[]};
 const matching=next.clubs.find((c:any)=>c.name===next.club.name);next.club.id=saved?.club?.id||matching?.id||initial.club.id;
 next.teams=(next.teams||[]).map((t:any)=>({...t,family:templateCatalog.find(f=>f.name.toLowerCase()===String(t.family).toLowerCase()||f.id===legacyFamilies[t.family])?.name||families[0]}));
 next.content=(next.content||[]).map((content:any)=>normalizeContent({...content,clubId:content.clubId||next.club.id}));return reconcileDerivedContent(next);
}

export function currentClubId(state:AppState){return state.club.id||state.clubs.find(c=>c.name===state.club.name)?.id||'cl1';}
const storageKey='castiq-demo-v1';
export function Provider({children}:{children:React.ReactNode}){
 const[state,setRawState]=useState<AppState>(()=>{try{const saved=localStorage.getItem(storageKey);return migrateState(saved?JSON.parse(saved):initial)}catch{return migrateState(initial)}});
 const setState=useCallback<React.Dispatch<React.SetStateAction<AppState>>>((action)=>setRawState(current=>reconcileDerivedContent(typeof action==='function'?action(current):action)),[]);
 const[persistence,setPersistence]=useState<Persistence>({status:'saving',savedAt:null});const[notice,setNotice]=useState('');const otherTab=useRef(false);const latestState=useRef(state);latestState.current=state;
 useEffect(()=>{setPersistence(p=>({...p,status:'saving'}));const handle=window.setTimeout(()=>{
  if(otherTab.current){setPersistence(p=>({...p,status:'error',error:'Deze demo is in een ander tabblad gewijzigd. Herlaad om de nieuwste versie te openen; deze tab overschrijft die gegevens niet.'}));return;}
  try{localStorage.setItem(storageKey,JSON.stringify(state));setPersistence({status:'saved',savedAt:new Date().toISOString()});}
  catch{setPersistence(p=>({...p,status:'error',error:'Automatisch bewaren is niet gelukt: de browseropslag is vol of geblokkeerd. Houd dit tabblad open en verklein grote foto’s. Wijzigingen staan nog in deze sessie.'}));}
 },200);return()=>window.clearTimeout(handle);},[state]);
 useEffect(()=>{const flush=()=>{if(otherTab.current)return;try{localStorage.setItem(storageKey,JSON.stringify(latestState.current));}catch{setPersistence(p=>({...p,status:'error',error:'De laatste wijziging kon niet in de browser worden bewaard. Houd dit tabblad open en verklein grote foto’s.'}));}};const hide=()=>{if(document.visibilityState==='hidden')flush();};window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',hide);return()=>{window.removeEventListener('pagehide',flush);document.removeEventListener('visibilitychange',hide);};},[]);
 useEffect(()=>{const changed=(event:StorageEvent)=>{if(event.key===storageKey&&event.newValue){otherTab.current=true;setPersistence(p=>({...p,status:'error',error:'Een ander tabblad heeft deze demo bijgewerkt. Herlaad voordat je verdergaat; deze tab overschrijft die gegevens niet.'}));}};window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);},[]);
 function toast(message:string){setNotice(message);setTimeout(()=>setNotice(''),4000)}
 function log(text:string,detail=''){setState(s=>({...s,activity:[{id:newId(),text,detail,time:new Date().toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})},...s.activity]}))}
 return <Context.Provider value={{state,setState,toast,log,persistence}}>{children}{persistence.status==='error'&&<div className="v1-storage-warning" role="alert" style={{position:'fixed',bottom:12,left:12,right:12,zIndex:99999,padding:'14px 20px',borderRadius:12,background:'#fff4df',border:'1px solid #e7ad45',color:'#673e00',boxShadow:'0 5px 30px #0002'}}><strong>Bewaren vraagt aandacht. </strong>{persistence.error}</div>}{notice&&<div className="toast" role="status">{notice}</div>}</Context.Provider>
}
export const useCastiq=()=>useContext(Context) as {state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;toast:(s:string)=>void;log:(a:string,b?:string)=>void;persistence:Persistence};

export function publicationMode(state:AppState,team:string,type:string,channel:string){return state.rules[`${team}|${type}|${channel}`]||(type==='Einduitslag'&&(channel.includes('Story')||channel==='X-post')?'auto':'review')}
export function channelConnected(state:AppState,channel:string){const name=channel.startsWith('Instagram')?'Instagram':channel.startsWith('Facebook')?'Facebook':'X';return state.connections.some(c=>c.name===name&&c.connected)}
export function publicPlayerName(name:string,privacy:string){if(privacy==='Anoniem')return 'Speler';if(privacy==='Voornaam')return name.split(' ')[0];if(privacy==='Volledige naam')return name;const parts=name.split(' ');return parts[0]+(parts.length>1?' '+parts.at(-1)![0]+'.':'')}
