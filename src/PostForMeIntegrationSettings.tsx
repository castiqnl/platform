import React, {useEffect, useRef, useState} from 'react';
import {Check, Copy, KeyRound, RefreshCw, Save, ShieldCheck, Webhook} from 'lucide-react';
import {api} from './serverClient';

type TestStatus = {status: string; checkedAt?: string | null; message?: string};
export type PostForMeIntegration = {
  available: boolean; version: number; configured: boolean; enabled: boolean; projectId: string;
  secureStorageConfigured: boolean; apiTest: TestStatus; webhook: TestStatus;
  redirectUrl?: string | null; webhookUrl?: string | null;
};
const endpoint = '/api/admin/integrations/post-for-me';
const date = (value?: string | null) => value ? new Intl.DateTimeFormat('nl-NL', {dateStyle: 'medium', timeStyle: 'short'}).format(new Date(value)) : '';
function ConnectionStatus({title, value, kind}: {title: string; value: TestStatus; kind: 'api' | 'webhook'}) {
  const status = kind === 'api' ? ({success: 'Verbinding geslaagd', invalid: 'API-sleutel ongeldig', unavailable: 'Tijdelijk niet bereikbaar', untested: 'Nog niet getest'}[value.status] || 'Nog niet getest') : ({registered: 'Webhook geregistreerd', active: 'Webhook geregistreerd', error: 'Controle nodig', unconfigured: 'Nog niet geregistreerd'}[value.status] || 'Nog niet geregistreerd');
  return <div><dt>{title}</dt><dd data-status={value.status}><strong>{status}</strong>{value.checkedAt && <small>{date(value.checkedAt)}</small>}{value.message && <small>{value.message}</small>}</dd></div>;
}
function TrustedUrl({label, value, onCopy}: {label: string; value?: string | null; onCopy: (label: string, value: string) => Promise<void>}) {
  const usable = Boolean(value && /^https:\/\//.test(value));
  return <label className="field integration-copy-field">{label}{usable ? <span><input aria-label={label} readOnly value={value || ''} onFocus={event => event.currentTarget.select()}/><button type="button" className="btn btn-secondary" onClick={() => void onCopy(label, value!)} aria-label={`${label} kopiëren`}><Copy size={16}/>Kopiëren</button></span> : <small>Beschikbaar zodra de vertrouwde staging-URL is ingesteld.</small>}</label>;
}

export function PostForMeIntegrationSettings({onAvailable}: {onAvailable?: (available: boolean) => void}) {
  const [data, setData] = useState<PostForMeIntegration | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [projectId, setProjectId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const alive = useRef(true);
  async function load() {
    const result = await api<{integration: PostForMeIntegration}>(endpoint);
    if (!alive.current) return;
    setData(result.integration); setEnabled(result.integration.enabled); setProjectId(result.integration.projectId || ''); onAvailable?.(result.integration.available);
  }
  useEffect(() => {
    alive.current = true;
    void load().catch(failure => {if (alive.current) setError((failure as Error).message);});
    return () => {alive.current = false;};
  }, []);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {await action();} catch (failure) {if (alive.current) setError((failure as Error).message);}
    finally {if (alive.current) setBusy(false);}
  }
  function accept(integration: PostForMeIntegration) {
    if (!alive.current) return;
    setData(integration); setEnabled(integration.enabled); setProjectId(integration.projectId || '');
    window.dispatchEvent(new Event('castiq:integrations-changed'));
  }
  async function save() {
    if (!data) return;
    const result = await api<{integration: PostForMeIntegration}>(endpoint, {method: 'PUT', body: JSON.stringify({expectedVersion: data.version, enabled: apiKey.trim() ? false : enabled, projectId: projectId.trim(), ...(apiKey.trim() ? {apiKey: apiKey.trim()} : {})})});
    accept(result.integration); setApiKey(''); setNotice('De staginginstellingen zijn beveiligd opgeslagen.');
  }
  async function action(path: 'test' | 'webhook') {
    if (!data) return;
    const result = await api<{integration: PostForMeIntegration}>(`${endpoint}/${path}`, {method: 'POST', body: JSON.stringify({expectedVersion: data.version})});
    accept(result.integration);
    setNotice(path === 'test' ? 'De API-test is afgerond. Bekijk de verbindingsstatus hieronder.' : 'De webhookinstellingen zijn gecontroleerd. Een bestaande registratie is behouden.');
  }
  async function copy(label: string, value: string) {
    setError('');
    try {await navigator.clipboard.writeText(value); setNotice(`${label} gekopieerd.`);}
    catch {setNotice('Selecteer het adres in het veld en kopieer het met je browser.');}
  }
  if (data && !data.available) return null;
  return <article className="card integration-card post-for-me-settings" aria-labelledby="post-for-me-title">
    <header className="section-heading"><div><span className="eyebrow">STAGING · FACEBOOK EN INSTAGRAM</span><h2 id="post-for-me-title">Post for Me</h2></div><span className="integration-secret-status"><ShieldCheck size={16}/>{data?.configured ? 'Ingesteld' : 'Niet ingesteld'}</span></header>
    <p>Eén Castiq-stagingproject verzorgt de aansluiting. Verenigingen koppelen daarna zelf hun clubpagina of professionele Instagramaccount. Op het toestemmingsscherm zien zij de naam <strong>Post for Me</strong>.</p>
    {error && <p role="alert" className="ed-inline-error">{error}</p>}{notice && <p role="status" className="integration-notice">{notice}</p>}
    {!data ? !error && <p role="status">Staginginstellingen laden…</p> : <>
      <dl className="integration-status-grid"><ConnectionStatus title="API-verbinding" value={data.apiTest} kind="api"/><ConnectionStatus title="Webhook" value={data.webhook} kind="webhook"/><div><dt>Functionaliteit</dt><dd><strong>{data.enabled ? 'Ingeschakeld' : 'Uitgeschakeld'}</strong><small>Alleen Facebook en Instagram op staging</small></dd></div></dl>
      <form className="integration-form" onSubmit={event => {event.preventDefault(); void run(save);}}>
        {!data.secureStorageConfigured && <p role="alert" className="ed-inline-error">De beveiligde stagingopslag moet eerst worden ingericht. Je kunt nog geen API-sleutel bewaren.</p>}
        <label className="field">Stagingproject-ID<input aria-label="Stagingproject-ID" type="text" autoComplete="off" maxLength={200} value={projectId} placeholder="Project-ID uit het Post for Me-dashboard" onChange={event => {setProjectId(event.target.value); if (event.target.value.trim() !== data.projectId) setEnabled(false);}}/><small>Gebruik het aparte Castiq Staging-project met Quickstart. Dit ID is geen API-sleutel.</small></label>
        <label className="field">API-sleutel stagingproject<input type="password" autoComplete="new-password" maxLength={4096} value={apiKey} required={!data.configured} placeholder={data.configured ? 'Leeg laten om de opgeslagen sleutel te behouden' : 'API-sleutel van het Post for Me-stagingproject'} onChange={event => {setApiKey(event.target.value); if (event.target.value.trim()) setEnabled(false);}}/></label>
        <label className="checkbox-line"><input type="checkbox" checked={enabled} disabled={busy || data.apiTest.status !== 'success' || Boolean(apiKey.trim()) || !projectId.trim() || projectId.trim() !== data.projectId || !data.redirectUrl} onChange={event => setEnabled(event.target.checked)}/>Post for Me inschakelen voor koppelen en publiceren op staging</label>
        {data.apiTest.status !== 'success' && <p className="muted">Bewaar de sleutel en test de API-verbinding. Na een geslaagde test kun je de functionaliteit inschakelen.</p>}
        <p className="muted"><KeyRound size={15}/> De opgeslagen sleutel wordt nooit teruggestuurd. Een nieuwe sleutel moet opnieuw worden getest.</p>
        <div className="integration-action-row"><button type="submit" className="btn btn-primary" disabled={busy || !data.secureStorageConfigured}><Save size={16}/>{busy ? 'Bezig…' : 'Post for Me-instellingen bewaren'}</button><button type="button" className="btn btn-secondary" disabled={busy || !data.configured || Boolean(apiKey.trim())} onClick={() => void run(() => action('test'))}><RefreshCw size={16}/>Test API-verbinding</button></div>
      </form>
      <section className="integration-project-urls" aria-label="Post for Me-project instellen"><h3>Project in Post for Me</h3><TrustedUrl label="Project Redirect URL" value={data.redirectUrl} onCopy={copy}/><p>Post for Me-dashboard → Castiq Staging-project → Project Redirect URL → plak dit adres exact → <strong>Update</strong>. Quickstart gebruikt dit vaste adres. Een groene providerstatus in Post for Me koppelt nog geen clubaccount.</p><TrustedUrl label="Webhook URL" value={data.webhookUrl} onCopy={copy}/><button type="button" className="btn btn-secondary" disabled={busy || !data.configured || Boolean(apiKey.trim()) || !data.webhookUrl} onClick={() => void run(() => action('webhook'))}><Webhook size={16}/>{data.webhook.status === 'registered' || data.webhook.status === 'active' ? 'Webhook controleren' : 'Webhook registreren'}</button><p className="muted"><Check size={15}/> De webhook heeft een eigen geheim. Registreren staat los van het testen van de API-sleutel.</p></section>
    </>}
  </article>;
}
