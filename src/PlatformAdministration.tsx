import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Building2, ChevronDown, ChevronLeft, ChevronRight, Info, Plus, RefreshCw, Search, UserRoundPlus } from 'lucide-react';
import { api } from './serverClient';
import { useCastiq } from './store';
import { MailAdmin } from './MailAdmin';
import { Empty, Modal, PageTitle } from './ui';
import { formatDeadline } from './AccountSettings';
import './account-settings.css';
import './platform-administration.css';

type Club = { id: string; name: string; version: number; updatedAt?: string; members: number };
type Account = { id: string; email: string; status: string; registeredAt: string; isPlatform: boolean };
type PrivacyCase = {
  id: string; kind: string; status: string; received_at: string; due_at: string; assigned_to: string | null;
  closed_at: string | null; extended_at: string | null; extension_requested_at: string | null;
};
type CaseDetails = { email: string; message: string; verification_note?: string };
type DirectoryTab = 'clubs' | 'accounts';

const accountStatuses: Record<string, string> = {
  active: 'Actief', registration_pending: 'Registratie open',
  deletion_pending: 'Verwijdering aangevraagd', deleting: 'Wissing in behandeling',
};
const caseKinds: Record<string, string> = {
  erasure: 'Wissing', access: 'Inzage', rectification: 'Correctie', restriction: 'Beperking',
  portability: 'Overdracht', objection: 'Bezwaar', withdrawal: 'Intrekking',
};
const outcomes = {
  fulfilled: 'Verzoek uitgevoerd', partially_fulfilled: 'Deels uitgevoerd',
  rejected_with_reason: 'Gemotiveerd afgewezen', forwarded_to_controller: 'Doorgeleid naar verantwoordelijke club',
  withdrawn: 'Ingetrokken door betrokkene',
};
const pageSize = 10;
const nl = new Intl.Collator('nl-NL', { sensitivity: 'base' });
const dates = new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium', timeZone:'Europe/Amsterdam' });
const toDate = (value?: string | null) => value && Number.isFinite(Date.parse(value)) ? dates.format(new Date(value)) : '—';
const labelForCase = (item: PrivacyCase) => caseKinds[item.kind] || 'Privacyverzoek';
const stateForCase = (item: PrivacyCase) => item.status === 'closed' ? 'Afgerond' : item.status === 'in_progress' ? 'In behandeling' : 'Nieuw';

export function PlatformAdministration({ initialTab = 'clubs' }: { initialTab?: 'clubs' | 'mail' | 'privacy' }) {
  return <div className="platform-administration pa-page">
    {initialTab === 'clubs' ? <ClubAdministration/> : initialTab === 'privacy' ? <PrivacyAdministration/> : <>
      <PageTitle title="E-mail" description="Beheer dienstmail via Resend, Supabase-templates en aflevering."/>
      <div className="pa-mail"><MailAdmin/></div>
    </>}
  </div>;
}

function DirectoryPager({ count, page, onPage }: { count: number; page: number; onPage: (page: number) => void }) {
  if (count === 0) return null;
  const pages = Math.ceil(count / pageSize);
  return <div className="pa-pager">
    <span>{page * pageSize + 1}–{Math.min((page + 1) * pageSize, count)} van {count}</span>
    {pages > 1 && <div className="pa-pager-actions">
      <button className="icon-btn pa-icon" aria-label="Vorige pagina" disabled={page === 0} onClick={() => onPage(page - 1)}><ChevronLeft size={16}/></button>
      <button className="icon-btn pa-icon" aria-label="Volgende pagina" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}><ChevronRight size={16}/></button>
    </div>}
  </div>;
}

function ClubAdministration() {
  const {actor}=useCastiq();
  const requestRef=useRef(0);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tab, setTab] = useState<DirectoryTab>('clubs');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(0);
  const [modal, setModal] = useState<'create' | 'role' | null>(null);
  const [clubId, setClubId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loaded, setLoaded] = useState({clubs:false,accounts:false});
  const [accountLimit,setAccountLimit]=useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const request=++requestRef.current;
    setLoading(true);setError('');
    const [directory,registrations]=await Promise.allSettled([
      api<{clubs:Club[]}>('/api/admin/clubs'),
      api<{accounts:Account[];truncated?:boolean}>('/api/admin/users'),
    ]);
    if(request!==requestRef.current)return;
    if(directory.status==='fulfilled')setClubs(directory.value.clubs);
    if(registrations.status==='fulfilled'){setAccounts(registrations.value.accounts);setAccountLimit(Boolean(registrations.value.truncated));}
    setLoaded(previous=>({clubs:previous.clubs||directory.status==='fulfilled',accounts:previous.accounts||registrations.status==='fulfilled'}));
    const failed=[directory.status==='rejected'&&'verenigingen',registrations.status==='rejected'&&'registraties'].filter(Boolean);
    setError(failed.length?`Niet ververst: ${failed.join(', ')}. Eerder geladen gegevens blijven beschikbaar.`:'');
    setLoading(false);
  }, []);
  useEffect(()=>{setClubs([]);setAccounts([]);setLoaded({clubs:false,accounts:false});setAccountLimit(false);setMessage('');setModal(null);void load();return()=>{requestRef.current++;};},[load,actor?.id,actor?.clubId]);

  function changeTab(next: DirectoryTab) {
    setTab(next);
    setQuery('');
    setFilter('all');
    setSort('name');
    setPage(0);
  }

  function showRole(id = '') {
    setClubId(id);
    setModal('role');
  }

  function finish(action: string, createdId?: string) {
    setModal(null);
    setMessage(action);
    if (createdId) {
      setClubId(createdId);
      changeTab('clubs');
    }
    void load();
  }

  const term = query.trim().toLocaleLowerCase('nl-NL');
  const hasUpdateDates = clubs.some(club => Boolean(club.updatedAt));
  const visibleClubs = clubs.filter(club => club.name.toLocaleLowerCase('nl-NL').includes(term)
    && (filter === 'all' || (filter === 'with-access' ? club.members > 0 : club.members === 0)));
  visibleClubs.sort((a, b) => {
    if (sort === 'date') {
      const time = (Date.parse(b.updatedAt || '') || 0) - (Date.parse(a.updatedAt || '') || 0);
      if (time) return time;
    }
    if (sort === 'members' && a.members !== b.members) return b.members - a.members;
    return nl.compare(a.name, b.name);
  });
  const visibleAccounts = accounts.filter(account => (account.email || '').toLocaleLowerCase('nl-NL').includes(term)
    && (filter === 'all' || (filter === 'platform' ? account.isPlatform : account.status === filter)));
  visibleAccounts.sort((a, b) => {
    if (sort === 'date') return (Date.parse(b.registeredAt) || 0) - (Date.parse(a.registeredAt) || 0);
    return nl.compare(a.email || '', b.email || '');
  });
  const count = tab === 'clubs' ? visibleClubs.length : visibleAccounts.length;
  const visiblePage = Math.min(page, Math.max(0, Math.ceil(count / pageSize) - 1));
  const offset = visiblePage * pageSize;

  return <>
    <PageTitle title="Verenigingen" description="Clubomgevingen, toegangsrollen en registraties." actions={<div className="pa-heading-actions">
      <button className="btn btn-secondary" disabled={!clubs.length} onClick={() => showRole(clubId)}><UserRoundPlus size={16}/> Clubrol toewijzen</button>
      <button className="btn btn-primary" onClick={() => setModal('create')}><Plus size={17}/> Vereniging toevoegen</button>
    </div>}/>
    {error && <p className="pa-alert" role="alert">{error}<button className="text-btn" onClick={() => void load()}>Opnieuw laden</button></p>}
    {message && <p className="pa-message" role="status">{message}</p>}
    <section className="card pa-directory" aria-busy={loading} aria-label={tab === 'clubs' ? 'Verenigingsoverzicht' : 'Persoonlijke registraties'}>
      <div className="pa-directory-nav">
        <div className="pa-tabs" role="group" aria-label="Overzicht kiezen">
          <button aria-pressed={tab === 'clubs'} onClick={() => changeTab('clubs')}>Verenigingen <span>{loaded.clubs?clubs.length:'–'}</span></button>
          <button aria-pressed={tab === 'accounts'} onClick={() => changeTab('accounts')}>Persoonlijke registraties <span>{loaded.accounts?accounts.length:'–'}</span></button>
        </div>
        <button className="icon-btn pa-icon" aria-label="Vernieuwen" title="Vernieuwen" disabled={loading} onClick={() => void load()}><RefreshCw size={16}/></button>
      </div>
      <div className="pa-toolbar">
        <label className="pa-search"><Search size={16} aria-hidden="true"/><input type="search" aria-label={tab === 'clubs' ? 'Zoek vereniging' : 'Zoek registratie'} placeholder={tab === 'clubs' ? 'Zoek op clubnaam…' : 'Zoek op e-mailadres…'} value={query} onChange={event => { setQuery(event.target.value); setPage(0); }}/></label>
        <label className="pa-select"><select aria-label={tab === 'clubs' ? 'Filter op toegang' : 'Filter op accountstatus'} value={filter} onChange={event => { setFilter(event.target.value); setPage(0); }}>
          {tab === 'clubs' ? <><option value="all">Alle toegangsstatussen</option><option value="with-access">Met toegangsrollen</option><option value="without-access">Zonder toegangsrollen</option></> : <><option value="all">Alle accountstatussen</option>{Object.entries(accountStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}<option value="platform">Platformbeheerder</option></>}
        </select><ChevronDown size={14}/></label>
        <label className="pa-select"><select aria-label="Sorteren op" value={sort} onChange={event => { setSort(event.target.value); setPage(0); }}>
          <option value="name">{tab === 'clubs' ? 'Clubnaam A–Z' : 'E-mailadres A–Z'}</option>
          {(tab === 'accounts' || hasUpdateDates) && <option value="date">{tab === 'clubs' ? 'Recent bijgewerkt' : 'Recent geregistreerd'}</option>}
          {tab === 'clubs' && <option value="members">Meeste toegangsrollen</option>}
        </select><ChevronDown size={14}/></label>
      </div>
      {tab==='accounts'&&accountLimit&&<p className="pa-help">Je ziet de 200 meest recente registraties. Zoeken en filters gelden voor deze selectie.</p>}
      {!loaded[tab] && loading ? <p className="pa-loading" role="status">Verenigingen en registraties laden…</p>
        : !loaded[tab] ? <p className="pa-loading">{tab==='clubs'?'Verenigingen':'Registraties'} zijn nog niet beschikbaar. Probeer opnieuw te laden.</p>
        : count && tab === 'clubs' ? <div className="pa-table-wrap"><table className="pa-table"><thead><tr>
          <th scope="col">Vereniging</th><th scope="col">Toegangsrollen</th>{hasUpdateDates && <th scope="col" className="pa-hide-mobile">Bijgewerkt</th>}<th scope="col" className="pa-hide-mobile">Versie</th><th scope="col" className="pa-last">Actie</th>
        </tr></thead><tbody>
          {visibleClubs.slice(offset, offset + pageSize).map(club => <tr key={club.id}>
            <th scope="row"><span className="pa-club-name"><span className="pa-club-icon" aria-hidden="true"><Building2 size={16}/></span><span>{club.name}</span></span></th>
            <td><span className={club.members ? 'pa-count' : 'pa-count is-empty'}>{club.members}</span></td>
            {hasUpdateDates && <td className="pa-hide-mobile">{toDate(club.updatedAt)}</td>}<td className="pa-hide-mobile">v{club.version}</td>
            <td className="pa-last"><button className="icon-btn pa-icon" aria-label={`Clubrol toewijzen voor ${club.name}`} title="Clubrol toewijzen" onClick={() => showRole(club.id)}><UserRoundPlus size={16}/></button></td>
          </tr>)}
        </tbody></table></div>
        : count ? <div className="pa-table-wrap"><table className="pa-table"><thead><tr>
          <th scope="col">E-mailadres</th><th scope="col">Status</th><th scope="col" className="pa-hide-mobile">Geregistreerd</th>
        </tr></thead><tbody>
          {visibleAccounts.slice(offset, offset + pageSize).map(account => <tr key={account.id}>
            <th scope="row"><div className="pa-account-name">{account.email || 'Afgeschermd account'}{account.isPlatform && <small>Platformbeheerder</small>}</div></th>
            <td><span className={`pa-state ${account.status === 'active' ? 'is-active' : ''}`}>{accountStatuses[account.status] || 'Geen actieve toegang'}</span></td>
            <td className="pa-hide-mobile">{toDate(account.registeredAt)}</td>
          </tr>)}
        </tbody></table></div>
        : loaded[tab] ? <Empty title={term || filter !== 'all' ? 'Geen resultaten' : tab === 'clubs' ? 'Er zijn nog geen verenigingen' : 'Er zijn nog geen registraties'}
                 description={term || filter !== 'all' ? 'Pas je zoekopdracht of filter aan.' : undefined}/> : null}
      <DirectoryPager count={loaded[tab]?count:0} page={visiblePage} onPage={setPage}/>
    </section>
    {modal === 'create' && <ClubActionModal title="Vereniging toevoegen" close={() => setModal(null)} onDone={finish}/>}
    {modal === 'role' && <ClubActionModal title="Clubrol toewijzen" close={() => setModal(null)} onDone={finish} directory={{ clubs, accounts, clubId }}/>}
  </>;
}

function ClubActionModal({ title, close, onDone, directory }: {
  title: string; close: () => void; onDone: (message: string, id?: string) => void;
  directory?: { clubs: Club[]; accounts: Account[]; clubId: string };
}) {
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [role, setRole] = useState('club');
  const eligibleAccounts = directory?.accounts.filter(account => account.status === 'active' && !account.isPlatform) || [];
  const closeWhenIdle = () => { if (!busyRef.current) close(); };

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    const data = new FormData(event.currentTarget);
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      if (directory) {
        const name = String(data.get('displayName') || '').trim();
        await api(`/api/admin/clubs/${encodeURIComponent(String(data.get('clubId')))}/memberships`, {
          method: 'PUT', body: JSON.stringify({
            actorId: data.get('accountId'), role, ...(name ? { name } : {}),
            ...(role === 'team' ? { team: String(data.get('team') || '').trim() } : {}),
          }),
        });
        onDone('Clubrol opgeslagen. De gebruiker ziet de omgeving na opnieuw laden.');
      } else {
        const result = await api<{ club: Club }>('/api/admin/clubs', {
          method: 'POST', body: JSON.stringify({ name: data.get('name'), color: data.get('color'), accent: data.get('accent') }),
        });
        onDone(`${result.club.name} is aangemaakt. Je kunt nu een clubrol toewijzen.`, result.club.id);
      }
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }

  return <Modal title={title} onClose={closeWhenIdle}>
    <form className="pa-modal-fields" onSubmit={event => void submit(event)}>
      {error && <p className="pa-alert" role="alert">{error}</p>}
      {directory ? <>
        <p>De gebruiker moet een persoonlijke registratie hebben afgerond. Voor het toewijzen van een clubrol is een recente aanmelding vereist.</p>
        <label className="field">Vereniging<select required name="clubId" defaultValue={directory.clubId}>
          <option value="">Kies een vereniging</option>{directory.clubs.map(club => <option key={club.id} value={club.id}>{club.name}</option>)}
        </select></label>
        {!eligibleAccounts.length&&<p role="status">Er zijn nog geen toewijsbare persoonlijke accounts. Laat de gebruiker eerst de persoonlijke registratie afronden en vernieuw dit overzicht.</p>}
        <label className="field">Geregistreerde gebruiker<select required name="accountId" defaultValue="">
          <option value="">Kies een actief persoonlijk account</option>{eligibleAccounts.map(account => <option key={account.id} value={account.id}>{account.email}</option>)}
        </select></label>
        <div className="pa-field-pair">
          <label className="field">Toegangsrol<select value={role} onChange={event => setRole(event.target.value)}><option value="club">Clubbeheerder</option><option value="team">Teammanager</option></select></label>
          <label className="field">Weergavenaam<input name="displayName" maxLength={120} placeholder="Optioneel"/></label>
        </div>
        {role === 'team' && <label className="field">Bestaande teamnaam<input required name="team" maxLength={120}/><small>Gebruik de exacte naam van een actief team van deze vereniging.</small></label>}
      </> : <>
        <p>De clubvertegenwoordiger aanvaardt de clubafspraken na de eerste aanmelding.</p>
        <label className="field">Naam van de vereniging<input required name="name" maxLength={120}/></label>
        <div className="pa-field-pair">
          <label className="field">Primaire clubkleur<input name="color" type="color" defaultValue="#b7ff00"/></label>
          <label className="field">Secundaire clubkleur<input name="accent" type="color" defaultValue="#ffffff"/></label>
        </div>
      </>}
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={closeWhenIdle}>Annuleren</button>
        <button className="btn btn-primary" disabled={busy || Boolean(directory && !eligibleAccounts.length)}>{busy ? 'Opslaan…' : directory ? 'Clubrol opslaan' : 'Clubomgeving aanmaken'}</button>
      </div>
    </form>
  </Modal>;
}

function PrivacyAdministration() {
  const { actor } = useCastiq();
  const [cases, setCases] = useState<PrivacyCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [filter, setFilter] = useState('open');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [details, setDetails] = useState<{ id: string; value: CaseDetails } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api<{ cases: PrivacyCase[] }>('/api/privacy/cases');
      setCases(result.cases);
      setLoaded(true);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  function reveal(id: string | null) {
    setExpanded(id);
    setDetails(null);
  }

  async function changeCase(id: string, data: Record<string, string>) {
    setWorking(true);
    setError('');
    try {
      await api(`/api/privacy/cases/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) });
      if (data.action === 'close') {
        reveal(null);
      }
      await load();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setWorking(false);
    }
  }

  async function showDetails(id: string) {
    setWorking(true);
    setError('');
    try {
      const value = await api<CaseDetails>(`/api/privacy/cases/${encodeURIComponent(id)}`);
      setDetails({ id, value });
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setWorking(false);
    }
  }

  const openCount = cases.filter(item => item.status !== 'closed').length;
  const visible = cases.filter(item => filter === 'all' || (filter === 'open' ? item.status !== 'closed' : item.status === 'closed'));
  visible.sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at));

  return <>
    <PageTitle title="Privacyzaken" description="Volg reactietermijnen op en behandel toegewezen verzoeken."/>
    {error && <p className="pa-alert" role="alert">{error}<button className="text-btn" onClick={() => void load()}>Opnieuw laden</button></p>}
    <section className="card pa-directory" aria-label="Privacyverzoeken">
      <div className="pa-directory-nav">
        <div className="pa-tabs" role="group" aria-label="Filter privacyzaken">
          {[['open', 'Open', openCount], ['closed', 'Afgerond', cases.length - openCount], ['all', 'Alle', cases.length]].map(([key, label, count]) => (
            <button key={key} aria-pressed={filter === key} disabled={working} onClick={() => { setFilter(String(key)); reveal(null); }}>{label} <span>{count}</span></button>
          ))}
        </div>
        <button className="icon-btn pa-icon" aria-label="Zaken vernieuwen" title="Zaken vernieuwen" disabled={loading || working} onClick={() => void load()}><RefreshCw size={16}/></button>
      </div>
      <details className="pa-help">
        <summary><Info size={15}/> Toegang en bewaartermijn</summary>
        <p>Wijs een zaak aan jezelf toe om de noodzakelijke contactgegevens en toelichting te openen. Na afronding bewaart Castiq de minimale zaakmetadata nog 12 kalendermaanden.</p>
      </details>
      {!loaded && !error ? <p className="pa-loading" role="status">Privacyzaken laden…</p> : visible.length ? <ul className="pa-cases">
        {visible.map(item => <li className="pa-case" key={item.id}>
          <button className="pa-case-row" aria-expanded={expanded === item.id} aria-controls={`case-${item.id}`} disabled={working} onClick={() => reveal(expanded === item.id ? null : item.id)}>
            <span><strong>{labelForCase(item)}</strong><small>Ontvangen {toDate(item.received_at)}</small></span>
            <span className={`pa-state ${item.status === 'closed' ? 'is-active' : ''}`}>{stateForCase(item)}</span>
            <span className="pa-case-due"><small>{item.status === 'closed' ? 'Afgerond' : 'Reactietermijn'}</small>{toDate(item.closed_at || item.due_at)}</span>
            <ChevronDown size={16}/>
          </button>
          {expanded === item.id && <div className="pa-case-expanded" id={`case-${item.id}`}>
            <dl className="pa-case-facts"><div><dt>Zaakreferentie</dt><dd>{item.id}</dd></div><div><dt>Reactietermijn</dt><dd>{formatDeadline(item.due_at)}</dd></div></dl>
            {item.extension_requested_at && !item.extended_at && <p role="status">De kennisgeving over de verlenging wacht op bevestiging. De oorspronkelijke reactietermijn geldt.</p>}
            {item.extended_at && <p>Verlengingskennisgeving afgeleverd op {formatDeadline(item.extended_at)}.</p>}
            {item.closed_at ? <p>Afgerond op {formatDeadline(item.closed_at)}.</p> : <CaseActions
              item={item} busy={working} actorId={actor?.id} details={details?.id === item.id ? details.value : null}
              change={data => void changeCase(item.id, data)} show={() => void showDetails(item.id)} hide={() => setDetails(null)}
            />}
          </div>}
        </li>)}
      </ul> : loaded ? <Empty title={filter === 'open' ? 'Geen open privacyzaken' : filter === 'closed' ? 'Geen afgeronde privacyzaken' : 'Geen privacyzaken'}/> : null}
    </section>
  </>;
}

function CaseActions({ item, busy, actorId, details, change, show, hide }: {
  item: PrivacyCase; busy: boolean; actorId?: string; details: CaseDetails | null;
  change: (data: Record<string, string>) => void; show: () => void; hide: () => void;
}) {
  const [outcome, setOutcome] = useState('fulfilled');
  const [reason, setReason] = useState('');
  const own = Boolean(actorId && item.assigned_to === actorId);
  return <>
    <div className="pa-case-actions">
      {own ? <><span className="pa-state is-active">Aan jou toegewezen</span><button className="btn btn-secondary" disabled={busy} onClick={details ? hide : show}>{details ? 'Contactgegevens sluiten' : 'Contactgegevens openen'}</button></>
        : <button className="btn btn-secondary" disabled={busy || !actorId} onClick={() => change({ action: 'assign', assignedTo: actorId! })}>Aan mij toewijzen</button>}
    </div>
    {details && <div className="platform-case-detail"><strong>{details.email}</strong><p>{details.message}</p>{details.verification_note && <p>{details.verification_note}</p>}</div>}
    <details className="pa-case-resolution">
      <summary>Zaak afhandelen</summary>
      <div className="pa-resolution-grid">
        <div>
          <label className="field">Uitkomst<select value={outcome} onChange={event => setOutcome(event.target.value)}>
            {Object.entries(outcomes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <p className="muted">Leg de uitkomst en communicatie vast vóór je de zaak sluit.</p>
          <button className="btn btn-secondary" disabled={busy} onClick={() => change({ action: 'close', outcome })}>Zaak definitief afronden</button>
        </div>
        <div>
          <label className="field">Reden voor wettelijke verlenging<textarea minLength={10} maxLength={1000} rows={2} value={reason} onChange={event => setReason(event.target.value)}/></label>
          <p className="muted">Een verlenging kan binnen de eerste kalendermaand, met een geldige reden en tijdige kennisgeving. Een eerdere wisvraag blijft afzonderlijk beoordeeld.</p>
          <button className="btn btn-secondary" disabled={busy || !!item.extension_requested_at || !!item.extended_at || reason.trim().length < 10} onClick={() => change({ action: 'extend', reason })}>Verlenging aanvragen</button>
        </div>
      </div>
    </details>
  </>;
}
