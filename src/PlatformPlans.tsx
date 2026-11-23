import React, {useEffect, useRef, useState} from 'react';
import {Building2, CreditCard, Pencil, RefreshCw, Search} from 'lucide-react';
import {api, ServerError} from './serverClient';
import {useCastiq} from './store';
import {Empty, Modal, PageTitle} from './ui';
import {getClubPlan, getPartnerBranding, isFreePlan} from './partnerBranding';
import {PlatformPartnerConfig, usePartnerPolicyRefresh, type CentralPolicy, type CentralQuote} from './PartnerPlan';
import './platform-plans.css';

type Plan = {name: string; price: number; teams: number; description: string};
type PlatformClub = {id: string; name: string};

export const planStorageKey = 'castiq-plans';
export const defaultPlans: Plan[] = [
  {name: 'Start', price: 39, teams: 5, description: 'Een sterke basis voor kleine clubs.'},
  {name: 'Club', price: 69, teams: 20, description: 'Alle teams en één herkenbare clubstem.'},
  {name: 'Pro', price: 119, teams: 50, description: 'Meer ruimte voor ambitieuze verenigingen.'},
];

const euros = new Intl.NumberFormat('nl-NL', {style: 'currency', currency: 'EUR', maximumFractionDigits: 2, minimumFractionDigits: 0});

function readPlans() {
  try {
    const saved = JSON.parse(localStorage.getItem(planStorageKey) || 'null');
    if (!Array.isArray(saved)) return defaultPlans;
    return defaultPlans.map(plan => {
      const record = saved.find(value => value?.name === plan.name);
      if (!record || !Number.isFinite(record.price) || record.price < 0 || !Number.isInteger(record.teams) || record.teams < 1) return plan;
      return {...plan, price: record.price, teams: record.teams, description: typeof record.description === 'string' ? record.description : plan.description};
    });
  } catch {
    return defaultPlans;
  }
}

function DemoPlatformPlans() {
  const {state, log, toast, mode} = useCastiq();
  usePartnerPolicyRefresh();
  const [plans, setPlans] = useState(readPlans);
  const [clubs, setClubs] = useState<PlatformClub[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refresh, setRefresh] = useState(0);
  const [query, setQuery] = useState('');
  const [bundle, setBundle] = useState('');
  const [draft, setDraft] = useState<Plan | null>(null);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    let active = true;
    setStatus('loading');
    api<{clubs: PlatformClub[]}>('/api/admin/clubs').then(result => {
      if (active) {setClubs(result.clubs); setStatus('ready');}
    }).catch(() => {
      if (active) setStatus('error');
    });
    return () => {active = false;};
  }, [refresh]);

  const rows = clubs.map(club => {
    const assignment = state.clubs.find(candidate => candidate.id === club.id);
    return {...club, assignment, planName: mode === 'demo' ? getClubPlan(club.id, assignment?.plan || '') : assignment?.plan || ''};
  });
  const visibleClubs = rows.filter(club =>
    (!bundle || (club.planName || 'none') === bundle) &&
    club.name.toLocaleLowerCase('nl-NL').includes(query.trim().toLocaleLowerCase('nl-NL')),
  );

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || mode !== 'demo') return;
    const fields = new FormData(event.currentTarget);
    const price = Number(fields.get('price'));
    const teams = Number(fields.get('teams'));
    if (!Number.isFinite(price) || price < 0 || !Number.isSafeInteger(teams) || teams < 1) {
      setSaveError('Vul een geldige prijs en een teamlimiet van minimaal één in.');
      return;
    }
    const next = plans.map(plan => plan.name === draft.name ? {...plan, price, teams, description: String(fields.get('description') ?? '').trim()} : plan);
    try {
      localStorage.setItem(planStorageKey, JSON.stringify(next));
    } catch {
      setSaveError('De bundel kon niet in deze browser worden opgeslagen.');
      return;
    }
    setPlans(next);
    setDraft(null);
    log('Demobundel aangepast', draft.name);
    toast(`Bundel ${draft.name} opgeslagen.`);
  }

  return <div className="platform-plans">
    <PageTitle title="Abonnementen" description="Beheer bundelprijzen en teamlimieten. Bekijk welke bundel per vereniging is ingesteld."/>
    <section className="platform-plans-panel" aria-labelledby="platform-plan-bundles">
      <header className="platform-plans-heading">
        <div><CreditCard size={18}/><h2 id="platform-plan-bundles">Bundels</h2></div>
        <span>Per maand · excl. btw</span>
      </header>
      <table className="platform-plan-table">
        <thead><tr><th scope="col">Bundel</th><th scope="col">Prijs</th><th scope="col">Teamlimiet</th><th scope="col" className="platform-plan-usage">Verenigingen</th>{mode === 'demo' && <th scope="col" aria-label="Acties"/>}</tr></thead>
        <tbody>{mode === 'demo' && <tr>
          <th scope="row">Castiq Gratis<small>Met vast Castiq-partnerlogo</small></th><td>{euros.format(0)}</td><td>—</td>
          <td className="platform-plan-usage">{status === 'ready' ? rows.filter(club => isFreePlan(club.planName)).length : '—'}</td><td/>
        </tr>}{plans.map(plan => <tr key={plan.name}>
          <th scope="row">Castiq {plan.name}<small>{plan.description}</small></th>
          <td>{euros.format(plan.price)}</td>
          <td>{plan.teams}</td>
          <td className="platform-plan-usage">{status === 'ready' ? rows.filter(club => club.planName === plan.name).length : '—'}</td>
          {mode === 'demo' && <td className="platform-plan-action"><button className="icon-btn" type="button" aria-label={`Bundel ${plan.name} bewerken`} title={`Bundel ${plan.name} bewerken`} onClick={() => {setSaveError(''); setDraft(plan);}}><Pencil size={16}/></button></td>}
        </tr>)}</tbody>
      </table>
    </section>
    {mode === 'demo' && <PlatformPartnerConfig/>}
    <section className="platform-plans-panel" aria-labelledby="platform-plan-clubs">
      <header className="platform-plans-heading">
        <div><Building2 size={18}/><h2 id="platform-plan-clubs">Per vereniging</h2></div>
        {status === 'ready' && <span>{visibleClubs.length} van {rows.length}</span>}
      </header>
      {status === 'loading' && <p className="platform-plans-note" role="status">Verenigingen laden…</p>}
      {status === 'error' && <p className="platform-plans-note" role="alert">Verenigingen konden niet worden geladen. <button className="text-btn" type="button" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={14}/> Opnieuw proberen</button></p>}
      {status === 'ready' && <>
        <div className="platform-plans-filters">
          <label className="search-field"><Search size={16}/><input aria-label="Zoek vereniging" placeholder="Zoek vereniging…" value={query} onChange={event => setQuery(event.target.value)}/></label>
          <select aria-label="Filter op bundel" value={bundle} onChange={event => setBundle(event.target.value)}><option value="">Alle bundels</option>{mode === 'demo' && <option>Gratis</option>}{plans.map(plan => <option key={plan.name}>{plan.name}</option>)}<option value="none">Geen bundel</option></select>
        </div>
        {visibleClubs.length ? <table className="platform-plan-table">
          <thead><tr><th scope="col">Vereniging</th><th scope="col">Bundel</th><th scope="col">Actieve teams</th><th scope="col">Status</th></tr></thead>
          <tbody>{visibleClubs.map(club => {
            const {assignment} = club;
            const plan = plans.find(item => item.name === club.planName);
            const partner = mode === 'demo' && club.planName ? getPartnerBranding(club.id, club.planName) : null;
            return <tr key={club.id}><th scope="row">{club.name}</th><td>{isFreePlan(club.planName) ? 'Gratis' : plan?.name || 'Geen bundel'}{partner?.enabled && <small className="cp-platform-row-detail">{partner.required ? 'Logo verplicht' : partner.discountPercent > 0 ? `${partner.discountPercent}% sponsorkorting` : 'Partnerlogo actief'}</small>}</td><td>{assignment ? plan ? `${assignment.teams} / ${plan.teams}` : assignment.teams : '—'}</td><td><span className={'platform-plan-status' + (assignment?.status === 'Actief' ? ' is-active' : '')}>{assignment?.status || 'Geen status'}</span></td></tr>;
          })}</tbody>
        </table> : <Empty title="Geen verenigingen gevonden" description="Pas de zoekopdracht of bundelfilter aan."/>}
      </>}
    </section>
    {mode === 'demo' && <p className="platform-plans-caption">Demobundels met voorstelprijzen. Wijzigingen gelden voor dit apparaat.</p>}
    {draft && <Modal title={`Bundel ${draft.name} bewerken`} onClose={() => setDraft(null)}>
      <form onSubmit={save}>
        <div className="platform-plans-fields">
          <label className="field">Prijs per maand excl. btw<input autoFocus name="price" type="number" min="0" step="0.01" required defaultValue={draft.price}/></label>
          <label className="field">Teamlimiet<input name="teams" type="number" min="1" step="1" required defaultValue={draft.teams}/></label>
        </div>
        <label className="field">Omschrijving<textarea name="description" rows={3} defaultValue={draft.description}/></label>
        {saveError && <p className="local-access-error" role="alert">{saveError}</p>}
        <div className="modal-actions"><button className="btn btn-secondary" type="button" onClick={() => setDraft(null)}>Annuleren</button><button className="btn btn-primary" type="submit">Bundel opslaan</button></div>
      </form>
    </Modal>}
  </div>;
}


type CentralAdminClub = {
  id: string; name: string; activeTeams: number; choiceVersion: number; snapshot: CentralQuote;
  members: number; hasClubManager: boolean; status: 'active' | 'setup'; trial: boolean | null;
};
type CentralAdminPlans = {policy: CentralPolicy; clubs: CentralAdminClub[]};
const centsMoney = (value: number) => new Intl.NumberFormat('nl-NL', {style: 'currency', currency: 'EUR', minimumFractionDigits: 2}).format(value / 100);
function decimalCents(value: string) {
  if (!/^\d{1,7}(?:[.,]\d{1,2})?$/.test(value.trim())) throw new Error('Gebruik een prijs met maximaal twee decimalen.');
  const [whole, fraction = ''] = value.trim().replace(',', '.').split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
export function PlatformPlans() {
  const {mode} = useCastiq();
  return mode === 'demo' ? <DemoPlatformPlans/> : <ServerPlatformPlans/>;
}
function ServerPlatformPlans() {
  const {actor, toast} = useCastiq();
  const [data, setData] = useState<CentralAdminPlans | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<CentralPolicy | null>(null);
  const [saveError, setSaveError] = useState('');
  const [conflict, setConflict] = useState<CentralPolicy | null>(null);
  const [query, setQuery] = useState('');
  const [bundle, setBundle] = useState('');
  const [clubStatus, setClubStatus] = useState('');
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(1);
  const generation = useRef(0), requests = useRef(0), saving = useRef(false);
  const allowed = actor?.role === 'platform';
  useEffect(() => {
    let active = true;
    const epoch = ++generation.current, request = ++requests.current;
    setData(null); setDraft(null); setError(''); setSaveError(''); setConflict(null); setBusy(false);
    setQuery(''); setBundle(''); setClubStatus(''); setPage(1); saving.current = false;
    setLoading(allowed);
    if (allowed) void api<CentralAdminPlans>('/api/admin/plans').then(value => {
      if (active && epoch === generation.current && request === requests.current) setData(value);
    }).catch(failure => {
      if (active && epoch === generation.current && request === requests.current) setError(failure.message);
    }).finally(() => {
      if (active && epoch === generation.current && request === requests.current) setLoading(false);
    });
    return () => {active = false; generation.current++; requests.current++;};
  }, [actor?.id, actor?.clubId, allowed]);
  useEffect(() => setPage(1), [query, bundle, clubStatus, sort]);

  async function refresh() {
    const epoch = generation.current, request = ++requests.current;
    setLoading(true);
    try {
      const result = await api<CentralAdminPlans>('/api/admin/plans');
      if (epoch === generation.current && request === requests.current) {setData(result); setError('');}
    } catch (failure) {
      if (epoch === generation.current && request === requests.current) setError((failure as Error).message);
    } finally {
      if (epoch === generation.current && request === requests.current) setLoading(false);
    }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || saving.current || conflict) return;
    const fields = new FormData(event.currentTarget), epoch = generation.current;
    saving.current = true; requests.current++; setBusy(true); setSaveError('');
    try {
      const plans = draft.plans.map(plan => ({...plan,
        baseCents: plan.name === 'Gratis' ? 0 : decimalCents(String(fields.get(plan.name + '-price'))),
        teamLimit: plan.name === 'Gratis' ? null : Number(fields.get(plan.name + '-teams')),
        description: plan.name === 'Gratis' ? plan.description : String(fields.get(plan.name + '-description') ?? '').trim(),
      }));
      const result = await api<CentralAdminPlans>('/api/admin/plans', {method: 'PUT', body: JSON.stringify({expectedVersion: draft.version, discountPercent: Number(fields.get('discount')), plans})});
      if (epoch === generation.current) {
        setData(result); setDraft(null); setLoading(false); toast('Prijzen en sponsorkorting opgeslagen.');
      }
    } catch (failure) {
      if (epoch === generation.current) {
        setSaveError((failure as Error).message);
        if (failure instanceof ServerError && failure.status === 409) {
          try {
            const latest = await api<CentralAdminPlans>('/api/admin/plans');
            if (epoch === generation.current) {setData(latest); setConflict(latest.policy);}
          } catch {if (epoch === generation.current) setSaveError('Je invoer blijft staan. De nieuwste tarieven konden niet worden geladen. Probeer opnieuw.');}
        }
      }
    } finally {
      if (epoch === generation.current) {saving.current = false; setBusy(false); setLoading(false);}
    }
  }
  if (!allowed) return <p role="alert">Alleen platformbeheer kan centrale tarieven beheren.</p>;
  const search = query.trim().toLocaleLowerCase('nl-NL');
  const rows = (data?.clubs || []).filter(club => (!bundle || club.snapshot.plan === bundle) &&
    (!clubStatus || (clubStatus === 'trial' ? club.trial === true : club.status === clubStatus)) &&
    club.name.toLocaleLowerCase('nl-NL').includes(search)).sort((a, b) =>
      (sort === 'teams' ? b.activeTeams - a.activeTeams : sort === 'price' ? b.snapshot.netCents - a.snapshot.netCents : 0) || a.name.localeCompare(b.name, 'nl-NL') || a.id.localeCompare(b.id));
  const pageSize = 20, pages = Math.max(1, Math.ceil(rows.length / pageSize)), currentPage = Math.min(page, pages);
  const visible = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return <div className="platform-plans platform-plans-server">
    <PageTitle title="Abonnementen" description="Beheer je bundels, teamlimieten en sponsorkorting. Bekijk de gekozen bundel per vereniging."/>
    {error && <p role="alert" className="local-access-error">{error} <button className="text-btn" type="button" disabled={loading} onClick={() => void refresh()}>Opnieuw laden</button></p>}
    {!data && loading && <p role="status" className="platform-plans-note">Abonnementen laden…</p>}
    {data && <>
      <section className="platform-plans-panel" aria-labelledby="central-plan-bundles">
        <header className="platform-plans-heading"><div><CreditCard size={18} aria-hidden="true"/><h2 id="central-plan-bundles">Bundels</h2></div><button className="btn btn-secondary" type="button" onClick={() => {setSaveError(''); setConflict(null); setDraft(structuredClone(data.policy));}}><Pencil size={15} aria-hidden="true"/> Prijzen en korting instellen</button></header>
        <div className="platform-plans-scroll"><table className="platform-plan-table"><caption className="platform-plan-table-caption">Per maand, exclusief btw · tarieven versie {data.policy.version}</caption><thead><tr><th scope="col">Bundel</th><th scope="col">Maandprijs</th><th scope="col">Teamlimiet</th><th scope="col">Partnerlogo</th><th scope="col">Verenigingen</th></tr></thead><tbody>{data.policy.plans.map(plan => <tr key={plan.name} data-plan={plan.name}>
          <th scope="row">Castiq {plan.name}<small>{plan.description}</small></th><td>{centsMoney(plan.baseCents)}</td><td>{plan.teamLimit ?? 'Onbeperkt'}</td><td>{plan.name === 'Gratis' ? 'Verplicht' : data.policy.discountPercent > 0 ? `${data.policy.discountPercent}% korting bij deelname` : 'Vrijwillig'}</td><td>{data.clubs.filter(club => club.snapshot.plan === plan.name).length}</td>
        </tr>)}</tbody></table></div>
      </section>
      <section className="platform-plans-panel" aria-labelledby="central-plan-clubs" aria-busy={loading}>
        <header className="platform-plans-heading"><div><Building2 size={18} aria-hidden="true"/><h2 id="central-plan-clubs">Per vereniging</h2></div><button className="text-btn" type="button" disabled={loading} onClick={() => void refresh()}><RefreshCw size={14} aria-hidden="true"/>{loading ? 'Verversen…' : 'Verversen'}</button></header>
        <div className="platform-plans-filters">
          <label className="search-field"><Search size={16} aria-hidden="true"/><input aria-label="Zoek vereniging" value={query} onChange={event => setQuery(event.target.value)} placeholder="Zoek vereniging…"/></label>
          <select aria-label="Filter op bundel" value={bundle} onChange={event => setBundle(event.target.value)}><option value="">Alle bundels</option>{data.policy.plans.map(plan => <option key={plan.name} value={plan.name}>{plan.name}</option>)}</select>
          <select aria-label="Filter op clubstatus" value={clubStatus} onChange={event => setClubStatus(event.target.value)}><option value="">Alle statussen</option><option value="active">In gebruik</option><option value="setup">Nog geen gebruikers</option><option value="trial">Proefperiode</option></select>
          <select aria-label="Sorteer verenigingen" value={sort} onChange={event => setSort(event.target.value)}><option value="name">Naam A–Z</option><option value="teams">Meeste actieve teams</option><option value="price">Hoogste maandprijs</option></select>
        </div>
        <p className="platform-plans-result" role="status">{rows.length} van {data.clubs.length} verenigingen{rows.length > pageSize ? ` · ${((currentPage - 1) * pageSize) + 1}–${Math.min(currentPage * pageSize, rows.length)}` : ''}</p>
        {rows.length ? <div className="platform-plans-scroll"><table className="platform-plan-table platform-club-plans-table"><thead><tr><th scope="col">Vereniging</th><th scope="col">Bundel</th><th scope="col">Actieve teams</th><th scope="col">Maandprijs</th><th scope="col">Partnerdeelname</th><th scope="col">Clubstatus</th><th scope="col">Proefperiode</th></tr></thead><tbody>{visible.map(club => <tr key={club.id}>
          <th scope="row">{club.name}</th><td>{club.snapshot.plan}{club.choiceVersion === 0 && <small className="platform-plan-detail">Standaardbundel</small>}</td><td>{club.activeTeams}{club.snapshot.teamLimit !== null ? ` / ${club.snapshot.teamLimit}` : ''}</td><td>{centsMoney(club.snapshot.netCents)}</td><td>{club.snapshot.required ? 'Logo verplicht' : club.snapshot.optedIn ? club.snapshot.discountPercent > 0 ? `${club.snapshot.discountPercent}% sponsorkorting` : 'Partnerlogo actief' : 'Niet gekozen'}</td>
          <td><span className={'platform-plan-status' + (club.status === 'active' ? ' is-active' : '')}>{club.status === 'active' ? 'In gebruik' : 'Nog geen gebruikers'}</span><small className="platform-plan-detail">{club.members} {club.members === 1 ? 'gebruiker' : 'gebruikers'}{club.hasClubManager ? '' : ' · beheerder ontbreekt'}</small></td><td>{club.trial === true ? 'Ja' : club.trial === false ? 'Nee' : 'Niet vastgelegd'}</td>
        </tr>)}</tbody></table></div> : <Empty title={data.clubs.length ? 'Geen verenigingen gevonden' : 'Nog geen verenigingen'} description={data.clubs.length ? 'Pas de zoekopdracht of filters aan.' : 'Voeg een vereniging toe via Verenigingenbeheer.'}/>}
        {pages > 1 && <nav className="platform-plans-pagination" aria-label="Pagina’s met verenigingen"><button className="btn btn-secondary" type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Vorige</button><span>Pagina {currentPage} van {pages}</span><button className="btn btn-secondary" type="button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Volgende</button></nav>}
      </section>
      <p className="platform-plans-caption">Online betalen is nog niet beschikbaar. Bundelkeuzes starten geen factuur of incasso. Nieuwe tarieven gelden voor nieuwe bijdragen; eerder gemaakte versies behouden hun vastgelegde prijs en partnerlogo. Clubstatus toont gebruik van de omgeving, geen betaalstatus.</p>
    </>}
    {draft && <Modal title="Prijzen en sponsorkorting instellen" onClose={() => {if (!busy) setDraft(null);}}><form className="platform-plans-form" onSubmit={save}>
      <p className="platform-plans-form-note">Bedragen per maand, exclusief btw. Je wijzigt alle bundels samen in één tariefversie.</p>
      <label className="field">Sponsorkorting bij vrijwillig partnerlogo (%)<input name="discount" type="number" min="0" max="100" step="1" defaultValue={draft.discountPercent} required disabled={busy}/></label>
      {draft.plans.filter(plan => plan.name !== 'Gratis').map(plan => <fieldset className="platform-plans-fields" key={plan.name}><legend>Castiq {plan.name}</legend><label className="field">Maandprijs excl. btw<input name={plan.name + '-price'} aria-label={`Maandprijs ${plan.name}`} inputMode="decimal" defaultValue={(plan.baseCents / 100).toFixed(2)} required disabled={busy}/></label><label className="field">Actieve teams<input name={plan.name + '-teams'} aria-label={`Teamlimiet ${plan.name}`} type="number" min="1" max="10000" defaultValue={plan.teamLimit || 1} required disabled={busy}/></label><label className="field platform-plans-description">Omschrijving<input name={plan.name + '-description'} aria-label={`Omschrijving ${plan.name}`} maxLength={300} defaultValue={plan.description} disabled={busy}/></label></fieldset>)}
      <p className="platform-plans-form-note">Gratis blijft € 0 met het Castiq-partnerlogo. Opslaan start geen betaling.</p>
      {saveError && <p role="alert" className="local-access-error">{saveError}</p>}
      {conflict && <div className="platform-plan-conflict"><strong>Vergelijk met de nieuwste tarieven (versie {conflict.version})</strong><p>Je eigen invoer hierboven is behouden. Een andere beheerder heeft ondertussen deze waarden opgeslagen:</p><ul>{conflict.plans.filter(plan => plan.name !== 'Gratis').map(plan => <li key={plan.name}>{plan.name}: {centsMoney(plan.baseCents)} · {plan.teamLimit} teams · {plan.description || 'geen omschrijving'}</li>)}</ul><p>Sponsorkorting: {conflict.discountPercent}%</p><button type="button" className="btn btn-secondary" onClick={() => {setDraft({...draft, version: conflict.version}); setConflict(null); setSaveError('');}}>Vergelijking bevestigd — mijn invoer behouden</button></div>}
      <div className="modal-actions"><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setDraft(null)}>Annuleren</button><button className="btn btn-primary" disabled={busy || !!conflict}>{busy ? 'Opslaan…' : 'Nieuwe tariefversie opslaan'}</button></div>
    </form></Modal>}
  </div>;
}
