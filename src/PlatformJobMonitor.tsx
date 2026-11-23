import React,{useState} from 'react';
import {Ellipsis,RefreshCw,Search,Send,ShieldCheck} from 'lucide-react';
import {useCastiq} from './store';
import {usePlatformOperations} from './usePlatformOperations';
import type {OperationalJob} from './platformOperationsTypes';
import {Badge,Empty,Modal,PageTitle} from './ui';
import './platform-jobs.css';
const dates=new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Amsterdam',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const date=(value:string|null)=>value&&Number.isFinite(Date.parse(value))?dates.format(new Date(value)):'—';
const filters=[['all','Alle opdrachten'],['failed','Mislukt'],['awaiting_confirmation','Onbevestigd'],['in_progress','Gepland of in wachtrij'],['paused','Gepauzeerd'],['published','Met bewijs bevestigd'],['cancelled','Vervallen'],['other','Andere status']];
function status(job:OperationalJob){
  if(job.group==='published')return <Badge status="published">{job.confirmation==='sandbox'?'Sandbox bevestigd':'Extern bevestigd'}</Badge>;
  if(job.group==='awaiting_confirmation')return <Badge status="awaiting_confirmation">Onbevestigd</Badge>;
  if(job.status==='processing'||job.status==='running')return <Badge status="queued">In verwerking</Badge>;
  if(job.group==='other')return <Badge status="draft">Onbekende status</Badge>;
  return <Badge status={job.status}/>;
}
export function PlatformJobMonitor(){
  const {actor}=useCastiq();
  const {data,errors,loading,refresh}=usePlatformOperations(true,`${actor?.id||''}:${actor?.clubId||''}`);
  const [query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[selectedId,setSelectedId]=useState<string|null>(null);
  const jobs=data.jobs,failed=errors.includes('kanaalopdrachten');
  const term=query.trim().toLocaleLowerCase('nl-NL');
  const visible=jobs?.items.filter(job=>(filter==='all'||job.group===filter)&&`${job.id} ${job.channel} ${job.clubName}`.toLocaleLowerCase('nl-NL').includes(term))||[];
  const selected=jobs?.items.find(job=>job.id===selectedId);
  return <div className="platform-jobs">
    <PageTitle title="Kanaaljobs" description="Volg status, pogingen en bevestigingen per vereniging en kanaal." actions={<button className="btn btn-secondary" disabled={loading} onClick={refresh}><RefreshCw size={16}/> Vernieuwen</button>}/>
    {failed&&<p className="platform-jobs-error" role="alert">Kanaalopdrachten zijn niet ververst. {jobs?'De eerder geladen gegevens blijven zichtbaar.':'Er zijn nog geen gegevens beschikbaar.'}<button className="text-btn" disabled={loading} onClick={refresh}>Opnieuw laden</button></p>}
    <section className="platform-jobs-panel" aria-labelledby="platform-jobs-list-title" aria-busy={loading}>
      <div className="platform-jobs-heading"><div><Send size={17}/><h2 id="platform-jobs-list-title">Opdrachten</h2></div><span>{jobs?`${visible.length} zichtbaar · ${jobs.total} totaal`:'Nog niet geladen'}</span></div>
      <div className="platform-jobs-filters"><label className="search-field"><Search size={16}/><input type="search" aria-label="Zoek kanaaljob" placeholder="Zoek vereniging, kanaal of referentie…" value={query} onChange={event=>setQuery(event.target.value)}/></label><select aria-label="Filter op opdrachtstatus" value={filter} onChange={event=>setFilter(event.target.value)}>{filters.map(([key,label])=><option key={key} value={key}>{label}{jobs?` (${key==='all'?jobs.total:jobs.counts[key as keyof typeof jobs.counts]})`:''}</option>)}</select></div>
      {jobs?.truncated&&<p className="platform-jobs-notice">De {jobs.limit} meest recent bijgewerkte opdrachten zijn geladen. De statustellingen omvatten alle {jobs.total} opdrachten; zoeken en filteren gelden voor de geladen selectie.</p>}
      {!jobs?<p className="platform-jobs-notice" role="status">{loading?'Kanaalopdrachten laden…':'Kanaalgegevens nog niet beschikbaar.'}</p>:visible.length?<table className="platform-jobs-table"><thead><tr><th scope="col">Kanaal en vereniging</th><th scope="col">Status</th><th scope="col">Versie</th><th scope="col">Poging</th><th scope="col">Gepland</th><th scope="col" aria-label="Acties"/></tr></thead><tbody>{visible.map(job=><tr key={job.id}><th scope="row">{job.channel}<small>{job.clubName}</small><small>{job.id}</small></th><td>{status(job)}</td><td className="platform-job-version">v{job.revision}</td><td className="platform-job-attempt">{job.attempt}</td><td className="platform-job-scheduled">{date(job.scheduledAt)}</td><td className="platform-job-action"><button className="icon-btn" aria-label={`Details ${job.channel}, ${job.id}`} onClick={()=>setSelectedId(job.id)}><Ellipsis size={18}/></button></td></tr>)}</tbody></table>:<Empty title={jobs.total?'Geen opdrachten gevonden':'Geen kanaalopdrachten'} description={jobs.total?'Pas de zoekopdracht of statusfilter aan.':'Opdrachten verschijnen zodra een club een goedgekeurde bijdrage inplant.'}/>}
    </section>
    <p className="platform-jobs-caption"><ShieldCheck size={15}/> Een sandboxbevestiging is een testuitkomst. Alleen providerbewijs bevestigt een externe publicatie.</p>
    {selected&&<Modal title={`Opdracht · ${selected.channel}`} onClose={()=>setSelectedId(null)}><div className="platform-job-detail"><div className="platform-job-detail-state">{status(selected)}</div><dl><div><dt>Vereniging</dt><dd>{selected.clubName}</dd></div><div><dt>Referentie</dt><dd>{selected.id}</dd></div><div><dt>Versie van opdracht</dt><dd>v{selected.revision}</dd></div><div><dt>Poging</dt><dd>{selected.attempt}</dd></div><div><dt>Gepland</dt><dd>{date(selected.scheduledAt)}</dd></div><div><dt>Bevestiging</dt><dd>{selected.confirmation==='sandbox'?'Sandboxbewijs':selected.confirmation==='provider'?'Providerbewijs':'Nog geen passend bewijs'}{selected.confirmedAt&&<><br/>{date(selected.confirmedAt)}</>}</dd></div></dl></div></Modal>}
  </div>;
}
