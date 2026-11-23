import React, {useEffect, useRef, useState} from 'react';
import {Building2, CreditCard, Pencil, RefreshCw, Search} from 'lucide-react';
import {api} from './serverClient';
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


type CentralAdminPlans={policy:CentralPolicy;clubs:{id:string;name:string;activeTeams:number;choiceVersion:number;snapshot:CentralQuote}[]};
const centsMoney=(value:number)=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR',minimumFractionDigits:2}).format(value/100);
function decimalCents(value:string){if(!/^\d{1,7}(?:[.,]\d{1,2})?$/.test(value))throw new Error('Gebruik een prijs met maximaal twee decimalen.');const [whole,fraction='']=value.replace(',','.').split('.');return Number(whole)*100+Number(fraction.padEnd(2,'0'));}
export function PlatformPlans(){const {mode}=useCastiq();return mode==='demo'?<DemoPlatformPlans/>:<ServerPlatformPlans/>;}
function ServerPlatformPlans(){
 const {actor,toast}=useCastiq(),[data,setData]=useState<CentralAdminPlans|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[draft,setDraft]=useState<CentralPolicy|null>(null),[query,setQuery]=useState('');const generation=useRef(0);
 useEffect(()=>{let active=true;const epoch=++generation.current;setData(null);setDraft(null);setError('');if(actor?.role==='platform')void api<CentralAdminPlans>('/api/admin/plans').then(v=>{if(active&&epoch===generation.current)setData(v);}).catch(e=>{if(active&&epoch===generation.current)setError(e.message);});return()=>{active=false;generation.current++;};},[actor?.id,actor?.clubId]);
 async function refresh(){const epoch=generation.current;try{const result=await api<CentralAdminPlans>('/api/admin/plans');if(epoch===generation.current){setData(result);setError('');}}catch(e){if(epoch===generation.current)setError((e as Error).message);}}
 async function save(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(!draft)return;const epoch=generation.current;setBusy(true);setError('');try{const fields=new FormData(event.currentTarget);const plans=draft.plans.map(p=>({...p,baseCents:p.name==='Gratis'?0:decimalCents(String(fields.get(p.name+'-price'))),teamLimit:p.name==='Gratis'?null:Number(fields.get(p.name+'-teams')),description:String(fields.get(p.name+'-description')||p.description)}));const result=await api<CentralAdminPlans>('/api/admin/plans',{method:'PUT',body:JSON.stringify({expectedVersion:draft.version,discountPercent:Number(fields.get('discount')),plans})});if(epoch===generation.current){setData(result);setDraft(null);toast('Centrale tariefversie opgeslagen. Historische snapshots blijven bewaard.');}}catch(e){if(epoch===generation.current)setError((e as Error).message);}finally{if(epoch===generation.current)setBusy(false);}}
 if(actor?.role!=='platform')return <p role="alert">Alleen platformbeheer kan centrale tarieven beheren.</p>;
 const rows=data?.clubs.filter(c=>c.name.toLocaleLowerCase('nl').includes(query.toLocaleLowerCase('nl')))||[];
 return <div className="platform-plans"><PageTitle title="Abonnementen" description="Centrale bundels, teamlimieten en vrijwillige partnerdeelname. Geen financiële activatie."/>{error&&<p role="alert" className="local-access-error">{error} <button className="text-btn" onClick={()=>void refresh()}>Opnieuw laden</button></p>}{!data&&!error&&<p role="status">Centrale tarieven laden…</p>}{data&&<><section className="platform-plans-panel"><header className="platform-plans-heading"><h2>Bundels · tariefversie {data.policy.version}</h2><button className="btn btn-secondary" onClick={()=>{setError('');setDraft(structuredClone(data.policy));}}>Prijzen en korting instellen</button></header><div className="platform-plans-scroll"><table className="platform-plan-table"><thead><tr><th>Bundel</th><th>Per maand excl. btw</th><th>Teamlimiet</th><th>Partnerlogo</th></tr></thead><tbody>{data.policy.plans.map(p=><tr key={p.name}><th>{p.name}<small>{p.description}</small></th><td>{centsMoney(p.baseCents)}</td><td>{p.teamLimit??'—'}</td><td>{p.name==='Gratis'?'Verplicht':`${data.policy.discountPercent}% bij opt-in`}</td></tr>)}</tbody></table></div></section><section className="platform-plans-panel"><header className="platform-plans-heading"><h2>Per vereniging</h2><span>{rows.length} verenigingen</span></header><label className="search-field"><Search size={16}/><input aria-label="Zoek vereniging" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Zoek vereniging…"/></label>{rows.length?<div className="platform-plans-scroll"><table className="platform-plan-table"><thead><tr><th>Vereniging</th><th>Bundel</th><th>Teams</th><th>Effectieve voorstelprijs</th><th>Partnerdeelname</th></tr></thead><tbody>{rows.map(c=><tr key={c.id}><th>{c.name}</th><td>{c.snapshot.plan}</td><td>{c.activeTeams}{c.snapshot.teamLimit!==null?` / ${c.snapshot.teamLimit}`:''}</td><td>{centsMoney(c.snapshot.netCents)}</td><td>{c.snapshot.required?'Logo verplicht':c.snapshot.optedIn?`${c.snapshot.discountPercent}% sponsorkorting`:'Niet gekozen'}</td></tr>)}</tbody></table></div>:<Empty title="Geen verenigingen gevonden" description="Pas je zoekopdracht aan."/>}</section><p className="platform-plans-caption">Prijzen zijn servervoorstellen in eurocenten. Er is geen betaalprovider gekoppeld en geen facturatie geactiveerd. Tariefwijzigingen gelden voor nieuwe offertes en snapshots; bestaande bijdrage-/publicatieversies worden niet aangepast.</p></>}{draft&&<Modal title="Centrale prijzen en sponsorkorting" onClose={()=>{if(!busy)setDraft(null);}}><form onSubmit={save}><label className="field">Sponsorkorting bij vrijwillig partnerlogo (%)<input name="discount" type="number" min="0" max="100" step="1" defaultValue={draft.discountPercent} required/></label>{draft.plans.filter(p=>p.name!=='Gratis').map(p=><fieldset className="platform-plans-fields" key={p.name}><legend>Castiq {p.name}</legend><label className="field">Maandprijs excl. btw<input name={p.name+'-price'} inputMode="decimal" defaultValue={(p.baseCents/100).toFixed(2)} required/></label><label className="field">Actieve teams<input name={p.name+'-teams'} type="number" min="1" max="10000" defaultValue={p.teamLimit||1} required/></label><label className="field">Omschrijving<input name={p.name+'-description'} maxLength={300} defaultValue={p.description}/></label></fieldset>)}<p>Gratis blijft € 0 met verplichte branding. Een nieuw tarief verandert geen historische snapshots en activeert geen financiële verwerking.</p>{error&&<p role="alert" className="local-access-error">{error}</p>}<div className="modal-actions"><button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>setDraft(null)}>Annuleren</button><button className="btn btn-primary" disabled={busy}>Nieuwe tariefversie opslaan</button></div></form></Modal>}</div>;
}
