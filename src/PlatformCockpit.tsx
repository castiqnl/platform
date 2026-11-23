import React, {useEffect, useState} from 'react';
import {
  Activity, Building2, CalendarClock, CheckCircle2, ChevronRight, CircleAlert, CreditCard,
  FileClock, Layers3, Mail, RefreshCw, ShieldCheck, Users,
} from 'lucide-react';
import {api} from './serverClient';
import {useCastiq} from './store';
import {managedTemplates, type ManagedTemplate} from './template-studio/managedTemplates';
import {emptyJobCounts,jobGroup,type TemplateOperations} from './platformOperationsTypes';
import {usePlatformOperations} from './usePlatformOperations';
import './platform-cockpit.css';

type ClubSummary = {id: string; members: number};
type AccountSummary = {status: string};
type PrivacySummary = {status: string; due_at: string};
type MailSummary = {outbox: {status: string; count: number}[]};
type Overview = {
  clubs: ClubSummary[] | null;
  accounts: AccountSummary[] | null;
  cases: PrivacySummary[] | null;
  outbox: MailSummary['outbox'] | null;
};
const emptyOverview: Overview = {clubs: null, accounts: null, cases: null, outbox: null};
const clock = new Intl.DateTimeFormat('nl-NL', {hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam'});
const displayDate = new Intl.DateTimeFormat('nl-NL', {weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam'});
const shortDate = new Intl.DateTimeFormat('nl-NL', {day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam'});

function usePlatformOverview(demo:boolean,scope:string) {
  const [overview, setOverview] = useState<Overview>(emptyOverview);
  const [request, setRequest] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  useEffect(()=>{setOverview(emptyOverview);setErrors([]);setUpdatedAt(null);},[scope,demo]);
  useEffect(() => {
    let active = true;setLoading(true);
    const reads:[keyof Overview,string,Promise<unknown>][] = [
      ['clubs','verenigingen',api<{clubs:ClubSummary[]}>('/api/admin/clubs').then(value=>value.clubs)],
      ...(demo ? [
        ['accounts','registraties',api<{accounts:AccountSummary[]}>('/api/admin/users').then(value=>value.accounts)],
        ['cases','privacyzaken',api<{cases:PrivacySummary[]}>('/api/privacy/cases').then(value=>value.cases)],
        ['outbox','e-mail',api<MailSummary>('/api/admin/mail').then(value=>value.outbox)],
      ] as [keyof Overview,string,Promise<unknown>][] : []),
    ];
    void Promise.allSettled(reads.map(read=>read[2])).then(results=>{
      if(!active)return;
      setOverview(previous=>{const next={...previous};results.forEach((result,index)=>{if(result.status==='fulfilled')(next[reads[index][0]] as unknown)=result.value;});return next;});
      const failed=reads.filter((_,index)=>results[index].status==='rejected').map(read=>read[1]);setErrors(failed);
      if(failed.length<reads.length)setUpdatedAt(new Date());setLoading(false);
    });
    return()=>{active=false;};
  },[request,demo,scope]);
  return {overview,loading,errors,updatedAt,refresh:()=>setRequest(value=>value+1)};
}

const channelStates = [
  {key: 'failed', label: 'Mislukt', color: '#f29a83'},
  {key: 'awaiting_confirmation', label: 'Onbevestigd', color: '#efc680'},
  {key: 'in_progress', label: 'Gepland of in wachtrij', color: '#7daee8'},
  {key: 'published', label: 'Bevestigd', color: '#b1dc73'},
  {key: 'paused', label: 'Gepauzeerd', color: '#bca9da'},
  {key: 'cancelled', label: 'Vervallen', color: '#808b99'},
  {key: 'other', label: 'Andere status', color: '#89959e'},
] as const;

export function PlatformCockpit({onNavigate}: {onNavigate: (page: string) => void}) {
  const {state, mode,actor} = useCastiq();
  const demo=mode==='demo',scope=`${actor?.id||'demo'}:${actor?.clubId||''}`;
  const directory=usePlatformOverview(demo,scope);
  const operations=usePlatformOperations(!demo,scope);
  const {overview}=directory;
  const loading=directory.loading||operations.loading;
  const errors=[...directory.errors,...operations.errors];
  const updatedAt=operations.updatedAt||directory.updatedAt;
  const refresh=()=>{directory.refresh();operations.refresh();};
  const [templates,setTemplates]=useState<ManagedTemplate[]>([]);
  useEffect(()=>{if(!demo){setTemplates([]);return;}setTemplates(managedTemplates.state.templates);return managedTemplates.subscribe(()=>setTemplates(managedTemplates.state.templates));},[demo]);
  const demoCounts=emptyJobCounts();
  if(demo)for(const item of state.content)for(const job of item.jobs||[])demoCounts[jobGroup(job.status,job.receipt?.kind==='demo'&&Boolean(job.receipt?.providerPostId))]++;
  const counts=demo?demoCounts:operations.data.jobs?.counts;
  const channels=channelStates.map(item=>({...item,label:item.key==='published'?(demo?'Demo bevestigd':'Met bewijs bevestigd'):item.label,count:counts?.[item.key]}));
  const channelTotal=demo?Object.values(demoCounts).reduce((sum,count)=>sum+count,0):operations.data.jobs?.total;
  const channelIncidents=counts?counts.failed+counts.awaiting_confirmation:undefined;
  const demoVersions=templates.flatMap(template=>{const version=template.versions.find(entry=>entry.number===template.publishedVersion);return version&&Number.isFinite(Date.parse(version.publishedAt))?[{id:template.id,name:template.name,version:version.number,publishedAt:version.publishedAt}]:[];}).sort((left,right)=>Date.parse(right.publishedAt)-Date.parse(left.publishedAt)).slice(0,3);
  const templateSummary:TemplateOperations|null=demo?{total:templates.length,active:templates.filter(template=>template.enabled&&template.publishedVersion).length,drafts:templates.filter(template=>template.draft!=null).length,recent:demoVersions}:operations.data.templates;
  const openCases=demo?overview.cases?.filter(item=>item.status!=='closed'):null;
  const nextDeadline=demo?openCases?.map(item=>Date.parse(item.due_at)).filter(Number.isFinite).sort((a,b)=>a-b)[0]:operations.data.privacy?.nextDeadline?Date.parse(operations.data.privacy.nextDeadline):undefined;
  const openCount=demo?(overview.cases?openCases?.length:undefined):operations.data.privacy?.open;
  const pendingAccounts=demo?overview.accounts?.filter(item=>item.status==='registration_pending').length:operations.data.registrations?.pending;
  const mailIncidents=demo?overview.outbox?.filter(item=>['failed','unconfirmed','blocked','bounced','complained'].includes(item.status)).reduce((total,item)=>total+Number(item.count),0):operations.data.mail?.incidents;
  const attention=[
    {label:'Kanaalopdrachten opvolgen',description:`${counts?.failed||0} mislukt · ${counts?.awaiting_confirmation||0} onbevestigd`,page:'system',count:channelIncidents,icon:CircleAlert,tone:'warn'},
    {label:'Privacyzaken behandelen',description:nextDeadline===undefined?'Openstaande verzoeken':`Eerstvolgende termijn ${shortDate.format(nextDeadline)}`,page:'support',count:openCount,icon:ShieldCheck,tone:nextDeadline!==undefined&&nextDeadline<Date.now()?'warn':'blue'},
    {label:'Registraties afronden',description:'Persoonlijke accounts in afwachting',page:'clubs',count:pendingAccounts,icon:Users,tone:'blue'},
    {label:'Dienstmail opvolgen',description:'Mislukte of onbevestigde berichten',page:'email',count:mailIncidents,icon:Mail,tone:'warn'},
    {label:'Templateconcepten beoordelen',description:'Klaar voor een volgende bewerking',page:'template-studio',count:templateSummary?.drafts,icon:FileClock,tone:'lime'},
  ].filter(item=>(item.count??0)>0);
  const membershipCount=overview.clubs?.reduce((total,club)=>total+club.members,0);
  const metrics=[
    {label:'Verenigingen',value:overview.clubs?.length,detail:membershipCount===undefined?'Nog niet geladen':`${membershipCount} actieve clubrollen`,page:'clubs',icon:Building2,tone:'blue'},
    {label:'Actieve templates',value:templateSummary?.active,detail:templateSummary?`${templateSummary.total} ontwerpen in bibliotheek`:'Nog niet geladen',page:'template-studio',icon:Layers3,tone:'lime'},
    {label:'Kanaalopdrachten',value:channelTotal,detail:channelIncidents===undefined?'Nog niet geladen':channelIncidents?`${channelIncidents} vragen opvolging`:'Geen opvolging nodig',page:'system',icon:Activity,tone:channelIncidents?'warn':'blue'},
    {label:'Open privacyzaken',value:openCount,detail:nextDeadline===undefined?'Verzoeken en termijnen':`Eerstvolgende termijn ${shortDate.format(nextDeadline)}`,page:'support',icon:ShieldCheck,tone:'blue'},
  ];
  const recentVersions=templateSummary?.recent;
  const links = [
    {label: 'Verenigingen', page: 'clubs', icon: Building2},
    {label: 'Template Studio', page: 'template-studio', icon: Layers3},
    {label: 'Kanaalopdrachten', page: 'system', icon: Activity},
    {label: 'Privacyzaken', page: 'support', icon: ShieldCheck},
    {label: 'E-mail', page: 'email', icon: Mail},
    ...(mode === 'demo' ? [{label: 'Abonnementen', page: 'plans', icon: CreditCard}] : []),
  ];

  return <section className="platform-cockpit" aria-labelledby="platform-cockpit-title">
    <header className="pco-head">
      <div>
        <p className="pco-date"><CalendarClock size={14} aria-hidden="true"/>{displayDate.format(new Date())}</p>
        <h1 id="platform-cockpit-title">Platformcockpit</h1>
        <p className="pco-intro">Volg de stand van het platform en open direct wat aandacht vraagt.</p>
      </div>
      <div className="pco-refresh">
        <small aria-live="polite">{loading ? 'Overzicht laden…' : updatedAt ? `${errors.length?'Deels bijgewerkt':'Bijgewerkt'} om ${clock.format(updatedAt)}` : 'Overzicht niet bijgewerkt'}</small>
        <button className="pco-refresh-button" type="button" disabled={loading} onClick={refresh}><RefreshCw size={15} aria-hidden="true"/> Vernieuwen</button>
      </div>
    </header>

    {errors.length > 0 && <p className="pco-load-error" role="status"><CircleAlert size={16} aria-hidden="true"/> Niet ververst: {errors.join(', ')}. Eerder geladen waarden blijven staan; onbekende waarden zijn een streepje.</p>}

    <div className="pco-metrics" aria-label="Platform in cijfers">
      {metrics.map(({label, value, detail, page, icon: Icon, tone}) => <button className="pco-metric" type="button" onClick={() => onNavigate(page)} key={page}>
        <span className="pco-metric-label"><span className="pco-icon" data-tone={tone}><Icon size={16} aria-hidden="true"/></span>{label}</span>
        <strong>{value ?? '–'}</strong>
        <span className="pco-metric-detail">{detail}</span>
      </button>)}
    </div>

    <div className="pco-workspace">
      <section className="pco-panel" aria-labelledby="pco-attention">
        <header className="pco-panel-header"><h2 id="pco-attention">Aandacht nodig</h2><span className="pco-caption">{attention.length} {attention.length === 1 ? 'onderwerp' : 'onderwerpen'}</span></header>
        {attention.length ? <ul className="pco-attention-list">
          {attention.map(({label, description, page, count, icon: Icon, tone}) => <li key={label}>
            <button className="pco-attention-row" type="button" onClick={() => onNavigate(page)}>
              <span className="pco-icon" data-tone={tone}><Icon size={17} aria-hidden="true"/></span>
              <span className="pco-row-label"><strong>{label}</strong><small>{description}</small></span>
              <span className="pco-count" data-tone={tone}>{count}</span><ChevronRight size={15} className="pco-chevron" aria-hidden="true"/>
            </button>
          </li>)}
        </ul> : <p className="pco-empty"><CheckCircle2 size={17} aria-hidden="true"/>{loading ? 'Gegevens ophalen…' : errors.length?'Geen open opvolging in de geladen bronnen. Niet alle bronnen zijn beschikbaar.':'Geen open opvolging in de geladen gegevens.'}</p>}
      </section>

      <section className="pco-panel" aria-labelledby="pco-channel-status">
        <header className="pco-panel-header"><h2 id="pco-channel-status">Kanaalstatus</h2><button type="button" className="pco-link" onClick={() => onNavigate('system')}>Naar opdrachten</button></header>
        {channelTotal ? <div className="pco-channel-summary">
          <div className="pco-distribution" aria-hidden="true">{channels.filter(channel => channel.count).map(channel => <span key={channel.key} style={{flexGrow: channel.count, background: channel.color}}/>)}</div>
          <dl className="pco-channel-list">{channels.map(channel => <div key={channel.key}>
            <dt><span style={{background: channel.color}} aria-hidden="true"/>{channel.label}</dt><dd>{channel.count??'–'}</dd>
          </div>)}</dl>
        </div> : <p className="pco-empty">{channelTotal===undefined?'Kanaalgegevens nog niet beschikbaar.':'Er zijn geen kanaalopdrachten.'}</p>}
      </section>
    </div>

    <div className="pco-workspace pco-secondary">
      <section className="pco-panel" aria-labelledby="pco-versions">
        <header className="pco-panel-header"><h2 id="pco-versions">Laatste templateversies</h2><button type="button" className="pco-link" onClick={() => onNavigate('template-studio')}>Open studio</button></header>
        {recentVersions?.length ? <ul className="pco-versions">{recentVersions.map(version => <li key={version.id}>
          <strong>{version.name}</strong><span>v{version.version}</span><time dateTime={version.publishedAt}>{shortDate.format(new Date(version.publishedAt))}</time>
        </li>)}</ul> : <p className="pco-empty">{templateSummary?'Er zijn nog geen templateversies gepubliceerd.':'Templategegevens nog niet beschikbaar.'}</p>}
      </section>

      <section className="pco-panel" aria-labelledby="pco-quick-links">
        <header className="pco-panel-header"><h2 id="pco-quick-links">Snel naar</h2></header>
        <div className="pco-shortcuts">{links.map(({label, page, icon: Icon}) => <button type="button" onClick={() => onNavigate(page)} key={page}><Icon size={16} aria-hidden="true"/>{label}</button>)}</div>
      </section>
    </div>
  </section>;
}
