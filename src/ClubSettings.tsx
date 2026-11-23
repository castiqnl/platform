import React,{useRef,useState} from 'react';
import {Save,ShieldCheck,Plus} from 'lucide-react';
import {useCastiq,families} from './store';
import {PageTitle} from './ui';
import {PrivateImage} from './PrivateImage';
import {isFamilyAvailable} from './template-studio/managedTemplates';

const policies=[['initials','Voornaam + initiaal'],['first','Alleen voornaam'],['anonymous','Anoniem'],['full','Volledige naam']];
const youth=(name:string)=>/^O(?:[6-9]|10)(?:\D|$)/i.test(name);
const policyOptions=()=>policies.map(([value,label])=><option key={value} value={value}>{label}</option>);
const newTeam=()=>({id:'',name:'',category:'Jeugd',family:families[0],active:true,publishScores:true,namePolicy:'initials',version:1});
const newPlayer=(team:string)=>({id:'',name:'',number:'',team,namePolicy:'initials',photoConsent:'unknown',version:1});
const clubForm=(club:any)=>({...club,logo:club.logo||'',namePolicy:club.namePolicy||'initials',version:club.version||1});

/** All writes use the same server version checks as editorial content. */
export function ClubSettings(){
 const{state,actor,command,upload,toast,mode}=useCastiq();
 const[club,setClub]=useState<any>(()=>clubForm(state.club)),[team,setTeam]=useState<any>(newTeam),[player,setPlayer]=useState<any>(()=>newPlayer(state.teams[0]?.name||''));
 const[match,setMatch]=useState<any>({team:state.teams[0]?.name||'',opponent:'',atHome:true,date:'',time:'',location:'',status:'scheduled',homeScore:'',awayScore:''});
 const[busy,setBusy]=useState(false),[error,setError]=useState('');const saving=useRef(false);
 const availableFamilies=mode==='demo'?families.filter(family=>isFamilyAvailable(family,state.club.id)):families.filter(family=>(state.templates||[]).some(template=>template.family===family));
 const selectedTeam:any=state.teams.find(t=>t.name===match.team);const noScore=youth(match.team)||selectedTeam?.publishScores===false;
 async function run(type:string,data:any,done?:(state:any)=>void){if(saving.current)return;saving.current=true;setBusy(true);setError('');try{const result=await command(type,data);done?.(result.state);toast(mode==='demo'?'Opgeslagen op dit apparaat.':'Centraal opgeslagen.');}catch(error){setError((error as Error).message);}finally{saving.current=false;setBusy(false);}}
 async function uploadLogo(file?:File){if(!file||saving.current)return;saving.current=true;setBusy(true);setError('');try{const result=await upload(file,'Clubbreed');setClub((old:any)=>({...old,logo:result.url}));}catch(error){setError((error as Error).message);}finally{saving.current=false;setBusy(false);}}
 if(actor?.role!=='club')return <div className="card" role="alert">Alleen de bevoegde clubredactie kan de clubinrichting beheren.</div>;
 return <div><PageTitle eyebrow="CLUBINRICHTING" title="Jullie club. Jullie afspraken." description="Stel de clubkleuren in, voeg eigen teams en wedstrijden toe en leg naam- en fotovoorkeuren vast."/>
 {error&&<div className="ed-inline-error" role="alert">{error} Je invoer blijft in dit scherm staan. Controleer bij een versieconflict de actuele gegevens voordat je opnieuw opslaat.</div>}
 <div className="grid-2" style={{alignItems:'start'}}>
 <section className="card" style={{padding:24}}><h2>Club en huisstijl</h2><form onSubmit={event=>{event.preventDefault();void run('club.settings',{club,expectedRevision:club.version},next=>setClub(clubForm(next.club)));}}>
 <label className="field">Clubnaam<input required maxLength={120} value={club.name} onChange={e=>setClub({...club,name:e.target.value})}/></label>
 <div className="grid-2"><label className="field">Primaire clubkleur<input type="color" value={club.color} onChange={e=>setClub({...club,color:e.target.value})}/></label><label className="field">Secundaire clubkleur<input type="color" value={club.accent} onChange={e=>setClub({...club,accent:e.target.value})}/></label></div>
 <label className="field">Clubhashtags<input maxLength={500} value={club.hashtags||''} onChange={e=>setClub({...club,hashtags:e.target.value})}/></label>
 <label className="field">Minimale naamvoorkeur<select value={club.namePolicy} onChange={e=>setClub({...club,namePolicy:e.target.value})}>{policyOptions()}</select><small>Een strengere team- of spelersvoorkeur blijft gelden.</small></label>
 <label className="field">Clublogo<input type="file" disabled={busy} accept="image/png,image/jpeg,image/webp" onChange={e=>void uploadLogo(e.target.files?.[0])}/><small>Alleen beveiligde uploads binnen jullie eigen club. Maximaal 8 MB.</small></label>
 {club.logo&&<div style={{display:'flex',gap:12,alignItems:'center',marginBottom:16}}><PrivateImage src={club.logo} alt="Eigen clublogo" style={{width:64,height:64,objectFit:'contain'}}/><button className="btn btn-secondary" type="button" onClick={()=>setClub({...club,logo:''})}>Logo verwijderen</button></div>}
 <button className="btn btn-primary" disabled={busy}><Save size={16}/> Clubinstellingen bewaren</button></form></section>
 <section className="card" style={{padding:24}}><h2>Teams</h2><label className="field">Team bewerken<select value={team.id} onChange={e=>{const selected:any=state.teams.find(t=>t.id===e.target.value);setTeam(selected?{...selected,namePolicy:selected.namePolicy||'initials',publishScores:selected.publishScores!==false,version:selected.version||1}:newTeam());}}><option value="">Nieuw team</option>{state.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
 <form onSubmit={event=>{event.preventDefault();void run('team.save',{team,...(team.id?{expectedRevision:team.version}:{})},()=>setTeam(newTeam()));}}>
 <label className="field">Teamnaam<input required maxLength={80} value={team.name} placeholder="Bijvoorbeeld O14-1" onChange={e=>setTeam({...team,name:e.target.value})}/><small>Een teamnaam die in gebruik is kan niet worden gewijzigd.</small></label>
 <label className="field">Categorie<select value={team.category} onChange={e=>setTeam({...team,category:e.target.value})}><option>Jeugd</option><option>Senioren</option><option>Overig</option></select></label>
 <label className="field">Standaardstijl<select value={team.family} onChange={e=>setTeam({...team,family:e.target.value})}>{!availableFamilies.includes(team.family)&&<option value={team.family} disabled>{team.family} · Uitgeschakeld</option>}{availableFamilies.map(family=><option key={family}>{family}</option>)}</select></label>
 <label className="field">Naamvoorkeur<select value={team.namePolicy} onChange={e=>setTeam({...team,namePolicy:e.target.value})}>{policyOptions()}</select></label>
 <label className="checkbox-line"><input type="checkbox" checked={team.active} onChange={e=>setTeam({...team,active:e.target.checked})}/>Team actief</label>
 <label className="checkbox-line"><input type="checkbox" disabled={youth(team.name)} checked={!youth(team.name)&&team.publishScores} onChange={e=>setTeam({...team,publishScores:e.target.checked})}/>Uitslagen openbaar gebruiken</label>
 <p className="muted">Voor O10 en jonger worden nooit openbare uitslagen getoond.</p><button className="btn btn-primary" disabled={busy}><Save size={16}/> Team bewaren</button></form></section>
 <section className="card" style={{padding:24}}><h2>Spelers en privacy</h2><p className="muted">Bewaar alleen de naam, het team, eventueel het rugnummer en de benodigde publicatievoorkeuren.</p><label className="field">Speler bewerken<select value={player.id} onChange={e=>{const selected:any=state.players.find(p=>p.id===e.target.value);setPlayer(selected?{...selected,number:selected.number??'',namePolicy:selected.namePolicy||'initials',photoConsent:selected.photoConsent||(selected.consent?'approved':'unknown'),version:selected.version||1}:newPlayer(state.teams[0]?.name||''));}}><option value="">Nieuwe speler</option>{state.players.map(p=><option key={p.id} value={p.id}>{p.name} · {p.team}</option>)}</select></label>
 <form onSubmit={event=>{event.preventDefault();void run('player.save',{player:{...player,number:player.number===''?null:Number(player.number)},...(player.id?{expectedRevision:player.version}:{})},()=>setPlayer(newPlayer(player.team)));}}>
 <label className="field">Naam<input required maxLength={120} value={player.name} onChange={e=>setPlayer({...player,name:e.target.value})}/></label>
 <label className="field">Team<select required value={player.team} onChange={e=>setPlayer({...player,team:e.target.value})}><option value="" disabled>Kies een team</option>{state.teams.map(t=><option key={t.id}>{t.name}</option>)}</select></label>
 <label className="field">Rugnummer · optioneel<input type="number" min="0" max="99" value={player.number} onChange={e=>setPlayer({...player,number:e.target.value})}/></label>
 <label className="field">Naam in openbare berichten<select value={player.namePolicy} onChange={e=>setPlayer({...player,namePolicy:e.target.value})}>{policyOptions()}</select></label>
 <label className="field">Fotogebruik<select value={player.photoConsent} onChange={e=>setPlayer({...player,photoConsent:e.target.value})}><option value="unknown">Nog niet gecontroleerd</option><option value="approved">Fotogebruik toegestaan</option><option value="denied">Niet publiceren</option></select></label>
 <p className="muted"><ShieldCheck size={15}/> Strengere privacykeuzes trekken betrokken goedkeuringen en open publicatieopdrachten in. Eerder ontvangen publicatiebewijs blijft bewaard.</p><button className="btn btn-primary" disabled={busy||!state.teams.length}><Save size={16}/> Speler bewaren</button></form></section>
 <section className="card" style={{padding:24}}><h2>Wedstrijd handmatig toevoegen</h2><p className="muted">Deze eigen invoer wordt als handmatige bron opgeslagen. Er is geen externe wedstrijdkoppeling actief.</p><form onSubmit={event=>{event.preventDefault();const payload:any={team:match.team,home:match.atHome?state.club.name:match.opponent,away:match.atHome?match.opponent:state.club.name,date:match.date,time:match.time,location:match.location,status:match.status};if(match.status==='finished'&&!noScore){payload.homeScore=Number(match.homeScore);payload.awayScore=Number(match.awayScore);}void run('match.create',{match:payload},()=>setMatch({...match,opponent:'',homeScore:'',awayScore:''}));}}>
 <label className="field">Team<select required value={match.team} onChange={e=>setMatch({...match,team:e.target.value})}><option value="" disabled>Kies een team</option>{state.teams.filter(t=>t.active).map(t=><option key={t.id}>{t.name}</option>)}</select></label>
 <label className="field">Tegenstander<input required maxLength={120} value={match.opponent} onChange={e=>setMatch({...match,opponent:e.target.value})}/></label>
 <label className="field">Thuis of uit<select value={match.atHome?'home':'away'} onChange={e=>setMatch({...match,atHome:e.target.value==='home'})}><option value="home">Thuis</option><option value="away">Uit</option></select></label>
 <div className="grid-2"><label className="field">Wedstrijddatum<input type="date" required value={match.date} onChange={e=>setMatch({...match,date:e.target.value})}/></label><label className="field">Aanvang · Nederlandse tijd<input type="time" required value={match.time} onChange={e=>setMatch({...match,time:e.target.value})}/></label></div>
 <label className="field">Locatie · optioneel<input maxLength={180} value={match.location} onChange={e=>setMatch({...match,location:e.target.value})}/></label>
 <label className="field">Status<select value={match.status} onChange={e=>setMatch({...match,status:e.target.value})}><option value="scheduled">Gepland</option><option value="finished">Afgelopen</option></select></label>
 {match.status==='finished'&&!noScore&&<div className="grid-2"><label className="field">Thuisstand<input type="number" required min="0" max="99" value={match.homeScore} onChange={e=>setMatch({...match,homeScore:e.target.value})}/></label><label className="field">Uitstand<input type="number" required min="0" max="99" value={match.awayScore} onChange={e=>setMatch({...match,awayScore:e.target.value})}/></label></div>}
 {noScore&&<p className="muted">Voor dit team worden geen uitslagen ingevoerd of openbaar getoond.</p>}<button className="btn btn-primary" disabled={busy||!state.teams.some(t=>t.active)}><Plus size={16}/> Wedstrijd bewaren</button></form></section>
 </div></div>;
}
