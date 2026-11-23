import React,{useEffect,useState} from 'react';
import {ArrowUpRight,ArrowRight,Camera,CalendarDays,ShieldCheck,Clock,CheckCircle2,AlertCircle,WifiOff,Download,RefreshCw,Send,FileText,Zap,Ellipsis,Search} from 'lucide-react';
import {useCastiq,type Role} from './store';
import {PageTitle,Badge,DownloadData,Empty,Modal} from './ui';
import {normalizeContent,processPublication,retryPublication} from './v1Workflow';
import './v1-workspace.css';
import './platform-jobs.css';
import {PlatformJobMonitor} from './PlatformJobMonitor';

export function SaveIndicator(){
 const ctx=useCastiq() as any;const[online,setOnline]=useState(navigator.onLine);
 useEffect(()=>{const update=()=>setOnline(navigator.onLine);window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update)}},[]);
 const p=ctx.persistence,error=p?.status==='error',server=ctx.mode==='server';
 function downloadRecovery(){const recovery=Object.fromEntries(Object.keys(localStorage).filter(key=>key.startsWith(`castiq-recovery:${ctx.actor?.id}:${ctx.actor?.clubId}:`)).map(key=>{try{return [key,JSON.parse(localStorage.getItem(key)||'null')]}catch{return [key,null]}}));DownloadData('castiq-herstelkopie.json',{state:ctx.state,recovery});}
 return <div className={'v1-save-strip '+(error?'v1-save-error':'')} role="status"><span>{!online?<WifiOff size={15}/>:error?<AlertCircle size={15}/>:<CheckCircle2 size={15}/>}<b>{error?'Bewaren mislukt · eigen invoer behouden':!online?'Offline · nog niet gesynchroniseerd':p?.status==='saving'?'Bezig met bewaren…':server?'Bewaard in clubomgeving':'Op dit apparaat bewaard'}</b>{p?.savedAt&&!error&&<small>{new Date(p.savedAt).toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})}</small>}</span>{error?<span><button onClick={downloadRecovery}><Download size={14}/> Herstelkopie</button>{server&&<button onClick={()=>void ctx.reload().catch(()=>{})}><RefreshCw size={14}/> Serverversie laden</button>}</span>:<small>{server?(ctx.authMode==='local'?'Lokale testomgeving · sandboxkanalen':`${ctx.environment==='production'?'Productie':ctx.environment==='staging'?'Staging':'Clubomgeving'} · ${(ctx.state as any).publicationMode==='provider'?'clubkanalen zelf koppelen':'sandboxpublicatie'}`):'Prototype · kanaalpublicaties zijn simulaties'}</small>}{error&&<small role="alert">{p.error}</small>}</div>

}

export function V1Home({role,onNavigate,onCreate,onDetail}:{role:Role;onNavigate:(p:string)=>void;onCreate:(type?:string,context?:any)=>void;onDetail:(id:string)=>void}){
 const{state,actor,mode,command,toast}=useCastiq();const[busy,setBusy]=useState(false);const team=role==='team';const items=state.content.filter(c=>!team||c.team===(actor?.team||'O14-1')).map(normalizeContent);
 const review=items.filter(c=>c.status==='review'),errors=items.filter(c=>c.jobs.some((j:any)=>j.status==='failed'||j.status==='awaiting_confirmation'));
 const approved=items.filter(c=>c.approvedVersion===c.version),confirmed=items.flatMap(c=>c.jobs).filter((j:any)=>j.status==='published'&&(mode==='demo'?j.receipt?.kind==='demo':j.receipt?.kind==='provider'&&!!j.receipt?.providerPostId)).length;
 const active=state.teams.filter(t=>t.active),covered=new Set(items.filter(c=>c.status!=='draft').map(c=>c.team));
 const actions=team?[{title:'Een foto. Een moment.',text:'Voeg je foto, uitslag en verhaal toe. De clubstijl staat klaar.',label:'Moment aanleveren',icon:Camera,run:()=>onCreate('Einduitslag')},{title:'Jouw bijdragen',text:'Concepten, feedback en de actuele versie op één plek.',label:'Bekijk bijdragen',icon:FileText,run:()=>onNavigate('content')}]:[{title:'De clubweek',text:'Kies de teams en momenten. Zet samenhangende concepten klaar.',label:'Clubweek voorbereiden',icon:CalendarDays,run:()=>onNavigate('week')},{title:'Het weekendverhaal',text:'Breng goedgekeurde teamverhalen en uitslagen samen.',label:'Weekend samenstellen',icon:FileText,run:()=>onNavigate('weekend')},{title:'Sponsorafspraken',text:mode==='demo'?'Plan zichtbaarheid en volg bevestigde demo-vermeldingen.':'Plan zichtbaarheid en volg het bewijs van gepubliceerde versies.',label:'Afspraken beheren',icon:Zap,run:()=>onNavigate('sponsors')}];
 return <><PageTitle eyebrow={team?`LANGS DE LIJN · ${actor?.team||'O14-1'}`:'CASTIQ · JOUW CLUBWEEK'} title={team?'Jij beleeft het. De club deelt het.':'Een hele club. Eén herkenbaar verhaal.'} description={team?`Lever een moment aan in de clubstijl. Je concept wordt automatisch ${mode==='server'?'in de clubomgeving':'op dit apparaat'} bewaard.`:'Van teamfoto tot gecontroleerde publicatie. Zie wat klaarstaat en wat nog jouw aandacht vraagt.'} actions={<button className="btn btn-primary" onClick={()=>onCreate('Einduitslag')}><Camera size={17}/> {team?'Moment aanleveren':'Content maken'}</button>}/>{mode==='server'&&!team&&<div className="info-banner"><ShieldCheck size={22}/><span><b>{(state.v1 as any).publicationPaused?'Publicaties gepauzeerd':'Publicatiecontrole'}</b><small>{(state as any).publicationMode==='provider'?'Publiceren vereist een geactiveerde clubkoppeling en goedkeuring van de exacte versie. Pauzeren blokkeert nieuwe verzendingen.':'Alle kanalen werken uitsluitend in de expliciete sandbox. Pauzeren blokkeert nieuwe opdrachten en uitvoering.'}</small></span><button className="btn btn-secondary" disabled={busy} onClick={async()=>{setBusy(true);try{await command('publication.pause',{paused:!(state.v1 as any).publicationPaused});toast('Publicatiepauze bijgewerkt.');}catch(e){toast((e as Error).message);}finally{setBusy(false)}}}>{(state.v1 as any).publicationPaused?'Hervatten':'Publicaties pauzeren'}</button></div>}<section className="v1-home-hero"><div><span className="eyebrow">VAN HET VELD NAAR JE VOLGERS</span><h2>{team?<>Een mooi moment<br/>begint bij jou.</>:<>Het weekend staat<br/>vol clubverhalen.</>}</h2><p>{team?'Kies de wedstrijd, voeg een beeld toe en vertel kort wat er gebeurde. De redactie krijgt jouw actuele versie.':'Geef alle teams een plek. Verzamel hun bijdragen, bewaak de clubstijl en weet per kanaal waar je aan toe bent.'}</p><button className="btn btn-primary" onClick={()=>team?onCreate('Einduitslag'):onNavigate('week')}>{team?'Mijn moment toevoegen':'Zet de clubweek klaar'}<ArrowRight size={17}/></button><span className="v1-hero-caption">27 clubtemplates · eigen clubkleuren · centrale redactie</span></div><img src="/assets/team-celebration.webp" alt="Sfeerbeeld van een voetbalteam"/></section><div className="v1-home-stats">{[[team?'Mijn inzendingen':'Ter beoordeling',team?items.length:review.length,'content',FileText],['Goedgekeurde versies',approved.length,'moderation',ShieldCheck],['Vraagt opvolging',errors.length,'content',AlertCircle],[mode==='demo'?'Bevestigde demo-kanalen':'Extern bevestigde kanalen',confirmed,'content',CheckCircle2]].map(([label,count,page,Icon]:any)=><button key={label} onClick={()=>onNavigate(team?'content':page)}><Icon size={19}/><strong>{count}</strong><span>{label}</span><ArrowUpRight size={15}/></button>)}</div><div className="v1-action-grid">{actions.map(a=><section className="card v1-action-card" key={a.title}><a.icon size={25}/><h3>{a.title}</h3><p>{a.text}</p><button className="text-btn" onClick={a.run}>{a.label}<ArrowRight size={15}/></button></section>)}</div><div className="grid-2"><section className="card panel"><div className="section-heading"><h2>{team?'Je recente momenten':'De redactie is aan zet'}</h2><button className="text-btn" onClick={()=>onNavigate(team?'content':'moderation')}>Alles bekijken <ArrowRight size={15}/></button></div>{(team?items:review).slice(0,4).map(c=><button key={c.id} className="list-row" onClick={()=>onDetail(c.id)}><span className="content-icon"><FileText size={18}/></span><span className="grow"><b>{c.title}</b><small>{c.team} · versie {c.version}{c.feedback?' · '+c.feedback:''}</small></span><Badge status={c.status}/><ArrowUpRight size={15}/></button>)}{!(team?items:review).length&&<p className="muted">Helemaal bij. Nieuwe bijdragen verschijnen hier.</p>}</section><section className="card panel"><div className="section-heading"><h2>{team?'Zo loopt jouw bijdrage':'Iedereen in beeld'}</h2><ShieldCheck size={20}/></div>{team?<ol className="v1-flow-list"><li>Je moment blijft als concept bewaard.</li><li>De club beoordeelt precies jouw ingediende versie.</li><li>Wijzig je iets? Dan volgt opnieuw beoordeling.</li><li>Een kanaal telt pas mee na een bevestiging.</li></ol>:<><p className="muted">{covered.size} teams hebben een ingediende bijdrage. {mode==='demo'?'Dit is een overzicht van deze demodata, geen beoordeling van teams.':'Dit is een overzicht van ingediende clubbijdragen, geen beoordeling van teams.'}</p><div className="v1-team-coverage">{active.map(t=><span key={t.id}><i className={covered.has(t.name)?'covered':''}/>{t.name}<small>{items.filter(c=>c.team===t.name).length} bijdragen</small></span>)}</div></>}</section></div>{!!errors.length&&<section className="card panel"><div className="section-heading"><h2>Publicatie vraagt aandacht</h2><AlertCircle size={20}/></div>{errors.slice(0,3).map(c=><button key={c.id} className="list-row" onClick={()=>onDetail(c.id)}><span className="grow"><b>{c.title}</b><small>{c.jobs.filter((j:any)=>['failed','awaiting_confirmation'].includes(j.status)).map((j:any)=>j.channel).join(' · ')}</small></span><span className="badge badge-failed">Controle nodig</span><ArrowUpRight size={16}/></button>)}</section>}</>
}

type MonitorJob = {
  id: string;
  contentId: string;
  channel: string;
  status: string;
  version: number;
  currentVersion: number;
  approvedVersion?: number;
  attempt: number;
  scheduledAt?: string;
  error?: string;
  receipt?: { providerPostId?: string; postId?: string; id?: string; confirmedAt?: string };
};
type JobOutcome = 'confirmed' | 'failed' | 'timeout' | 'retry';

const monitorTime = new Intl.DateTimeFormat('nl-NL', {timeZone:'Europe/Amsterdam', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'});
function formatJobTime(value?: string) {
  const timestamp = value ? Date.parse(value) : NaN;
  return Number.isFinite(timestamp) ? monitorTime.format(timestamp) : '—';
}

export function V1JobMonitor(){
  const {mode}=useCastiq();
  return mode==='server'?<PlatformJobMonitor/>:<DemoJobMonitor/>;
}

function DemoJobMonitor(){
  const {state, setState, toast, mode} = useCastiq();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<{contentId:string; id:string} | null>(null);
  const demo = mode === 'demo';
  const filters = [
    ['all','Alle opdrachten'], ['queued','Wachtrij'], ['scheduled','Gepland'], ['processing','In verwerking'],
    ['awaiting_confirmation','Onbevestigd'], ['failed','Mislukt'], ['published',demo ? 'Demo bevestigd' : 'Gepubliceerd'],
    ['paused','Gepauzeerd'], ['cancelled','Vervallen'],
  ];
  const jobs: MonitorJob[] = state.content.flatMap(raw => {
    const content = demo ? normalizeContent(raw) : raw;
    return (content.jobs || []).map(job => ({
      id: job.id, contentId: content.id, channel: job.channel, status: job.status,
      version: job.version || content.version, currentVersion: content.version,
      approvedVersion: content.approvedVersion, attempt: job.attempt || 1,
      scheduledAt: job.scheduledAt,
      error: demo && typeof job.error === 'string' ? job.error : undefined,
      receipt: job.receipt,
    }));
  });
  const counts = new Map<string, number>();
  for (const job of jobs) counts.set(job.status, (counts.get(job.status) || 0) + 1);

  const normalizedQuery = query.trim().toLocaleLowerCase('nl-NL');
  const visible = jobs.filter(job => (filter === 'all' || job.status === filter) &&
    `${job.id} ${job.channel}`.toLocaleLowerCase('nl-NL').includes(normalizedQuery));
  const selected = selection ? jobs.find(job => job.contentId === selection.contentId && job.id === selection.id) : undefined;

  function action(job: MonitorJob, outcome: JobOutcome){
    if (!demo) return;
    try {
      const content = state.content.find(item => item.id === job.contentId);
      if (!content) return;
      const updated = outcome === 'retry' ? retryPublication(content, job.id) : processPublication(content, job.id, outcome);
      setState(current => ({...current, content: current.content.map(item => item.id === job.contentId ? updated : item)}));
      toast(outcome === 'retry' ? 'Opdracht staat opnieuw in de demo-wachtrij.' : outcome === 'confirmed' ? 'Demo-bevestiging vastgelegd.' : 'Demo-uitkomst vastgelegd.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'De actie kon niet worden uitgevoerd.');
    }
  }

  function jobStatus(job: MonitorJob) {
    if (job.status === 'published' && demo) return <Badge status="published">Demo bevestigd</Badge>;
    if (job.status === 'processing') return <Badge status="queued">In verwerking</Badge>;
    return <Badge status={job.status}/>;
  }

  return <div className="platform-jobs">
    <PageTitle title="Kanaaljobs" description="Volg de status, pogingen en bevestigingen per publicatiekanaal."/>
    <section className="platform-jobs-panel" aria-labelledby="platform-jobs-list-title">
      <div className="platform-jobs-heading"><div><Send size={17}/><h2 id="platform-jobs-list-title">Opdrachten</h2></div><span>{visible.length} van {jobs.length}</span></div>
      <div className="platform-jobs-filters">
        <label className="search-field"><Search size={16}/><input type="search" aria-label="Zoek kanaaljob" placeholder="Zoek kanaal of referentie…" value={query} onChange={event => setQuery(event.target.value)}/></label>
        <select aria-label="Filter op opdrachtstatus" value={filter} onChange={event => setFilter(event.target.value)}>
          {filters.map(([key, label]) => <option value={key} key={key}>{label} ({key === 'all' ? jobs.length : counts.get(key) || 0})</option>)}
        </select>
      </div>
      {visible.length ? <table className="platform-jobs-table">
        <thead><tr><th scope="col">Kanaal</th><th scope="col">Status</th><th scope="col">Versie</th><th scope="col">Poging</th><th scope="col">Gepland</th><th scope="col" aria-label="Acties"/></tr></thead>
        <tbody>{visible.map(job => <tr key={`${job.contentId}:${job.id}`}>
          <th scope="row">{job.channel}<small>{job.id}</small></th>
          <td>{jobStatus(job)}</td><td className="platform-job-version">v{job.version}</td><td className="platform-job-attempt">{job.attempt}</td>
          <td className="platform-job-scheduled">{formatJobTime(job.scheduledAt)}</td>
          <td className="platform-job-action"><button className="icon-btn" type="button" aria-label={`Details ${job.channel}, ${job.id}`} title="Opdrachtdetails" onClick={() => setSelection({contentId:job.contentId, id:job.id})}><Ellipsis size={18}/></button></td>
        </tr>)}</tbody>
      </table> : <Empty title={jobs.length ? 'Geen opdrachten gevonden' : 'Geen kanaalopdrachten'} description={jobs.length ? 'Pas de zoekopdracht of statusfilter aan.' : 'Kanaalopdrachten verschijnen zodra een club een goedgekeurde bijdrage inplant.'}/>}
    </section>
    {demo && <p className="platform-jobs-caption"><ShieldCheck size={15}/> Kanaalsimulator. Bevestigingen en fouten zijn onderdeel van de demo.</p>}
    {selected && <Modal title={`Opdracht · ${selected.channel}`} onClose={() => setSelection(null)}>
      <div className="platform-job-detail">
        <div className="platform-job-detail-state">{jobStatus(selected)}</div>
        <dl>
          <div><dt>Referentie</dt><dd>{selected.id}</dd></div>
          <div><dt>Versie van opdracht</dt><dd>v{selected.version}</dd></div>
          <div><dt>Huidige versie</dt><dd>v{selected.currentVersion} · {selected.approvedVersion === selected.currentVersion ? 'goedgekeurd' : 'nieuwe beoordeling nodig'}</dd></div>
          <div><dt>Poging</dt><dd>{selected.attempt}</dd></div>
          {selected.scheduledAt && <div><dt>Gepland</dt><dd>{formatJobTime(selected.scheduledAt)}</dd></div>}
          {selected.receipt && <div><dt>Bevestiging</dt><dd>{demo ? 'Demo · ' : ''}{selected.receipt.providerPostId || selected.receipt.postId || selected.receipt.id || 'Vastgelegd'}{selected.receipt.confirmedAt && <><br/>{formatJobTime(selected.receipt.confirmedAt)}</>}</dd></div>}
          {selected.error && <div><dt>Foutmelding</dt><dd>{selected.error}</dd></div>}
        </dl>
        {demo && <div className="platform-job-detail-actions">
          {['queued','scheduled','awaiting_confirmation'].includes(selected.status) && <>
            <button className="btn btn-primary" type="button" onClick={() => action(selected,'confirmed')}><CheckCircle2 size={15}/> Demo bevestigen</button>
            <button className="btn btn-secondary" type="button" onClick={() => action(selected,'failed')}><AlertCircle size={15}/> Fout simuleren</button>
            <button className="btn btn-secondary" type="button" onClick={() => action(selected,'timeout')}><Clock size={15}/> Geen bevestiging</button>
          </>}
          {selected.status === 'failed' && <button className="btn btn-secondary" type="button" onClick={() => action(selected,'retry')}><RefreshCw size={15}/> Opnieuw in wachtrij</button>}
        </div>}
      </div>
    </Modal>}
  </div>;
}
