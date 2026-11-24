import React, {useEffect, useId, useMemo, useRef, useState} from 'react';
import {
  Check, CircleAlert, ExternalLink, Facebook, FlaskConical, Globe2,
  Instagram, Link2, ListChecks, LockKeyhole, ShieldCheck, Pause, Play, Plug, RefreshCw, Unplug,
} from 'lucide-react';
import {useCastiq, publicationMode} from './store';
import {Modal} from './ui';
import './social-connections.css';
import {api, ServerError} from './serverClient';

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


type ServerChannel = {
  provider: 'instagram' | 'facebook' | 'x'; name: Provider; configured: boolean;
  integration?: string; avatarUrl?: string | null; authorizationReady?: boolean; publicationReady?: boolean; configurationMessage?: string;
  version: number; status: string; accountName: string; accountType?: string;
  destinations: string[]; checkedAt: string | null; expiresAt: string | null; login: string;
};
type ServerChannelList = {publicationMode: string; providers: ServerChannel[]};
type OAuthCandidate = {id: string; name: string; type: string; destinations: string[]; avatarUrl?: string | null; selectable?: boolean; blockedReason?: string};
type OAuthFlow = {flowId: string; provider: string; status: string; errorCode?: string; notice?: string; candidates: OAuthCandidate[]};
const channelStatus: Record<string, string> = {
  connected: 'Gekoppeld', disconnected: 'Niet gekoppeld', expired: 'Toegang verlopen',
  revoked: 'Toegang ingetrokken', verification_failed: 'Controle nodig', revocation_pending: 'Ontkoppelen wordt afgerond',
};
const serverGuides = {
  Instagram: {
    requires: 'Een professioneel Instagram-account van je club (Bedrijf of Creator).',
    prepare: ['Open Instagram en controleer of je het clubaccount gebruikt.',
      'Controleer bij Instellingen en activiteit of het account professioneel is (Bedrijf of Creator).',
      'Zorg dat je kunt inloggen en houd eventuele tweestapsverificatie bij de hand.'],
    consent: 'Je geeft toestemming bij Instagram zelf. Controleer daar de accountnaam en geef Castiq toegang tot het professionele clubaccount. Een Facebook-pagina is voor deze aansluiting niet nodig.',
    permissions: ['Het professionele clubaccount herkennen', 'Namens het gekozen account berichten publiceren'],
    help: 'https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api',
    helpLabel: 'Uitleg van Meta over Instagram',
    missing: 'Controleer of het account professioneel is en of je met het juiste clubaccount toestemming hebt gegeven.',
  },
  Facebook: {
    requires: 'Een Facebook-pagina van je club en toegang om daarop berichten te plaatsen.',
    prepare: ['Open Facebook en ga naar de pagina van je club.',
      'Controleer bij Paginatoegang of je namens de pagina content mag publiceren.',
      'Houd je eigen Facebook-aanmelding bij de hand. Straks kies je welke clubpagina je koppelt.'],
    consent: 'Je logt in bij Facebook met het account waarmee je de clubpagina beheert. Geef alleen toegang tot de pagina die je in Castiq wilt gebruiken.',
    permissions: ['De pagina’s bekijken die je mag beheren', 'Namens de gekozen clubpagina berichten publiceren'],
    help: 'https://developers.facebook.com/docs/graph-api/reference/page/feed/',
    helpLabel: 'Uitleg van Meta over Facebook-pagina’s',
    missing: 'Controleer je paginatoegang en of je de clubpagina hebt aangevinkt bij Facebook. Alleen pagina’s waarop je mag publiceren verschijnen hier.',
  },
  X: {
    requires: 'Toegang tot het X-account van je club.',
    prepare: ['Open X en controleer de @naam van je clubaccount.',
      'Wissel naar het clubaccount als je nu met je eigen profiel bent aangemeld.',
      'Houd je aanmelding en eventuele tweestapsverificatie bij de hand.'],
    consent: 'X opent zijn eigen aanmeld- en toestemmingsscherm. Controleer de @naam voordat je Castiq toegang geeft.',
    permissions: ['Het X-profiel van je club herkennen', 'Namens het gekozen account berichten publiceren'],
    help: 'https://help.x.com/en/managing-your-account/connect-or-revoke-access-to-third-party-apps',
    helpLabel: 'Uitleg van X over gekoppelde apps',
    missing: 'Controleer of je op X met het juiste clubaccount bent aangemeld. Start de toestemming opnieuw als je een ander account wilt kiezen.',
  },
};
const accountTypeLabel: Record<string, string> = {business: 'Bedrijf', creator: 'Creator', professional: 'Professioneel account', page: 'Facebook-pagina', profile: 'X-account'};
function flowMessage(flow: OAuthFlow) {
  if (flow.status === 'denied') return 'Je hebt geen toestemming gegeven. Je bestaande koppeling is behouden. Je kunt het opnieuw proberen.';
  if (flow.status === 'expired') return 'De tijd om te koppelen is verstreken. Start de toestemming opnieuw; je bestaande koppeling is behouden.';
  if (flow.errorCode === 'callback_mismatch') return 'De terugkeer past niet bij het stagingproject of het gekozen kanaal. Start de koppeling opnieuw. Laat platformbeheer de Post for Me-projectinstellingen controleren als dit opnieuw gebeurt. Je bestaande koppeling is behouden.';
  if (flow.errorCode === 'no_owned_accounts') return 'Er is geen account gevonden dat betrouwbaar bij deze vereniging hoort. Start opnieuw en kies alleen de bedoelde clubpagina of het professionele clubaccount. Je bestaande koppeling is behouden.';
  if (flow.errorCode === 'no_eligible_accounts') return 'Er is geen geschikt clubaccount gevonden. Controleer je account en toegangsrechten en probeer opnieuw.';
  if (flow.errorCode === 'missing_permissions') return 'Niet alle benodigde rechten zijn gegeven. Probeer opnieuw en controleer de gevraagde toegang.';
  if (flow.errorCode === 'unsupported_account_type') return 'Dit account wordt niet ondersteund. Gebruik een professioneel clubaccount.';
  return 'De koppeling kon niet worden bevestigd. Controleer je toegang en probeer opnieuw. Je bestaande koppeling is behouden.';
}
function storedFlow(key: string) {try {return sessionStorage.getItem(key);} catch {return null;}}
function rememberFlow(key: string, value: string | null) {try {if (value) sessionStorage.setItem(key, value); else sessionStorage.removeItem(key);} catch {/* The open wizard still works when browser storage is unavailable. */}}

export function SocialConnections(props: {onNavigate?: (page: string) => void}) {
  const {mode} = useCastiq();
  return mode === 'demo' ? <DemoSocialConnections {...props}/> : <ServerSocialConnections {...props}/>;
}
function ServerSocialConnections({onNavigate}: {onNavigate?: (page: string) => void}) {
  const {actor, state, reload, command, toast} = useCastiq();
  const [data, setData] = useState<ServerChannelList | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [wizard, setWizard] = useState<ServerChannel | null>(null);
  const [step, setStep] = useState(0);
  const [flow, setFlow] = useState<OAuthFlow | null>(null);
  const [selection, setSelection] = useState('');
  const [disconnect, setDisconnect] = useState<ServerChannel | null>(null);
  const finishing = useRef(new Map<string, Promise<OAuthFlow>>());
  const generation = useRef(0);
  const groupId = useId();
  const storageKey = `castiq-channel-flow:${actor?.id}:${actor?.clubId}`;
  const paused = (state.v1 as typeof state.v1 & {publicationPaused?: boolean}).publicationPaused === true;
  const currentChannel = data?.providers.find(channel => channel.provider === wizard?.provider) || wizard;
  const activeFlow = flow?.provider === wizard?.provider ? flow : null;
  const candidates = activeFlow?.candidates || [];
  const choice = candidates.find(candidate => candidate.id === selection && candidate.selectable !== false);
  const waiting = activeFlow && ['pending', 'processing', 'returned'].includes(activeFlow.status);
  const failed = activeFlow && ['denied', 'expired', 'failed', 'cancelled'].includes(activeFlow.status);
  const dismissState = useRef({busy, activeFlow});
  dismissState.current = {busy, activeFlow};
  const linkedCount = data?.providers.filter(channel => channel.status === 'connected').length || 0;

  useEffect(()=>{const changed=()=>{void refresh().catch(failure=>setError(failure.message));};window.addEventListener('castiq:integrations-changed',changed);return()=>window.removeEventListener('castiq:integrations-changed',changed);},[actor?.id,actor?.clubId]);
  async function refresh() {
    const epoch = generation.current;
    const result = await api<ServerChannelList>('/api/channels');
    if (epoch === generation.current) setData(result);
  }
  useEffect(() => {
    const epoch = ++generation.current;
    let alive = true;
    setData(null); setError(''); setFlow(null); setWizard(null); setSelection(''); setBusy(false); setDisconnect(null);
    if (actor?.role !== 'club') return;
    void (async () => {
      try {
        const result = await api<ServerChannelList>('/api/channels');
        if (!alive || epoch !== generation.current) return;
        setData(result);
        const id = storedFlow(storageKey);
        const returning = new URLSearchParams(location.hash.split('?')[1] || '').get('postForMeReturn') === '1';
        if (!id && !returning) return;
        try {
          let restored = await api<OAuthFlow>(id ? '/api/channels/flows/' + encodeURIComponent(id) : '/api/channels/post-for-me/current');
          if (!alive || epoch !== generation.current) return;
          if (!restored.flowId) throw new Error('Er is geen geldige koppelpoging voor deze vereniging. Start de koppeling opnieuw vanuit de juiste clubomgeving.');
          if (restored.status === 'returned') restored = await finishFlow(restored.flowId);
          if (returning) history.replaceState(null, '', location.pathname + location.search + '#/club/channels');
          if (!alive || epoch !== generation.current) return;
          const channel = result.providers.find(item => item.provider === restored.provider);
          setFlow(restored);
          if (channel) {setWizard(channel); setStep(restored.status === 'select' ? 2 : restored.status === 'connected' ? 4 : 1);}
        } catch (failure) {if (alive && epoch === generation.current) {rememberFlow(storageKey, null); if (returning) setError((failure as Error).message);}}
      } catch (failure) {if (alive && epoch === generation.current) setError((failure as Error).message);}
    })();
    return () => {alive = false; generation.current++;};
  }, [actor?.id, actor?.clubId]);
  useEffect(() => {
    if (!flow || !['pending', 'processing', 'returned'].includes(flow.status)) return;
    const epoch = generation.current;
    let alive = true;
    const timer = window.setInterval(() => {
      void api<OAuthFlow>('/api/channels/flows/' + flow.flowId).then(async result => {
        if (!alive || epoch !== generation.current) return;
        if (result.status === 'returned') result = await finishFlow(result.flowId);
        if (alive && epoch === generation.current) setFlow(result);
      }).catch(failure => {if (alive && epoch === generation.current) setError(failure.message);});
    }, 2500);
    return () => {alive = false; window.clearInterval(timer);};
  }, [flow?.flowId, flow?.status]);
  useEffect(() => {setSelection('');}, [flow?.flowId]);
  useEffect(() => {
    if (!activeFlow) return;
    if (activeFlow.status === 'select') setStep(current => current < 2 ? 2 : current);
    else if (activeFlow.status === 'connected') setStep(4);
    else if (['denied', 'expired', 'failed', 'cancelled'].includes(activeFlow.status)) setStep(1);
  }, [flow?.flowId, flow?.status, wizard?.provider]);

  function finishFlow(flowId: string) {
    const current = finishing.current.get(flowId);
    if (current) return current;
    const request = api<OAuthFlow>('/api/channels/post-for-me/finish', {method: 'POST', body: JSON.stringify({flowId})}).finally(() => {finishing.current.delete(flowId);});
    finishing.current.set(flowId, request);
    return request;
  }
  async function run(action: () => Promise<void>) {
    const epoch = generation.current;
    setBusy(true); setError('');
    try {await action();}
    catch (failure) {if (epoch === generation.current) setError((failure as Error).message);}
    finally {if (epoch === generation.current) setBusy(false);}
  }
  function openWizard(channel: ServerChannel) {
    setError(''); setWizard(channel);
    const existing = flow?.provider === channel.provider ? flow : null;
    setStep(existing ? existing.status === 'select' ? 2 : existing.status === 'connected' ? 4 : 1 : 0);
    if (!existing) setSelection('');
  }
  function closeWizard() {
    if (dismissState.current.busy) return;
    setWizard(null); setError('');
    if (dismissState.current.activeFlow?.status === 'connected') {setFlow(null); setSelection(''); rememberFlow(storageKey, null);}
  }
  async function start(channel: ServerChannel) {
    if (!channel.configured || channel.status === 'revocation_pending') return;
    const epoch = generation.current;
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    try {
      const result = await api<{flowId: string; authorizationUrl: string}>(`/api/channels/${channel.provider}/start`, {
        method: 'POST', body: JSON.stringify({expectedVersion: channel.version}),
      });
      if (epoch !== generation.current) {popup?.close(); return;}
      rememberFlow(storageKey, result.flowId);
      if (popup && channel.integration === 'post-for-me') {
        try {popup.sessionStorage.setItem(storageKey, result.flowId); if (actor?.clubId) popup.sessionStorage.setItem('castiq-active-club', actor.clubId);} catch {/* The original tab can finish the returned attempt through its authenticated status poll. */}
      }
      setFlow({flowId: result.flowId, provider: channel.provider, status: 'pending', candidates: []});
      setSelection(''); setStep(1);
      if (popup) popup.location.href = result.authorizationUrl;
      else location.assign(result.authorizationUrl);
    } catch (failure) {popup?.close(); throw failure;}
  }
  async function choose() {
    if (!activeFlow || activeFlow.status !== 'select' || !choice) return;
    const epoch = generation.current;
    let saved: ServerChannelList;
    try {
      saved = await api<ServerChannelList>(`/api/channels/${activeFlow.provider}/select`, {
        method: 'POST', body: JSON.stringify({flowId: activeFlow.flowId, accountId: choice.id}),
      });
    } catch (failure) {
      if (epoch === generation.current && failure instanceof ServerError && ['flow_expired', 'conflict', 'not_found'].includes(failure.code)) {
        setFlow({...activeFlow, status: failure.code === 'flow_expired' ? 'expired' : 'failed'});
        setSelection(''); setStep(1); rememberFlow(storageKey, null);
        await refresh().catch(() => {});
      }
      throw failure;
    }
    if (epoch !== generation.current) return;
    setData(saved); setFlow({...activeFlow, status: 'connected'}); setStep(4);
    rememberFlow(storageKey, null);
    await reload();
    if (epoch === generation.current) toast('De koppeling is bevestigd.');
  }
  async function checkFlow() {
    if (!activeFlow) return;
    const epoch = generation.current;
    let result = await api<OAuthFlow>('/api/channels/flows/' + activeFlow.flowId);
    if (epoch !== generation.current) return;
    if (result.status === 'returned') result = await finishFlow(result.flowId);
    if (epoch === generation.current) setFlow(result);
  }
  if (actor?.role !== 'club') return <div role="alert" className="local-access-error">Alleen de bevoegde clubbeheerder kan eigen kanalen beheren.</div>;

  const guide = wizard ? serverGuides[wizard.name] : null;
  const quickstart = currentChannel?.integration === 'post-for-me';
  const steps = ['Voorbereiden', 'Toestemming', wizard?.name === 'Facebook' ? 'Pagina kiezen' : 'Account kiezen', 'Controleren'];
  return <section className="social-connections">
    <header className="social-page-head"><div><h1>Koppelingen</h1><p>Verbind de clubaccounts. We begeleiden je stap voor stap.</p></div>
      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void run(refresh)}><RefreshCw size={15}/> Verversen</button>
    </header>
    {error && !wizard && <p role="alert" className="social-error"><CircleAlert size={16}/>{error}</p>}
    {!data && !error && <p role="status">Kanaalkoppelingen laden…</p>}
    {data && <section className="social-directory social-server-directory" aria-labelledby={`${groupId}-channels`}>
      <header><div><Link2 size={18} aria-hidden="true"/><h2 id={`${groupId}-channels`}>Sociale kanalen</h2></div><span>{linkedCount} van {data.providers.length} gekoppeld</span></header>
      <ul>{data.providers.map(channel => <li className="social-channel" key={channel.provider}>
        <div className="social-channel-provider">{channel.avatarUrl ? <img className="social-account-avatar" src={channel.avatarUrl} alt="" referrerPolicy="no-referrer" onError={event => {event.currentTarget.hidden = true;}}/> : <ProviderMark provider={channel.name} small/>}<div><strong>{channel.name}</strong>
          <span>{channel.accountName || (channel.name === 'Facebook' ? 'Koppel de Facebook-pagina van je club' : `Koppel het ${channel.name}-account van je club`)}</span></div></div>
        <div className="social-channel-options" aria-label={`Bestemmingen ${channel.name}`}>
          {(channel.destinations.length ? channel.destinations : destinations[channel.name]).map(destination => <span key={destination}>{destination}</span>)}
        </div>
        <div className="social-channel-state"><span data-state={channel.status} data-linked={channel.status === 'connected'}>{channelStatus[channel.status] || 'Controle nodig'}</span>
          <small>{!channel.configured ? 'Provider nog niet vrijgegeven' : channel.checkedAt ? `Gecontroleerd ${timeFormat.format(new Date(channel.checkedAt))}` : 'Klaar om te koppelen'}</small>
        </div>
        <div className="social-channel-actions">
          {channel.status !== 'revocation_pending' && <button type="button" className="btn btn-primary" aria-label={`${channel.name} ${channel.status === 'connected' ? 'opnieuw koppelen' : 'koppelen'}`} disabled={busy} onClick={() => openWizard(channel)}><Link2 size={15}/>{channel.status === 'connected' ? 'Opnieuw koppelen' : 'Koppelen'}</button>}
          {channel.version > 0 && <>
            {!['disconnected', 'revocation_pending'].includes(channel.status) && <button type="button" className="social-icon-button" aria-label={`Test ${channel.name}-koppeling`} title="Koppeling controleren" disabled={busy || !channel.configured} onClick={() => void run(async () => {
              await api(`/api/channels/${channel.provider}/test`, {method: 'POST', body: JSON.stringify({expectedVersion: channel.version})});
              await refresh(); await reload(); toast('De status is gecontroleerd. Er is geen bericht geplaatst.');
            })}><FlaskConical size={17}/></button>}
            {channel.status !== 'disconnected' && <button type="button" className="social-icon-button social-unplug" aria-label={`${channel.name} ${channel.status === 'revocation_pending' ? 'ontkoppeling controleren' : 'ontkoppelen'}`} title={channel.status === 'revocation_pending' ? 'Ontkoppeling controleren' : 'Ontkoppelen'} disabled={busy} onClick={() => setDisconnect(channel)}><Unplug size={17}/></button>}
          </>}
        </div>
      </li>)}</ul>
    </section>}
    {flow && !wizard && flow.status !== 'connected' && <div className="social-pending-session"><div><strong>Je koppeling is nog niet afgerond</strong><p>Ga verder met {data?.providers.find(channel => channel.provider === flow.provider)?.name || 'je kanaal'}.</p></div>
      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => {const channel = data?.providers.find(item => item.provider === flow.provider); if (channel) openWizard(channel);}}>Verder gaan</button>
    </div>}
    <div className="social-shortcuts">
      <section><span className="social-shortcut-icon">{paused ? <Play size={19}/> : <Pause size={19}/>}</span><div><h2>Clubbrede publicatie</h2><p>{paused ? 'Het versturen van nieuwe berichten is gepauzeerd.' : 'Pauzeer het versturen voor alle clubkanalen tegelijk.'}</p></div>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void run(async () => {await command('publication.pause', {paused: !paused});})}>{paused ? 'Hervatten' : 'Pauzeren'}</button>
      </section>
      <section><span className="social-shortcut-icon"><Globe2 size={19}/></span><div><h2>Wedstrijdbronnen</h2><p>Beheer waar programma en uitslagen vandaan komen.</p></div>
        <button type="button" className="btn btn-secondary" onClick={() => onNavigate?.('sources')}>Beheren <ExternalLink size={14}/></button>
      </section>
    </div>
    <p className="social-environment-note"><ShieldCheck size={15} aria-hidden="true"/> {(state as any).publicationMode==='provider'?'Na activering en koppeling kan de clubredactie goedgekeurde berichten publiceren. Koppelen en de verbinding controleren plaatsen geen bericht.':'Publiceren wordt hier alleen getest. Er verschijnen geen berichten op je sociale kanalen.'}</p>

    {wizard && currentChannel && guide && <Modal title={`${wizard.name} koppelen`} onClose={closeWizard}>
      <div className="social-wizard">
        <div className="social-wizard-provider"><ProviderMark provider={wizard.name}/><div><strong>{state.club.name}</strong><span>Verbinding met {wizard.name}</span></div><LockKeyhole size={18} aria-label="Beveiligde verbinding"/></div>
        <ol className="social-steps" aria-label="Stappen">{steps.map((title, index) => <li key={title} aria-current={step === index ? 'step' : undefined} data-status={step === index ? 'current' : step > index ? 'done' : 'next'}><span>{step > index ? <Check size={14}/> : index + 1}</span><small>{title}</small></li>)}</ol>
        {error && <p role="alert" className="social-error"><CircleAlert size={16}/>{error}</p>}
        {step === 4 ? <section className="social-connection-result" aria-live="polite"><span className="social-success-mark"><Check size={28}/></span><h3>Koppeling bevestigd</h3><p>{choice?.name || currentChannel.accountName || wizard.name} is gekoppeld aan {state.club.name}.</p><p>Je account is gecontroleerd. Er is geen bericht geplaatst.</p></section> :
          <section className="social-wizard-content" aria-labelledby={`${groupId}-step`}>
            <h3 id={`${groupId}-step`} aria-live="polite">{steps[step]}</h3>
            {step === 0 && <><p>{guide.requires}</p><ol className="social-checklist">{guide.prepare.map(text => <li key={text}>{text}</li>)}</ol></>}
            {step === 1 && <>
              {!waiting && !failed && activeFlow?.status !== 'select' && <><p>{quickstart ? wizard.name === 'Facebook' ? 'Je geeft via Post for Me toestemming bij Meta. Kies het bedoelde bedrijf en alleen de Facebook-pagina van jullie vereniging. Je bevestigt de pagina daarna nog in Castiq.' : 'Je geeft via Post for Me rechtstreeks toestemming bij Instagram. Gebruik het professionele clubaccount (Bedrijf of Creator). Je bevestigt het account daarna nog in Castiq.' : guide.consent}</p>{quickstart && <p className="social-safe-note"><ShieldCheck size={16}/> Op het toestemmingsscherm zie je de naam Post for Me. Je vereniging hoeft geen eigen ontwikkelaarsapp of API-sleutel te beheren.</p>}<ul className="social-permissions" aria-label="Gevraagde toegang">{guide.permissions.map(text => <li key={text}><Check size={15} aria-hidden="true"/>{text}</li>)}</ul>
                <p className="social-safe-note"><LockKeyhole size={16} aria-hidden="true"/> Je wachtwoord vul je alleen bij {wizard.name} in. Castiq vraagt hier niet om je wachtwoord.</p></>}
              {!currentChannel.configured && <div className="social-setup-notice" role="status"><CircleAlert size={20} aria-hidden="true"/><div><strong>Koppelen is nog niet beschikbaar</strong><p>{quickstart ? currentChannel.configurationMessage || 'Platformbeheer moet de Post for Me-stagingaansluiting eerst instellen, testen en inschakelen. Daarna koppel je hier jullie eigen clubaccount.' : 'De Castiq-app voor dit kanaal moet eerst door platformbeheer worden vrijgegeven. Daarna koppel je hier zelf het account van jullie vereniging; je hoeft geen eigen ontwikkelaarsapp te registreren.'}</p></div></div>}
              {waiting && <div className="social-waiting" role="status"><ExternalLink size={23}/><strong>Rond de toestemming af bij {wizard.name}</strong><p>Ga naar het geopende venster. Kom daarna hier terug; de wizard gaat automatisch verder.</p><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void run(checkFlow)}><RefreshCw size={15}/> Status controleren</button>{quickstart && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void run(async () => {await api('/api/channels/post-for-me/cancel', {method: 'POST', body: JSON.stringify({flowId: activeFlow.flowId})}); setFlow(null); setSelection(''); rememberFlow(storageKey, null); setStep(1); await refresh();})}>Koppelpoging annuleren</button>}</div>}
              {failed && <div className="social-setup-notice" role="alert"><CircleAlert size={20}/><div><strong>{activeFlow.status === 'denied' ? 'Geen toestemming gegeven' : activeFlow.status === 'expired' ? 'Koppelsessie verlopen' : 'Koppelen niet gelukt'}</strong><p>{flowMessage(activeFlow)}</p>{activeFlow.notice && <p>{activeFlow.notice}</p>}</div></div>}
              {activeFlow?.status === 'select' && <p className="social-safe-note"><Check size={16}/> Toestemming ontvangen. Ga verder om het juiste clubaccount te kiezen.</p>}
            </>}
            {step === 2 && <>
              <p>{wizard.name === 'Facebook' ? 'Welke pagina hoort bij je vereniging?' : 'Welk account hoort bij je vereniging?'} Je bestaande koppeling blijft behouden totdat je bevestigt.</p>
              {activeFlow?.notice && <p className="social-safe-note" role="status"><CircleAlert size={16} aria-hidden="true"/>{activeFlow.notice}</p>}
              <fieldset className="social-options social-accounts"><legend>{wizard.name === 'Facebook' ? 'Beschikbare pagina’s' : 'Beschikbare accounts'}</legend>
                {candidates.map(candidate => <label key={candidate.id} className="social-account-option"><input type="radio" name={`${groupId}-account`} value={candidate.id} checked={selection === candidate.id} disabled={candidate.selectable === false} onChange={() => setSelection(candidate.id)}/>{candidate.avatarUrl && <img className="social-account-avatar" src={candidate.avatarUrl} alt="" referrerPolicy="no-referrer" onError={event => {event.currentTarget.hidden = true;}}/>}<span><strong>{candidate.name}</strong><small>{accountTypeLabel[candidate.type] || 'Clubaccount'} · {candidate.destinations.join(' · ')}</small>{candidate.selectable === false && <small role="status">{candidate.blockedReason || 'Dit account kan niet betrouwbaar aan deze vereniging worden gekoppeld.'}</small>}</span></label>)}
              </fieldset>
              {!candidates.length && <p role="status">Er zijn nog geen accounts beschikbaar. Ga terug om opnieuw toestemming te geven.</p>}
              <details className="social-help"><summary>Ik zie mijn {wizard.name === 'Facebook' ? 'pagina' : 'account'} niet</summary><p>{guide.missing}</p></details>
            </>}
            {step === 3 && choice && <><p>Controleer de gegevens voordat je de koppeling bevestigt.</p><dl className="social-summary"><div><dt>Vereniging</dt><dd>{state.club.name}</dd></div><div><dt>{wizard.name === 'Facebook' ? 'Pagina' : 'Account'}</dt><dd>{choice.name}</dd></div><div><dt>Bestemmingen</dt><dd>{choice.destinations.join(' · ')}</dd></div></dl><p className="social-safe-note"><ListChecks size={16}/> We controleren de koppeling. Met deze stap plaats je geen bericht.</p></>}
            <div className="social-docs"><a href={guide.help} target="_blank" rel="noreferrer">{guide.helpLabel} <ExternalLink size={13} aria-hidden="true"/></a></div>
          </section>}
        <div className="social-wizard-footer">
          {step === 4 ? <span/> : <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => {
            setError(''); if (step === 0) closeWizard(); else setStep(step - 1);
          }}>{step === 0 ? 'Annuleren' : 'Terug'}</button>}
          <div>{step === 4 ? <button type="button" className="btn btn-primary" onClick={closeWizard}>Gereed <Check size={16}/></button> :
            step === 3 ? <button type="button" className="btn btn-primary" disabled={busy || !choice || activeFlow?.status !== 'select'} onClick={() => void run(choose)}>{busy ? 'Koppeling bevestigen…' : 'Account koppelen'}</button> :
            step === 2 ? <button type="button" className="btn btn-primary" disabled={busy || !choice} onClick={() => setStep(3)}>Verder</button> :
            step === 1 ? waiting ? <button type="button" className="btn btn-secondary" disabled={busy} onClick={closeWizard}>Later verder</button> :
              activeFlow?.status === 'select' ? <button type="button" className="btn btn-primary" disabled={busy} onClick={() => setStep(2)}>Verder</button> :
              <button type="button" className="btn btn-primary" disabled={busy || !currentChannel.configured || currentChannel.status === 'revocation_pending'} onClick={() => void run(() => start(currentChannel))}>{busy ? 'Toestemming openen…' : failed ? 'Opnieuw proberen' : `Doorgaan naar ${wizard.name}`} <ExternalLink size={15}/></button> :
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => setStep(1)}>Verder</button>}
          </div>
        </div>
      </div>
    </Modal>}
    {disconnect && <Modal title={`${disconnect.name} ontkoppelen`} onClose={() => {if (!dismissState.current.busy) setDisconnect(null);}}><div className="social-disconnect"><p>Dit account is daarna niet meer beschikbaar voor nieuwe berichten. Niet-verzonden en toekomstige opdrachten voor dit kanaal worden gestopt. Eerder gepubliceerde berichten en publicatiehistorie blijven bewaard. Je andere clubkanalen blijven gekoppeld.</p><div className="social-wizard-footer"><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setDisconnect(null)}>Annuleren</button><button type="button" className="btn btn-primary" disabled={busy} onClick={() => void run(async () => {
      await api(`/api/channels/${disconnect.provider}`, {method: 'DELETE', body: JSON.stringify({expectedVersion: disconnect.version})});
      setDisconnect(null); await refresh(); await reload();
    })}>{disconnect.status === 'revocation_pending' ? 'Ontkoppeling controleren' : 'Ontkoppelen bevestigen'}</button></div></div></Modal>}
  </section>;
}
