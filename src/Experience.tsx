import React, {useState} from 'react';
import {ArrowUpRight, ArrowRight, Check, CheckCircle2, Palette, Users, ShieldCheck, Link2, Layers3, Goal, Smartphone, LayoutDashboard, Building2, Sparkles, Play, ChevronRight} from 'lucide-react';
import {Role, useCastiq} from './store';
import {PageTitle} from './ui';

export function DemoPortal({onEnter}:{onEnter:(role:Role,page?:string)=>void}) {
  const [path,setPath]=useState('moment');
  const paths:Record<string,{title:string;copy:string;role:Role;page:string;steps:string[]}>= {
    moment:{title:'Van eindstand naar clubpost.',copy:'Begin als teammanager, maak een uitslagbeeld en bekijk daarna dezelfde bijdrage vanuit de clubredactie.',role:'team',page:'matches',steps:['Selecteer een wedstrijd','Vul de eindstand in','Controleer je clubvisual','Bevestig de publicatieroute']},
    redactie:{title:'Alle teams. Eén redactie.',copy:'Een teammanager heeft een verslag ingestuurd. Bekijk de exacte versie, geef feedback of keur de bijdrage goed.',role:'club',page:'moderation',steps:['Open de inzending','Controleer beeld en caption','Beoordeel deze versie','Volg iedere bestemming']},
    ontwerp:{title:'Bouw de stijl van de club.',copy:'Open de studio, kies een template en maak een herkenbare clubvariant met eigen kleuren en vaste sponsorposities.',role:'club',page:'studio',steps:['Kies een template','Maak de clubvariant','Controleer alle formaten','Bewaar het ontwerp']},
  };
  const selected=paths[path];
  return <div className="demo-portal premium-portal">
    <div className="portal-nav"><a href="#/website/1"><img src="/assets/logo-dark.svg" alt="CASTIQ"/></a><a href="#/website/1">Naar de website <ArrowUpRight size={16}/></a></div>
    <div className="portal-intro"><span className="eyebrow"><i/> WELKOM IN DE CASTIQ PRODUCTTOUR</span><h1>Één club.<br/><em>Alle perspectieven.</em></h1><p>Van het eerste teammoment tot de laatste kanaalcheck. Ontdek hoe de hele vereniging samenwerkt, in één gedeelde voorbeeldclub.</p><span className="portal-demo-note">INTERACTIEVE DEMO · FICTIEVE CLUBGEGEVENS</span></div>
    <div className="portal-cards">{[
      {role:'team' as Role,label:'VOOR DE TEAMMANAGER',title:'Jij ziet het moment.',copy:'Geef een uitslag door, leg een goal vast of stuur je teamverhaal in. De clubstijl staat al voor je klaar.',icon:Smartphone,tags:'Vandaag · Wedstrijden · Mijn bijdragen'},
      {role:'club' as Role,label:'VOOR DE CLUBREDACTIE',title:'Jij bewaakt het verhaal.',copy:'Breng alle teams samen. Ontwerp de clubtemplates, beoordeel inzendingen en houd grip op je kanalen.',icon:LayoutDashboard,tags:'Cockpit · Studio · Moderatie · Planning'},
      {role:'platform' as Role,label:'VOOR DE PLATFORMBEHEERDER',title:'Jij overziet het speelveld.',copy:'Volg verenigingen, templates en kanaaljobs vanuit je cockpit.',icon:Building2,tags:'Cockpit · Verenigingen · Template Studio'},
    ].map(({role,label,title,copy,icon:I,tags},i)=><button key={role} className={'portal-card portal-'+role} onClick={()=>onEnter(role)}><span className="portal-card-index">0{i+1} /</span><span className="portal-icon"><I size={28}/></span><span className="eyebrow">{label}</span><h2>{title}</h2><p>{copy}</p><small className="portal-card-tags">{tags}</small><span className="portal-link">Open omgeving <ArrowUpRight size={21}/></span></button>)}</div>
    <section className="portal-scenario"><div className="portal-scenario-intro"><span className="eyebrow">LIEVER METEEN AAN DE SLAG?</span><h2>Probeer één<br/>clubmoment.</h2><p>Kies een startpunt en doorloop een herkenbare taak. Je kunt in de demo steeds van rol wisselen.</p></div><div><div className="scenario-tabs" aria-label="Kies een voorbeeldroute">{[['moment','Uitslag maken'],['redactie','Bijdrage beoordelen'],['ontwerp','Clubtemplate ontwerpen']].map(([id,label])=><button aria-pressed={path===id} className={path===id?'active':''} key={id} onClick={()=>setPath(id)}>{label}</button>)}</div><h3>{selected.title}</h3><p>{selected.copy}</p><ol className="scenario-steps">{selected.steps.map((s,i)=><li key={s}><span>{i+1}</span>{s}</li>)}</ol><button className="btn btn-primary" onClick={()=>onEnter(selected.role,selected.page)}><Play size={15}/> Start deze route <ArrowRight size={16}/></button></div></section>
    <div className="portal-bottom"><button onClick={()=>onEnter('club','analysis')}><Layers3 size={18}/> Bekijk het volledige Castiq-concept <ArrowRight size={16}/></button><small>Wijzigingen blijven in deze browser bewaard. Socialpublicaties, uitnodigingen en koppelingen worden gesimuleerd.</small></div>
  </div>;
}

export function WorkspaceGuide({onNavigate,onCreate}:{onNavigate:(page:string)=>void;onCreate:()=>void}){
  const {state}=useCastiq();
  const [confirmed,setConfirmed]=useState<string[]>(()=>{try{return JSON.parse(localStorage.getItem('castiq-setup-'+((state.club as any).id||state.club.name))||'[]')}catch{return []}});
  const key='castiq-setup-'+((state.club as any).id||state.club.name);
  const steps=[
    {id:'brand',label:'Maak de club herkenbaar',copy:'Naam, logo, kleuren, lettertypes en afspraken voor jeugdnamen vormen het vertrekpunt voor ieder ontwerp.',page:'brand',icon:Palette,summary:state.club.name+' · '+state.club.color},
    {id:'teams',label:'Breng de teams bij elkaar',copy:'Voeg teams toe en leg vast wie ze beheert. Iedere teammanager werkt alleen met de toegewezen teams.',page:'teams',icon:Users,summary:state.teams.length+' teams in de clubomgeving'},
    {id:'users',label:'Geef de juiste mensen toegang',copy:'Verdeel de taken tussen clubbeheer, redactie, trainers en teammanagers. Controleer per persoon welke teams bereikbaar zijn.',page:'users',icon:ShieldCheck,summary:state.users.length+' gebruikers in de demo'},
    {id:'studio',label:'Zet de clubtemplates klaar',copy:'Gebruik een platformmaster als basis. Maak een eigen clubvariant en bescherm logo’s, sponsorposities en andere vaste onderdelen.',page:'studio',icon:Layers3,summary:'Vier formaten · één herkenbare clubstijl'},
    {id:'rules',label:'Spreek af wat er online mag',copy:'Stel per team, berichttype en bestemming in: automatisch na bevestiging, eerst modereren, alleen concept of uitgeschakeld.',page:'rules',icon:ShieldCheck,summary:Object.keys(state.rules).length+' specifieke publicatieafspraken'},
    {id:'channels',label:'Bereid de clubkanalen voor',copy:'Controleer de kanaalverbindingen en toegestane bestemmingen. In dit prototype oefen je de verbinding zonder echte socialaccounts.',page:'channels',icon:Link2,summary:state.connections.filter(c=>c.connected&&c.name!=='Sportlink').length+' gesimuleerde socialverbindingen'},
  ];
  function toggle(id:string){setConfirmed(s=>{const next=s.includes(id)?s.filter(x=>x!==id):[...s,id];localStorage.setItem(key,JSON.stringify(next));return next})}
  const count=steps.filter(s=>confirmed.includes(s.id)).length;
  return <div className="workspace-guide"><PageTitle eyebrow="DE AFTRAP VAN JOUW CLUB" title="Een sterke clubstem begint hier." description="Loop samen de inrichting na. Open een onderdeel, werk het bij en markeer de stap als gecontroleerd wanneer jouw club er klaar voor is."/>
    <section className="setup-hero card"><div><span className="eyebrow">JOUW CLUB. JOUW AFSPRAKEN.</span><h2>Klaar voor het<br/><em>eerste clubmoment.</em></h2><p>Begin klein: één team, één herkenbare template en een duidelijke route naar de redactie. Daarna groeit de rest van de club mee.</p></div><div className="setup-progress"><strong>{count}<small>/ 6</small></strong><span>onderdelen door jou gecontroleerd</span><div role="progressbar" aria-label="Voortgang clubinrichting" aria-valuenow={count} aria-valuemin={0} aria-valuemax={6}><i style={{width:(count/6*100)+'%'}}/></div><small>De checklist volgt jouw beoordeling.</small></div></section>
    <div className="setup-grid">{steps.map(({id,label,copy,page,icon:I,summary},i)=><article className={'setup-card card '+(confirmed.includes(id)?'is-complete':'')} key={id}><div className="setup-card-top"><span>0{i+1}</span><I size={22}/></div><h3>{label}</h3><p>{copy}</p><small>{summary}</small><div className="setup-card-actions"><button className="btn btn-secondary" onClick={()=>onNavigate(page)}>Open onderdeel <ArrowUpRight size={15}/></button><button className="setup-check" aria-pressed={confirmed.includes(id)} onClick={()=>toggle(id)}>{confirmed.includes(id)?<CheckCircle2 size={17}/>:<span/>}{confirmed.includes(id)?'Gecontroleerd':'Markeer als gecontroleerd'}</button></div></article>)}</div>
    <section className="setup-first-post"><span className="setup-first-icon"><Sparkles size={30}/></span><div><span className="eyebrow">MAAK HET CONCREET</span><h2>Geef het eerste moment een podium.</h2><p>Controleer je clubvisual en de route per bestemming. Je kunt altijd eerst een concept bewaren.</p></div><button className="btn btn-primary" disabled={!state.teams.length} onClick={onCreate}>Maak een clubmoment <ArrowRight size={17}/></button></section>{!state.teams.length&&<p className="muted">Voeg eerst een team toe om een clubmoment te maken.</p>}
  </div>;
}
