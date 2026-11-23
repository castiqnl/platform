import React, {useEffect, useId, useMemo, useRef, useState} from 'react';
import {
  Check, CircleAlert, ExternalLink, Facebook, FlaskConical, Globe2,
  Instagram, Link2, ListChecks, LockKeyhole, Pause, Play, Plug, RefreshCw, Unplug,
} from 'lucide-react';
import {useCastiq, publicationMode} from './store';
import {Modal} from './ui';
import './social-connections.css';
import {api} from './serverClient';

type Provider = 'Instagram' | 'Facebook' | 'X';
type AccountType = 'business' | 'creator' | 'page' | 'profile';
type Login = 'instagram' | 'facebook' | 'x';
type Account = {id: string; label: string; type: AccountType; detail: string};
type Connection = {
  name: string; handle: string; connected: boolean;
  accountType?: AccountType; login?: Login; destinations?: string[]; checkedAt?: string;
};
type Wizard = {provider: Provider; reconnect: boolean};
const pauseKey = 'castiq-publishing-paused';
const channels: Provider[] = ['Instagram', 'Facebook', 'X'];
const destinations: Record<Provider, string[]> = {
  Instagram: ['Instagram-feed', 'Instagram Story'],
  Facebook: ['Facebook-feed', 'Facebook Story'],
  X: ['X-post'],
};
const guides = {
  Instagram: {
    requires: 'Een professioneel Instagram-account van je club, met Bedrijf als voorkeur voor Stories.',
    prepare: [
      'Open de Instagram-app en ga naar het profiel van je club.',
      'Kijk bij Instellingen en activiteit of het account professioneel is. Bij een persoonlijk profiel kun je onder Accounttype en tools overschakelen.',
      'Voor de demo biedt Bedrijf feed en Stories. De Creator-route in deze demo biedt feed.',
    ],
    consent: 'Met Meta’s Unified Login kun je doorgaan via Instagram of Facebook. Controleer of je het professionele clubaccount kunt beheren. Koppel je professionele Instagram-account rechtstreeks.',
    permissions: ['Het professionele account herkennen', 'Namens het gekozen account berichten publiceren'],
    help: 'https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login',
    helpLabel: 'Meta-uitleg voor Instagram',
    scope: 'https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api',
    scopeLabel: 'Meta over Stories en accounttypen',
    missing: 'Controleer of het profiel professioneel is en probeer opnieuw met het account dat de club beheert.',
  },
  Facebook: {
    requires: 'Een Facebook-pagina van je club en een persoonlijk Facebook-account met toegang om namens de pagina te publiceren.',
    prepare: [
      'Open Facebook en wissel naar de pagina van je club.',
      'Controleer onder Instellingen bij Paginatoegang of je toegang hebt om content te publiceren. Vraag anders een beheerder van de pagina.',
      'Houd je persoonlijke Facebook-account klaar. In de volgende stap selecteer je de clubpagina.',
    ],
    consent: 'Bij een echte koppeling log je via Facebook in met je eigen beheerdersaccount. Geef alleen toegang voor de clubpagina die je in Castiq wilt gebruiken.',
    permissions: ['Zichtbare pagina’s voor jouw account ophalen', 'Namens de gekozen clubpagina berichten publiceren'],
    help: 'https://developers.facebook.com/documentation/pages-api/posts',
    helpLabel: 'Meta-uitleg voor Facebook-pagina’s',
    missing: 'Controleer je paginatoegang en of je de juiste clubpagina in het Facebook-toestemmingsscherm hebt geselecteerd.',
  },
  X: {
    requires: 'Toegang tot het X-account van je club en eventuele tweestapsverificatie bij de hand.',
    prepare: [
      'Open X en controleer in je profiel of je het clubaccount gebruikt.',
      'Zo nodig wissel je naar het juiste @account voordat je Castiq toestemming geeft.',
      'Via het officiële X-scherm controleer je straks welk account wordt gekoppeld.',
    ],
    consent: 'Bij een echte koppeling opent X zijn eigen aanmeld- en toestemmingsscherm. Controleer de @naam voordat je publicatietoegang toestaat.',
    permissions: ['Je X-profiel herkennen', 'Namens het gekozen account berichten plaatsen'],
    help: 'https://help.x.com/en/managing-your-account/connect-or-revoke-access-to-third-party-apps',
    helpLabel: 'X-uitleg over gekoppelde apps',
    missing: 'Wissel op X naar het clubaccount en controleer of je mag aanmelden en toestemming geven.',
  },
} satisfies Record<Provider, {
  requires: string; prepare: string[]; consent: string; permissions: string[];
  help: string; helpLabel: string; scope?: string; scopeLabel?: string; missing: string;
}>;

function ProviderMark({provider, small = false}: {provider: Provider; small?: boolean}) {
  const icon = provider === 'Instagram' ? <Instagram size={small ? 18 : 21}/> :
    provider === 'Facebook' ? <Facebook size={small ? 18 : 21}/> : <span>𝕏</span>;
  return <span className={`social-mark social-mark--${provider.toLowerCase()}`} aria-hidden="true">{icon}</span>;
}

const timeFormat = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam',
});

function accountsFor(provider: Provider, clubName: string, current?: Connection): Account[] {
  const slug = clubName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '') || 'voorbeeldclub';
  const byProvider: Record<Provider, Account[]> = {
    Facebook: [
      {id: 'club', label: clubName, type: 'page', detail: 'Clubpagina · publicatierechten'},
      {id: 'youth', label: `${clubName} Jeugd`, type: 'page', detail: 'Jeugdpagina · publicatierechten'},
    ],
    Instagram: [
      {id: 'club', label: `@${slug.slice(0, 30)}`, type: 'business', detail: 'Bedrijf · feed en Stories'},
      {id: 'creator', label: `@${slug.slice(0, 24)}_media`, type: 'creator', detail: 'Creator · feed'},
    ],
    X: [
      {id: 'club', label: `@${slug.slice(0, 15)}`, type: 'profile', detail: 'Officieel clubaccount'},
      {id: 'matches', label: `@${slug.slice(0, 10)}_live`, type: 'profile', detail: 'Wedstrijdupdates'},
    ],
  };
  const accounts = byProvider[provider];
  if (current?.handle && !accounts.some(account => account.label === current.handle)) {
    const type = current.accountType || accounts[0].type;
    accounts.unshift({id: 'previous', label: current.handle, type, detail: 'Eerder geselecteerd'});
  }
  return accounts;
}

function accountDestinations(provider: Provider, account: Account) {
  return provider === 'Instagram' && account.type === 'creator' ? destinations.Instagram.slice(0, 1) : destinations[provider];
}

function ConnectionWizard({wizard, clubName, current, onClose, onConnect}: {
  wizard: Wizard; clubName: string; current?: Connection; onClose: () => void;
  onConnect: (provider: Provider, account: Account, login: Login) => void;
}) {
  const {provider, reconnect} = wizard;
  const guide = guides[provider];
  const steps = ['Voorbereiden', 'Toestemming', provider === 'Facebook' ? 'Pagina kiezen' : 'Account kiezen', 'Controleren'];
  const accounts = useMemo(() => accountsFor(provider, clubName, current), [provider, clubName, current]);
  const [step, setStep] = useState(0);
  const [login, setLogin] = useState<Login>(current?.login || (provider === 'Instagram' ? 'instagram' : provider === 'Facebook' ? 'facebook' : 'x'));
  const [selection, setSelection] = useState(() => reconnect ? accounts.find(item => item.label === current?.handle)?.id || '' : '');
  const [failure, setFailure] = useState(false);
  const choice = accounts.find(item => item.id === selection);
  const groupId = useId();
  const action = provider === 'Facebook' ? 'pagina' : 'account';
  const subtitle = [
    'Zorg dat je de juiste toegang hebt.',
    'Controleer welke toegang Castiq straks vraagt.',
    `Controleer welke ${action} hoort bij je vereniging.`,
    'Bekijk wat je aan deze vereniging koppelt.',
  ][step];

  return <Modal title={`${provider} ${reconnect ? 'opnieuw koppelen' : 'koppelen'}`} onClose={onClose}>
    <div className="social-wizard">
      <div className="social-wizard-provider"><ProviderMark provider={provider}/><div><strong>{clubName}</strong><span>Verbinding met {provider}</span></div><span className="social-demo-label">Demo</span></div>
      <ol className="social-steps" aria-label="Stappen">
        {steps.map((title, index) => <li key={title} aria-current={step === index ? 'step' : undefined} data-status={step === index ? 'current' : step > index ? 'done' : 'next'}>
          <span>{step > index ? <Check size={14}/> : index + 1}</span><small>{title}</small>
        </li>)}
      </ol>
      <section className="social-wizard-content" aria-labelledby={`${groupId}-step`}>
        <h3 id={`${groupId}-step`} aria-live="polite">{steps[step]}</h3>
        <p>{subtitle}</p>
        {step === 0 && <ol className="social-checklist">{guide.prepare.map(text => <li key={text}>{text}</li>)}</ol>}
        {step === 1 && <>
          <p>{guide.consent}</p>
          {provider === 'Instagram' && <fieldset className="social-options social-login">
            <legend>Doorgaan via</legend>
            <label><input type="radio" name={`${groupId}-login`} checked={login === 'instagram'} onChange={() => setLogin('instagram')}/> Instagram</label>
            <label><input type="radio" name={`${groupId}-login`} checked={login === 'facebook'} onChange={() => setLogin('facebook')}/> Facebook</label>
          </fieldset>}
          <ul className="social-permissions" aria-label="Gevraagde toegang">{guide.permissions.map(text => <li key={text}><Check size={15} aria-hidden="true"/>{text}</li>)}</ul>
          {failure && <p className="social-error" role="alert"><CircleAlert size={16}/> Toestemming geweigerd in de demo. Je kunt opnieuw proberen of de wizard sluiten.</p>}
        </>}
        {step === 2 && <>
          <fieldset className="social-options social-accounts">
            <legend>{provider === 'Facebook' ? 'Beschikbare demopagina’s' : 'Beschikbare demoaccounts'}</legend>
            {accounts.map(account => <label key={account.id} className="social-account-option">
              <input type="radio" name={`${groupId}-account`} value={account.id} checked={selection === account.id} onChange={() => setSelection(account.id)}/>
              <span><strong>{account.label}</strong><small>{account.detail}</small></span>
            </label>)}
          </fieldset>
          <details className="social-help"><summary>Ik zie mijn {action} niet</summary><p>{guide.missing}</p></details>
        </>}
        {step === 3 && choice && <>
          <dl className="social-summary">
            <div><dt>Vereniging</dt><dd>{clubName}</dd></div>
            <div><dt>{provider === 'Facebook' ? 'Pagina' : 'Account'}</dt><dd>{choice.label}</dd></div>
            <div><dt>Bestemmingen</dt><dd>{accountDestinations(provider, choice).join(' · ')}</dd></div>
          </dl>
          <p className="social-safe-note"><FlaskConical size={16} aria-hidden="true"/> Deze stap voert een gesimuleerde verbindingscontrole uit.</p>
        </>}
        <div className="social-docs">
          <a href={guide.help} target="_blank" rel="noreferrer">{guide.helpLabel} <ExternalLink size={13} aria-hidden="true"/></a>
          {provider === 'Instagram' && step === 0 && <a href={guides.Instagram.scope} target="_blank" rel="noreferrer">{guides.Instagram.scopeLabel} <ExternalLink size={13} aria-hidden="true"/></a>}
        </div>
      </section>
      <div className="social-wizard-footer">
        <button type="button" className="btn btn-secondary" onClick={() => {
          if (step === 0) onClose();
          else {setFailure(false); setStep(step - 1);}
        }}>{step ? 'Terug' : 'Annuleren'}</button>
        <div>
          {step === 1 && <button type="button" className="social-reject" onClick={() => setFailure(true)}>Toegang weigeren</button>}
          {step === 3 ? <button type="button" className="btn btn-primary" disabled={!choice} onClick={() => {
            if (choice) onConnect(provider, choice, login);
          }}><Check size={17}/> Test en koppel</button> :
            <button type="button" className="btn btn-primary" disabled={step === 2 && !choice} onClick={() => {setFailure(false); setStep(step + 1);}}>
              {step === 1 ? 'Demo-toestemming geven' : 'Verder'}
            </button>}
        </div>
      </div>
      <p className="social-demo-explanation"><LockKeyhole size={14} aria-hidden="true"/> Alle handelingen in deze demo zijn lokaal en gebruiken fictieve accounts.</p>
    </div>
  </Modal>;
}

export function isSocialDestinationAvailable(connections: Connection[], channel: string) {
  const provider = channels.find(name => destinations[name].includes(channel));
  if (!provider) return false;
  const connection = connections.find(item => item.name === provider);
  return Boolean(connection?.connected && (!connection.destinations || connection.destinations.includes(channel)));
}

function DemoSocialConnections({onNavigate}: {onNavigate?: (page: string) => void}) {
  const {state, mode, setState, log, toast} = useCastiq();
  const [wizard, setWizard] = useState<Wizard | null>(null);
  const [disconnect, setDisconnect] = useState<Provider | null>(null);
  const [paused, setPaused] = useState(() => {
    try {return localStorage.getItem(pauseKey) === 'true';}
    catch {return false;}
  });
  const connections: Connection[] = state.connections;
  const getConnection = (provider: Provider) => connections.find(item => item.name === provider);
  const linkedCount = channels.filter(provider => getConnection(provider)?.connected).length;
  const editable = mode === 'demo';

  function change(provider: Provider, values: Partial<Connection>) {
    setState(current => {
      const existing = current.connections.find(item => item.name === provider);
      const next = {...(existing || {name: provider, connected: false, handle: ''}), ...values};
      return {...current, connections: existing ?
        current.connections.map(item => item.name === provider ? next : item) : [...current.connections, next]};
    });
  }

  function connect(provider: Provider, account: Account, login: Login) {
    change(provider, {
      connected: true, handle: account.label, accountType: account.type, login,
      destinations: accountDestinations(provider, account), checkedAt: new Date().toISOString(),
    });
    log('Demo-koppeling bewaard', `${provider} · ${account.label}`);
    setWizard(null);
    toast(`${provider} is gekoppeld in de demo. De verbindingscontrole is geslaagd.`);
  }

  function test(provider: Provider) {
    change(provider, {checkedAt: new Date().toISOString()});
    toast(`${provider} reageert op de gesimuleerde verbindingscontrole.`);
  }

  function togglePause() {
    const nextPaused = !paused;
    try {localStorage.setItem(pauseKey, JSON.stringify(nextPaused));}
    catch {toast('De instelling kon niet worden bewaard.'); return;}
    setPaused(nextPaused);
    setState(current => ({
      ...current,
      content: current.content.map(item => {
        const jobs = item.jobs.map(job => {
          if (nextPaused && job.status === 'scheduled') return {...job, status: 'paused'};
          if (nextPaused || job.status !== 'paused') return job;
          const rule = publicationMode(current, item.team, item.type, job.channel);
          const status = rule === 'off' || rule === 'draft' ? 'draft' :
            rule === 'review' && item.approvedVersion !== item.version ? 'review' :
            isSocialDestinationAvailable(current.connections, job.channel) ? 'scheduled' : 'failed';
          return {...job, status};
        });
        const status = jobs.some(job => job.status === 'review') ? 'review' :
          jobs.some(job => job.status === 'scheduled') ? 'scheduled' : item.status;
        return {...item, jobs, status};
      }),
    }));
    window.dispatchEvent(new Event('castiq-settings'));
    log(nextPaused ? 'Publicatie clubbreed gepauzeerd' : 'Publicatie hervat', 'Geplande demobestemmingen bijgewerkt.');
    toast(nextPaused ? 'Geplande demoverzendingen zijn gepauzeerd.' : 'Geplande demoverzendingen zijn opnieuw gecontroleerd.');
  }

  return <section className="social-connections">
    <header className="social-page-head"><div><h1>Socialmedia-koppelingen</h1><p>Koppel de officiële clubaccounts en beheer waar berichten terechtkomen.</p></div>
      <span className="social-demo-label"><FlaskConical size={14} aria-hidden="true"/> Demokoppelingen</span>
    </header>
    <section className="social-directory" aria-labelledby="social-accounts-heading">
      <header><div><Link2 size={18} aria-hidden="true"/><h2 id="social-accounts-heading">Sociale kanalen</h2></div><span>{linkedCount} van {channels.length} gekoppeld</span></header>
      <ul>{channels.map(provider => {
        const connection = getConnection(provider);
        return <li className="social-channel" key={provider}>
          <div className="social-channel-provider"><ProviderMark provider={provider} small/><div>
            <strong>{provider}</strong><span>{connection?.connected ? connection.handle : guides[provider].requires}</span>
          </div></div>
          <div className="social-channel-options" aria-label={`Bestemmingen ${provider}`}>
            {(connection?.connected ? connection.destinations || destinations[provider] : destinations[provider]).map(channel => <span key={channel}>{channel.endsWith('Story') ? 'Story' : channel.endsWith('feed') ? 'Feed' : 'Post'}</span>)}
          </div>
          <div className="social-channel-state"><span data-linked={Boolean(connection?.connected)}>{connection?.connected ? 'Demo gekoppeld' : 'Niet gekoppeld'}</span>
            {connection?.connected && connection.checkedAt && <small>Getest {timeFormat.format(new Date(connection.checkedAt))}</small>}
          </div>
          {editable && <div className="social-channel-actions">
            {connection?.connected ? <>
              <button type="button" className="social-icon-button" aria-label={`Test ${provider}-koppeling`} title="Koppeling testen" onClick={() => test(provider)}><FlaskConical size={17}/></button>
              <button type="button" className="social-icon-button" aria-label={`${provider} opnieuw koppelen`} title="Opnieuw koppelen" onClick={() => setWizard({provider, reconnect: true})}><RefreshCw size={17}/></button>
              <button type="button" className="social-icon-button social-unplug" aria-label={`${provider} ontkoppelen`} title="Ontkoppelen" onClick={() => setDisconnect(provider)}><Unplug size={17}/></button>
            </> : <button type="button" className="btn btn-primary" aria-label={`${provider} koppelen`} onClick={() => setWizard({provider, reconnect: false})}><Plug size={15}/> Koppelen</button>}
          </div>}
        </li>;
      })}</ul>
    </section>
    <div className="social-shortcuts">
      {editable && <section><span className="social-shortcut-icon"><Pause size={19}/></span><div><h2>Clubbrede publicatie</h2><p>{paused ? 'Geplande demoverzendingen zijn gepauzeerd.' : 'Pauzeer geplande demoverzendingen voor alle kanalen tegelijk.'}</p></div>
        <button type="button" className="btn btn-secondary" onClick={togglePause}>{paused ? <Play size={15}/> : <Pause size={15}/>} {paused ? 'Hervatten' : 'Pauzeren'}</button>
      </section>}
      <section><span className="social-shortcut-icon"><Globe2 size={19}/></span><div><h2>Sportlink</h2><p>Programma, uitslagen en afgelastingen.</p></div>
        <button type="button" className="btn btn-secondary" onClick={() => onNavigate ? onNavigate('sources') : location.hash = '/club/sources'}>Wedstrijdbronnen</button>
      </section>
    </div>
    <p className="social-demo-explanation"><ListChecks size={16} aria-hidden="true"/> Verbindingscontroles en publicaties blijven binnen het prototype.</p>
    {wizard && <ConnectionWizard wizard={wizard} clubName={state.club.name} current={getConnection(wizard.provider)} onClose={() => setWizard(null)} onConnect={connect}/>}
    {disconnect && <Modal title={`${disconnect} ontkoppelen`} onClose={() => setDisconnect(null)}><div className="social-disconnect">
      <p>Ontkoppel <strong>{getConnection(disconnect)?.handle}</strong> van {state.club.name}. De demo bewaart de historie van bestaande kanaalopdrachten.</p>
      <div className="social-wizard-footer"><button type="button" className="btn btn-secondary" onClick={() => setDisconnect(null)}>Annuleren</button>
        <button type="button" className="btn btn-primary" onClick={() => {
          change(disconnect, {connected: false, destinations: undefined, checkedAt: undefined});
          log('Demo-koppeling verbroken', disconnect);
          toast(`${disconnect} is ontkoppeld in de demo.`);
          setDisconnect(null);
        }}><Unplug size={16}/> Ontkoppelen</button>
      </div>
    </div></Modal>}
  </section>;
}


type ServerChannel={provider:'instagram'|'facebook'|'x';name:Provider;configured:boolean;version:number;status:string;accountName:string;accountType?:string;destinations:string[];checkedAt:string|null;expiresAt:string|null;login:string};
type ServerChannelList={publicationMode:string;providers:ServerChannel[]};
type OAuthFlow={flowId:string;provider:string;status:string;errorCode?:string;candidates:{id:string;name:string;type:string;destinations:string[]}[]};
const channelStatus:Record<string,string>={connected:'Geverifieerde koppeling',disconnected:'Niet gekoppeld',expired:'Toegang verlopen',revoked:'Toegang ingetrokken',verification_failed:'Controle mislukt',revocation_pending:'Intrekking nog niet bevestigd'};
export function SocialConnections(props:{onNavigate?:(page:string)=>void}){const {mode}=useCastiq();return mode==='demo'?<DemoSocialConnections {...props}/>:<ServerSocialConnections {...props}/>;}
function ServerSocialConnections({onNavigate}:{onNavigate?:(page:string)=>void}){
 const {actor,state,reload,command,toast}=useCastiq();const [data,setData]=useState<ServerChannelList|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[wizard,setWizard]=useState<ServerChannel|null>(null),[flow,setFlow]=useState<OAuthFlow|null>(null),[selection,setSelection]=useState(''),[disconnect,setDisconnect]=useState<ServerChannel|null>(null);const generation=useRef(0);
 const storageKey=`castiq-channel-flow:${actor?.id}:${actor?.clubId}`;
 const paused=(state.v1 as typeof state.v1 & {publicationPaused?:boolean}).publicationPaused===true;
 async function refresh(){const epoch=generation.current;const result=await api<ServerChannelList>('/api/channels');if(epoch===generation.current)setData(result);}
 useEffect(()=>{const epoch=++generation.current;let alive=true;setData(null);setError('');setFlow(null);setWizard(null);setSelection('');setBusy(false);if(actor?.role!=='club')return;void api<ServerChannelList>('/api/channels').then(v=>{if(alive&&epoch===generation.current)setData(v);}).catch(e=>{if(alive&&epoch===generation.current)setError(e.message);});const id=sessionStorage.getItem(storageKey);if(id)void api<OAuthFlow>('/api/channels/flows/'+id).then(v=>{if(alive&&epoch===generation.current)setFlow(v);}).catch(()=>{if(alive)sessionStorage.removeItem(storageKey);});return()=>{alive=false;generation.current++;};},[actor?.id,actor?.clubId]);
 useEffect(()=>{if(!flow||!['pending','processing'].includes(flow.status))return;const epoch=generation.current;let alive=true;const timer=window.setInterval(()=>{void api<OAuthFlow>('/api/channels/flows/'+flow.flowId).then(v=>{if(alive&&epoch===generation.current)setFlow(v);}).catch(e=>{if(alive&&epoch===generation.current)setError(e.message);});},2500);return()=>{alive=false;window.clearInterval(timer);};},[flow?.flowId,flow?.status]);
 async function run(action:()=>Promise<void>){const epoch=generation.current;setBusy(true);setError('');try{await action();}catch(e){if(epoch===generation.current)setError((e as Error).message);}finally{if(epoch===generation.current)setBusy(false);}}
 async function start(channel:ServerChannel){const epoch=generation.current,popup=window.open('about:blank','_blank');if(popup)popup.opener=null;try{const result=await api<{flowId:string;authorizationUrl:string}>(`/api/channels/${channel.provider}/start`,{method:'POST',body:JSON.stringify({expectedVersion:channel.version})});if(epoch!==generation.current){popup?.close();return;}sessionStorage.setItem(storageKey,result.flowId);setFlow({flowId:result.flowId,provider:channel.provider,status:'pending',candidates:[]});setWizard(null);if(popup)popup.location.href=result.authorizationUrl;else location.assign(result.authorizationUrl);}catch(e){popup?.close();throw e;}}
 async function choose(){if(!flow||!selection)return;const epoch=generation.current;await api(`/api/channels/${flow.provider}/select`,{method:'POST',body:JSON.stringify({flowId:flow.flowId,accountId:selection})});if(epoch!==generation.current)return;sessionStorage.removeItem(storageKey);setFlow(null);setSelection('');await refresh();await reload();toast('Providerkoppeling geverifieerd. Er is geen bericht gepubliceerd.');}
 if(actor?.role!=='club')return <div role="alert" className="local-access-error">Alleen de bevoegde clubbeheerder kan eigen kanalen beheren.</div>;
 return <div className="social-connections"><header className="page-title"><div><h1>Koppelingen</h1><p>Verbind de eigen clubaccounts via de officiële provider.</p></div><button className="btn btn-secondary" disabled={busy} onClick={()=>void run(refresh)}><RefreshCw size={15}/> Verversen</button></header><p className="social-server-note">Een geverifieerde koppeling is geen publicatie. Kanaalopdrachten blijven uitsluitend in de expliciete sandbox.</p>{error&&<p role="alert" className="local-access-error">{error}</p>}{!data&&!error&&<p role="status">Kanaalkoppelingen laden…</p>}<div className="social-grid">{data?.providers.map(channel=><section key={channel.provider} className="social-card"><div className="social-card-heading"><ProviderMark provider={channel.name}/><h2>{channel.name}</h2></div><strong>{channel.accountName||'Nog geen clubaccount geselecteerd'}</strong><p role="status">{channelStatus[channel.status]||channel.status}</p>{channel.checkedAt&&<small>Gecontroleerd {timeFormat.format(new Date(channel.checkedAt))}</small>}{channel.expiresAt&&<p>Toegang geldig tot {timeFormat.format(new Date(channel.expiresAt))}</p>}<p>{channel.destinations.join(' · ')||'Geen beschikbare bestemmingen'}</p>{!channel.configured&&<p className="social-server-note">Nog niet geconfigureerd: provider-app, servercredentials en goedgekeurde rechten ontbreken. Er wordt geen demo-toestemming als echte koppeling gebruikt.</p>}<div className="social-card-actions"><button className="btn btn-primary" disabled={busy||!channel.configured||channel.status==='revocation_pending'} onClick={()=>setWizard(channel)}>{channel.status==='connected'?'Opnieuw koppelen':'Koppelen'}</button>{channel.version>0&&<><button className="btn btn-secondary" disabled={busy||!channel.configured||['disconnected','revocation_pending'].includes(channel.status)} onClick={()=>void run(async()=>{await api(`/api/channels/${channel.provider}/test`,{method:'POST',body:JSON.stringify({expectedVersion:channel.version})});await refresh();await reload();toast('Statuscontrole afgerond. Er is geen bericht gepubliceerd.');})}><FlaskConical size={15}/> Koppeling testen</button><button className="btn btn-secondary" disabled={busy||channel.status==='disconnected'} onClick={()=>setDisconnect(channel)}>{channel.status==='revocation_pending'?'Intrekking opnieuw controleren':'Ontkoppelen'}</button></>}</div></section>)}</div><section className="social-server-note"><strong>Clubbrede publicatie</strong><p>{paused?'Alle nieuwe sandboxopdrachten en de worker zijn gepauzeerd.':'Pauzeer nieuwe opdrachten en de worker voor alle kanalen.'}</p><button className="btn btn-secondary" disabled={busy} onClick={()=>void run(async()=>{await command('publication.pause',{paused:!paused});})}>{paused?'Hervatten':'Pauzeren'}</button> <button className="btn btn-secondary" onClick={()=>onNavigate?.('sources')}>Wedstrijdbronnen</button></section>{wizard&&<Modal title={`${wizard.name} koppelen`} onClose={()=>setWizard(null)}><div className="social-wizard"><p>{guides[wizard.name].requires}</p><ol className="social-checklist">{guides[wizard.name].prepare.map(text=><li key={text}>{text.replace('Voor de demo biedt Bedrijf feed en Stories. De Creator-route in deze demo biedt feed.','Beschikbare bestemmingen worden uit het geverifieerde account afgeleid.')}</li>)}</ol><p>Je gaat naar het officiële toestemmingsscherm. Castiq vraagt hier nooit om je providerwachtwoord. Na terugkeer kies en bevestig je het account voor {state.club.name}.</p><p>{wizard.provider==='instagram'?'Deze aansluiting gebruikt Instagram Login voor professionele accounts. Unified Login is een afzonderlijke Meta-configuratie.':wizard.login}</p><a href={wizard.provider==='instagram'?'https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login':guides[wizard.name].help} target="_blank" rel="noreferrer">Officiële providerinformatie</a><div className="modal-actions"><button className="btn btn-secondary" onClick={()=>setWizard(null)}>Annuleren</button><button className="btn btn-primary" disabled={busy} onClick={()=>void run(()=>start(wizard))}>Naar {wizard.name}</button></div></div></Modal>}{flow&&<section className="social-server-note" aria-live="polite"><h2>Koppelsessie</h2>{['pending','processing'].includes(flow.status)?<p>Wacht op de officiële provider. Geef toestemming of weiger in het geopende venster. Daarna wordt de status hier opgehaald.</p>:flow.status==='select'?<><p>Kies het account dat bij {state.club.name} hoort. De oude koppeling blijft behouden tot je bevestigt.</p>{flow.candidates.map(c=><label className="social-server-choice" key={c.id}><input type="radio" name="provider-account" value={c.id} checked={selection===c.id} onChange={()=>setSelection(c.id)}/><span>{c.name} · {c.type}<small>{c.destinations.join(' · ')}</small></span></label>)}<button className="btn btn-primary" disabled={busy||!selection} onClick={()=>void run(choose)}>Account voor deze vereniging bevestigen</button></>:<p>{flow.status==='connected'?'Deze koppelsessie is afgerond.':flow.status==='denied'?'Je hebt de toestemming geweigerd. De bestaande koppeling is behouden.':'De koppelsessie is verlopen of niet bevestigd. Begin opnieuw via Koppelen.'}</p>}<button className="btn btn-secondary" onClick={()=>{sessionStorage.removeItem(storageKey);setFlow(null);}}>Koppelsessie sluiten</button></section>}{disconnect&&<Modal title="Kanaal ontkoppelen" onClose={()=>setDisconnect(null)}><p>De providerbestemming verdwijnt direct voor nieuwe opdrachten. Niet-verzonden opdrachten worden geannuleerd; eerdere resultaten en onzekere lopende opdrachten blijven bewaard. Een mislukte intrekking blijft zichtbaar om opnieuw te controleren.</p><div className="modal-actions"><button className="btn btn-secondary" onClick={()=>setDisconnect(null)}>Annuleren</button><button className="btn btn-primary" disabled={busy} onClick={()=>void run(async()=>{await api(`/api/channels/${disconnect.provider}`,{method:'DELETE',body:JSON.stringify({expectedVersion:disconnect.version})});setDisconnect(null);await refresh();await reload();})}>Ontkoppelen bevestigen</button></div></Modal>}</div>;
}
