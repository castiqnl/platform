import React, { useEffect, useRef, useState } from 'react';
import { Check, CreditCard, Handshake, LockKeyhole, Settings2, Users } from 'lucide-react';
import {
  getClubPlan,
  getPartnerBranding,
  getPartnerDiscountPercent,
  isFreePlan,
  setClubPlan,
  setPartnerDiscountPercent,
  setPartnerOptIn,
  subscribePartnerBranding,
} from './partnerBranding';
import { currentClubId, useCastiq } from './store';
import { Modal, PageTitle } from './ui';
import './partner-plan.css';
import {api} from './serverClient';

type PaidPlan = { name: string; price: number; teams: number; description?: string };
const freePlan = { name: 'Gratis', price: 0, teams: null };
const euros = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (cents: number) => euros.format(cents / 100);

function monthlyQuote(price: number, percent: number) {
  const base = Math.round(price * 100);
  const savings = Math.round(base * percent / 100);
  return { base, savings, net: base - savings };
}

export function usePartnerPolicyRefresh() {
  const [, setRevision] = useState(0);
  useEffect(() => subscribePartnerBranding(() => setRevision(value => value + 1)), []);
}

function PartnerLogo() {
  return <div className="cp-logo">
    <img src="/assets/logo-dark.svg" alt="Castiq" width="100" height="32"/>
  </div>;
}

function DemoPartnerPlan({ plans, onManageTeams }: { plans: PaidPlan[]; onManageTeams?: () => void }) {
  const { state, mode, log, toast } = useCastiq();
  const [error, setError] = useState('');
  usePartnerPolicyRefresh();

  const clubId = currentClubId(state);
  const planName = getClubPlan(clubId, state.club.plan);
  const activeTeams = state.teams.filter(team => team.active).length;
  const branding = getPartnerBranding(clubId, planName);
  const rate = getPartnerDiscountPercent();
  const catalog = [freePlan, ...plans.filter(plan => !isFreePlan(plan.name))];
  const current = isFreePlan(planName) ? freePlan : catalog.find(plan => plan.name === planName);
  const quote = current ? monthlyQuote(current.price, branding.discountPercent) : null;

  function changePlan(name: string) {
    try {
      setError('');
      setClubPlan(clubId, name);
      log('Demoabonnement gewijzigd', `Castiq ${name}`);
      toast(`Castiq ${name} gekozen voor dit prototype.`);
    } catch (failure) {
      setError((failure as Error).message);
    }
  }

  function changeParticipation(checked: boolean) {
    try {
      setError('');
      setPartnerOptIn(clubId, checked);
      log('Castiq-partnerlogo aangepast', checked ? 'De vereniging doet mee' : 'De vereniging doet niet meer mee');
      toast(checked ? 'Castiq-partnerlogo ingeschakeld.' : 'Castiq-partnerlogo uitgeschakeld voor nieuwe bijdragen.');
    } catch (failure) {
      setError((failure as Error).message);
    }
  }

  return <div className="cp-wrap">
    <PageTitle title="Abonnement" description="Bekijk je bundel, kies een demopakket en stel het Castiq-partnerlogo in."/>
    <div className="cp-summary">
      <section className="cp-panel" aria-labelledby="cp-current-plan">
        <header className="cp-card-heading"><CreditCard size={17} aria-hidden="true"/><h2 id="cp-current-plan">Huidig demoabonnement</h2></header>
        <div className="cp-plan-overview">
          <div className="cp-current-info">
            <strong>{current ? `Castiq ${current.name}` : 'Geen bundel gekozen'}</strong>
            <span className="cp-current-usage"><Users size={15} aria-hidden="true"/>{activeTeams}{current?.teams ? ` / ${current.teams}` : ''} actieve teams</span>
          </div>
          {quote && <div className="cp-price" aria-live="polite">
            <strong>{money(quote.net)}</strong>
            <span>per maand excl. btw</span>
          </div>}
        </div>
        <div className="cp-summary-foot">
          {quote?.savings > 0 && <span>Je bespaart {money(quote.savings)} per maand.</span>}
          {onManageTeams && <button className="text-btn" type="button" onClick={onManageTeams}>Teams beheren</button>}
        </div>
      </section>

      <section className="cp-panel cp-partner-card" aria-labelledby="cp-club-partner">
        <header className="cp-card-heading"><Handshake size={18} aria-hidden="true"/><h2 id="cp-club-partner">Castiq-partnerlogo</h2></header>
        <div className="cp-partner-info">
          <PartnerLogo/>
          <div>
            <strong>{branding.required ? 'Verplicht bij Gratis' : rate > 0 ? `${rate}% sponsorkorting` : 'Optionele partnervermelding'}</strong>
            <p>{branding.required
              ? 'Het Castiq-logo staat vast op alle formaten van nieuwe clubvisuals.'
              : 'Geef Castiq een vaste logoplek op nieuwe clubvisuals.'}</p>
          </div>
        </div>
        {branding.required
          ? <p className="cp-required"><LockKeyhole size={15} aria-hidden="true"/> Altijd zichtbaar in dit pakket</p>
          : <label className="cp-choice">
            <input type="checkbox" checked={branding.optedIn} disabled={mode !== 'demo'} onChange={event => changeParticipation(event.target.checked)}/>
            <span>Plaats Castiq als partner{rate > 0 ? ` voor ${rate}% korting` : ''}</span>
          </label>}
      </section>
    </div>

    <section className="cp-panel" aria-labelledby="cp-plan-options">
      <header className="cp-card-heading cp-list-heading">
        <h2 id="cp-plan-options">Kies een demobundel</h2>
        <span>Voorstelprijzen per maand excl. btw</span>
      </header>
      <ul className="cp-plan-list">
        {catalog.map(plan => {
          const selected = plan.name === current?.name;
          const overLimit = plan.teams !== null && activeTeams > plan.teams;
          const price = monthlyQuote(plan.price, !isFreePlan(plan.name) && branding.optedIn ? rate : 0);
          return <li key={plan.name} className={selected ? 'is-current' : ''}>
            <div className="cp-plan-option"><strong>Castiq {plan.name}</strong>
              <small>{plan.teams !== null ? `Tot ${plan.teams} actieve teams` : 'Castiq-partnerlogo verplicht'}</small>
            </div>
            <div className="cp-option-price">{price.savings > 0 && <s>{money(price.base)}</s>}<strong>{money(price.net)}</strong></div>
            <div className="cp-plan-action">
              {selected ? <span className="cp-current-label"><Check size={14} aria-hidden="true"/> Gekozen</span>
                : <button className="btn btn-secondary" type="button" disabled={overLimit || mode !== 'demo'} onClick={() => changePlan(plan.name)}
                  title={overLimit ? 'Deze bundel heeft minder plekken dan je aantal actieve teams.' : undefined}
                  aria-label={overLimit ? `${plan.name} kiezen is niet mogelijk met ${activeTeams} actieve teams` : `Kies ${plan.name}`}>Kies</button>}
            </div>
          </li>;
        })}
      </ul>
    </section>
    {error && <p className="local-access-error" role="alert">{error}</p>}
    <p className="cp-example-note">Demokeuzes worden op dit apparaat bewaard. Er wordt niets gefactureerd.</p>
  </div>;
}

export function PlatformPartnerConfig() {
  const { toast } = useCastiq();
  usePartnerPolicyRefresh();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const rate = getPartnerDiscountPercent();

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('discount');
    if (typeof value !== 'string' || value.trim() === '') return;
    try {
      setPartnerDiscountPercent(Number(value));
      setEditing(false);
      toast('Voorbeeldtarief opgeslagen.');
    } catch (failure) {
      setError((failure as Error).message);
    }
  }

  return <section className="platform-plans-panel cp-platform" aria-labelledby="cp-platform-heading">
    <header className="platform-plans-heading">
      <div><Handshake size={18} aria-hidden="true"/><h2 id="cp-platform-heading">Castiq-partnerlogo</h2></div>
      <button className="btn btn-secondary" type="button" onClick={() => { setError(''); setEditing(true); }}><Settings2 size={15} aria-hidden="true"/> Korting instellen</button>
    </header>
    <div className="cp-platform-content">
      <PartnerLogo/>
      <dl>
        <div><dt>Gratis pakket</dt><dd><LockKeyhole size={14} aria-hidden="true"/> Logo verplicht</dd></div>
        <div><dt>Betaalde pakketten</dt><dd>{rate > 0 ? `${rate}% sponsorkorting bij opt-in` : 'Optioneel logo zonder korting'}</dd></div>
      </dl>
    </div>
    {editing && <Modal title="Sponsorkorting instellen" onClose={() => setEditing(false)}>
      <form onSubmit={save}>
        <p className="cp-example-note">Dit percentage geldt in de demo voor betaalde bundels van verenigingen die het Castiq-logo plaatsen.</p>
        <label className="field">Korting (%)<input name="discount" type="number" min="0" max="100" step="1" defaultValue={rate} required/></label>
        {error && <p className="local-access-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button className="btn btn-secondary" type="button" onClick={() => setEditing(false)}>Annuleren</button>
          <button className="btn btn-primary" type="submit">Korting opslaan</button>
        </div>
      </form>
    </Modal>}
  </section>;
}


export type CentralPlan={name:string;baseCents:number;teamLimit:number|null;description:string};
export type CentralPolicy={version:number;discountPercent:number;plans:CentralPlan[];currency:string;tax:string;billingActivated:false};
export type CentralQuote={plan:string;baseCents:number;savingsCents:number;netCents:number;teamLimit:number|null;discountPercent:number;partnerLogo:boolean;required:boolean;optedIn:boolean;policyVersion:number;choiceVersion:number;capturedAt:string};
type CentralClubPlan={policy:CentralPolicy;snapshot:CentralQuote;activeTeams:number;financialProcessing:string};
export function PartnerPlan(props:{plans:PaidPlan[];onManageTeams?:()=>void}){const {mode}=useCastiq();return mode==='demo'?<DemoPartnerPlan {...props}/>:<ServerPartnerPlan onManageTeams={props.onManageTeams}/>;}
function ServerPartnerPlan({onManageTeams}:{onManageTeams?:()=>void}){
 const {actor,toast}=useCastiq(),[data,setData]=useState<CentralClubPlan|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);const generation=useRef(0);
 useEffect(()=>{let active=true;const epoch=++generation.current;setData(null);setError('');setBusy(false);if(actor?.role==='club')void api<CentralClubPlan>('/api/club/plan').then(v=>{if(active&&epoch===generation.current)setData(v);}).catch(e=>{if(active&&epoch===generation.current)setError(e.message);});return()=>{active=false;generation.current++;};},[actor?.id,actor?.clubId]);
 async function save(plan:string,optedIn:boolean){if(!data)return;const epoch=generation.current;setBusy(true);setError('');try{const v=await api<CentralClubPlan>('/api/club/plan',{method:'PUT',body:JSON.stringify({plan,optedIn,expectedVersion:data.snapshot.choiceVersion,expectedPolicyVersion:data.policy.version})});if(epoch===generation.current){setData(v);toast('Centrale bundelkeuze bewaard. Er is geen betaling gestart.');}}catch(e){if(epoch===generation.current)setError((e as Error).message);}finally{if(epoch===generation.current)setBusy(false);}}
 if(actor?.role!=='club')return <p role="alert">Alleen een bevoegde clubbeheerder kan de eigen bundel kiezen.</p>;
 return <div className="cp-wrap"><PageTitle title="Abonnement" description="Je centrale bundel en expliciete keuze voor het Castiq-partnerlogo."/>{error&&<p className="local-access-error" role="alert">{error} <button className="text-btn" onClick={()=>{const epoch=generation.current;void api<CentralClubPlan>('/api/club/plan').then(v=>{if(epoch===generation.current){setData(v);setError('');}}).catch(e=>setError(e.message));}}>Opnieuw laden</button></p>}{!data&&!error&&<p role="status">Centrale pakketten laden…</p>}{data&&<><div className="cp-summary"><section className="cp-panel"><header className="cp-card-heading"><CreditCard size={17}/><h2>Centrale bundelkeuze</h2></header><div className="cp-plan-overview"><div className="cp-current-info"><strong>Castiq {data.snapshot.plan}</strong><span>{data.activeTeams}{data.snapshot.teamLimit!==null?` / ${data.snapshot.teamLimit}`:''} actieve teams</span></div><div className="cp-price"><strong>{money(data.snapshot.netCents)}</strong><span>per maand excl. btw · prijsvoorstel</span></div></div><div className="cp-summary-foot"><span>{data.snapshot.savingsCents>0?`Je bespaart ${money(data.snapshot.savingsCents)} per maand.`:'Geen sponsorkorting toegepast.'}</span>{onManageTeams&&<button className="text-btn" onClick={onManageTeams}>Teams beheren</button>}</div></section><section className="cp-panel cp-partner-card"><header className="cp-card-heading"><Handshake size={18}/><h2>Castiq-partnerlogo</h2></header><div className="cp-partner-info"><PartnerLogo/><div><strong>{data.snapshot.required?'Verplicht bij Gratis':data.policy.discountPercent?`${data.policy.discountPercent}% sponsorkorting bij deelname`:'Vrijwillige partnervermelding'}</strong><p>Nieuwe bijdragen leggen de serverkeuze vast. Eerdere versies en exports behouden hun eigen keuze.</p></div></div>{data.snapshot.required?<p className="cp-required"><LockKeyhole size={15}/> Logo verplicht; geen opt-out bij Gratis</p>:<label className="cp-choice"><input type="checkbox" checked={data.snapshot.optedIn} disabled={busy} onChange={e=>void save(data.snapshot.plan,e.target.checked)}/><span>Ik kies namens de club voor het Castiq-partnerlogo{data.policy.discountPercent?` voor ${data.policy.discountPercent}% sponsorkorting`:''}.</span></label>}</section></div><section className="cp-panel"><header className="cp-card-heading"><h2>Kies je bundel</h2><span>Centrale tarieven · versie {data.policy.version}</span></header><ul className="cp-plan-list">{data.policy.plans.map(p=>{const selected=p.name===data.snapshot.plan,over=p.teamLimit!==null&&data.activeTeams>p.teamLimit;const savings=p.name==='Gratis'||!data.snapshot.optedIn?0:Math.floor((p.baseCents*data.policy.discountPercent+50)/100);return <li key={p.name} className={selected?'is-current':''}><div className="cp-plan-option"><strong>Castiq {p.name}</strong><small>{p.teamLimit!==null?`Tot ${p.teamLimit} actieve teams`:'Partnerlogo verplicht'}</small></div><div className="cp-option-price"><strong>{money(p.baseCents-savings)}</strong></div><div className="cp-plan-action">{selected?<span className="cp-current-label"><Check size={14}/> Gekozen</span>:<button className="btn btn-secondary" disabled={busy||over} title={over?'Meer actieve teams dan deze bundel toestaat.':undefined} onClick={()=>void save(p.name,data.snapshot.optedIn)}>Kies</button>}</div></li>;})}</ul></section><p className="cp-example-note">{data.financialProcessing} Deze keuze start geen factuur, incasso of betaald abonnement. De serverprijs is het gezaghebbende voorstel; vastgelegde historische snapshots blijven behouden.</p></>}</div>;
}
