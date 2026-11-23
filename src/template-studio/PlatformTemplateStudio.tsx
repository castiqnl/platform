import React, { useEffect, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LayoutTemplate, Pencil, Plus, Search, Settings2, Star } from 'lucide-react';
import { PosterSvg } from '../Poster';
import { templateCatalog } from '../templateCatalog';
import { Empty, Modal, PageTitle } from '../ui';
import { useCastiq } from '../store';
import {api} from '../serverClient';
import {fetchPrivateImage} from '../authClient';
import { mountTemplateStudio } from './studio-view.mjs';
import { createCentralTemplateStudio } from './centralTemplates';
import {
  CLUBS, managedPostTypes as POST_TYPES, managedTemplates, previewFields, previewPhoto, previewPrimary, repoFormats,
  repoPostTypes, sourceLayouts, toPosterLayers, type CanvasLayer, type ManagedPostType, type ManagedTemplate, type StudioRatio,
} from './managedTemplates';
import './studio.css';
import './platform-template-studio.css';

let artworkId = 0;
const dateText = (time: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(time));

function renderRepoArtwork(element: HTMLElement, options: { template: ManagedTemplate; layers: CanvasLayer[]; format: StudioRatio; fields: Record<string, string>; club?: { id: string } }) {
  const { template, layers, format, fields, club } = options;
  if (!template.family) return false;
  const markup = renderToStaticMarkup(<PosterSvg
    layers={toPosterLayers(layers, format, previewFields(fields))}
    contentType={repoPostTypes[template.postType]} format={repoFormats[format]} partnerLogo
    family={template.family} primary={previewPrimary(club?.id)} secondary="#ffffff"
  />, { identifierPrefix: `canvas-${++artworkId}-` });
  element.innerHTML=markup.replace(/href="(\/api\/template-media\/[^"]+)"/g,'href="" data-private-template-media="$1"');
  return new Set(layers.map(layer => layer.id));
}

function Artwork({ template }: { template: ManagedTemplate }) {
  const definition = templateCatalog.find(item => item.name === template.family);
  if (!definition) return <span className="pts-fallback-art"><LayoutTemplate size={23}/></span>;
  const { atlas } = definition;
  const column = definition.cell % 3;
  const row = Math.floor(definition.cell / 3);
  return <span className="pts-thumb" aria-hidden="true" style={{
    backgroundImage: `url(/assets/template-atlas-${atlas}${atlas === 3 ? '-v2' : ''}.png)`, backgroundPosition: `${column * 50}% ${row * 50}%`,
  }}/>;
}

function Editor({ id, onBack, model }: { id: string; onBack: () => void; model: any }) {
  const host = useRef<HTMLDivElement>(null),{mode,actor}=useCastiq();
  const [error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(() => {
    const controller=new AbortController(),cache=new Map<string,Promise<string>>(),allocated:string[]=[];
    function render(element:HTMLElement,options:any){
      const result=renderRepoArtwork(element,options);
      for(const node of element.querySelectorAll<SVGImageElement>('[data-private-template-media]')){
        const source=node.getAttribute('data-private-template-media');
        if(!cache.has(source))cache.set(source,fetchPrivateImage(source,controller.signal,actor?.clubId).then(blob=>{if(controller.signal.aborted)return '';const url=URL.createObjectURL(blob);allocated.push(url);return url;}));
        void cache.get(source).then(url=>{if(!controller.signal.aborted&&node.isConnected)node.setAttribute('href',url);}).catch(failure=>{if(!controller.signal.aborted)setError(failure.message);});
      }
      return result;
    }
    const unmount=mountTemplateStudio(host.current, {
      model, templateId: id, onBack, backgroundUrl: previewPhoto, renderArtwork: render,
      uploadImage:mode==='server'?async(file:File)=>{
        if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024)throw new Error('Kies een JPG, PNG of WebP-afbeelding van maximaal 8 MB.');
        return api<{url:string}>('/api/admin/template-media',{method:'POST',body:file,headers:{'Content-Type':file.type}});
      }:undefined,
    });
    return ()=>{controller.abort();allocated.forEach(url=>URL.revokeObjectURL(url));unmount();};
  }, [id, onBack, model,mode,actor?.id,actor?.clubId,retry]);
  return <>{error&&<p role="alert" className="local-access-error">{error} <button className="btn btn-secondary" onClick={()=>{setError('');setRetry(value=>value+1);}}>Afbeeldingen opnieuw laden</button></p>}<div ref={host}/></>;
}

function AudienceSettings({ template, close, onSaved, model, clubOptions }: { template: ManagedTemplate; close: () => void; onSaved: () => void; model: any; clubOptions: {id: string; name: string}[] }) {
  const [name, setName] = useState(template.name);
  const [audience, setAudience] = useState(template.audience);
  const [clubs, setClubs] = useState(template.clubIds);
  const [defaultFor, setDefault] = useState(template.defaultFor);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <Modal title="Template-instellingen" onClose={close}>
    <form onSubmit={async event => {
      event.preventDefault();
      setBusy(true); setError('');
      try {
        await model.configureTemplate(template.id, { name, audience, clubIds: clubs, defaultFor });
        if (model.load) await model.load();
        onSaved();
      } catch (failure) { setError((failure as Error).message); } finally {setBusy(false);}
    }}>
      <label className="field">Templatenaam<input value={name} onChange={event => setName(event.target.value)} maxLength={90} required/></label>
      <label className="field">Beschikbaar voor<select value={audience} onChange={event => setAudience(event.target.value as ManagedTemplate['audience'])}>
        <option value="all">Alle verenigingen</option><option value="selected">Geselecteerde verenigingen</option>
      </select></label>
      {audience === 'selected' && <fieldset className="pts-clubs"><legend>Verenigingen</legend>{clubOptions.map(club => <label className="checkbox-line" key={club.id}>
        <input type="checkbox" checked={clubs.includes(club.id)} onChange={event => setClubs(list => event.target.checked ? [...list, club.id] : list.filter(id => id !== club.id))}/>{club.name}
      </label>)}</fieldset>}
      <label className="checkbox-line pts-default"><input type="checkbox" checked={defaultFor} disabled={!template.publishedVersion} onChange={event => setDefault(event.target.checked)}/> Standaard voor {POST_TYPES[template.postType].toLowerCase()}</label>
      {error && <p role="alert" className="local-access-error">{error}</p>}
      <div className="modal-actions"><button className="btn btn-secondary" type="button" disabled={busy} onClick={close}>Annuleren</button><button className="btn btn-primary" disabled={busy} type="submit">{busy?'Opslaan…':'Instellingen opslaan'}</button></div>
    </form>
  </Modal>;
}

function NewTemplate({ close, onCreate, model }: { close: () => void; onCreate: (id: string) => void; model: any }) {
  const [name, setName] = useState('');
  const [postType, setPostType] = useState<ManagedPostType>('result');
  const [description, setDescription] = useState('');
  const [family, setFamily] = useState(templateCatalog[0].name);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <Modal title="Nieuw template" onClose={close}>
    <form onSubmit={async event => {
      event.preventDefault();
      setBusy(true); setError('');
      try { onCreate((await model.createTemplate({ name, postType, description, family, layouts: sourceLayouts(family, postType) })).id); }
      catch (failure) { setError((failure as Error).message); } finally {setBusy(false);}
    }}>
      <label className="field">Templatenaam<input autoFocus value={name} onChange={event => setName(event.target.value)} maxLength={90} required/></label>
      <label className="field">Posttype<select value={postType} onChange={event => setPostType(event.target.value as ManagedPostType)}>{Object.entries(POST_TYPES).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
      <label className="field">Basisstijl<select value={family} onChange={event => setFamily(event.target.value)}>{templateCatalog.map(item => <option key={item.id}>{item.name}</option>)}</select></label>
      <label className="field">Omschrijving<textarea value={description} onChange={event => setDescription(event.target.value)} rows={3} maxLength={280}/></label>
      {error && <p role="alert" className="local-access-error">{error}</p>}
      <div className="modal-actions"><button className="btn btn-secondary" type="button" disabled={busy} onClick={close}>Annuleren</button><button className="btn btn-primary" disabled={busy} type="submit">{busy?'Opslaan…':'Canvas openen'}</button></div>
    </form>
  </Modal>;
}

export default function PlatformTemplateStudio() {
  const { toast, mode } = useCastiq();
  const [model] = useState<any>(() => mode === 'server' ? createCentralTemplateStudio() : managedTemplates);
  const [templates, setTemplates] = useState<ManagedTemplate[]>(() => model.state.templates);
  const [loaded, setLoaded] = useState(mode !== 'server');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [settings, setSettings] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const backToLibrary = React.useCallback(() => setEditing(null), []);
  useEffect(() => {
    let active = true;
    const unsubscribe = model.subscribe(({ action }) => {if (!['add-layer','update-layer','remove-layer','reorder-layer'].includes(action) && active) setTemplates(model.state.templates);});
    if (mode === 'server') void model.load().then(() => {if (active) setLoaded(true);}).catch(failure => {if (active) setError(failure.message);});
    return () => {active = false; unsubscribe();};
  }, [model, mode]);

  const visible = templates.filter(template => (type === 'all' || template.postType === type) &&
    (status === 'all' || (status === 'draft' ? !!template.draft : status === 'active' ? template.enabled : !template.enabled)) &&
    `${template.name} ${template.description}`.toLocaleLowerCase('nl').includes(query.trim().toLocaleLowerCase('nl')));
  const settingsTemplate = templates.find(template => template.id === settings);

  if (!loaded) return <section><PageTitle title="Template Studio" description="De centrale bibliotheek wordt gecontroleerd."/>{error ? <div className="local-access-error" role="alert">{error}<button className="btn btn-secondary" onClick={() => {setError('');void model.load().then(()=>setLoaded(true)).catch(failure=>setError(failure.message));}}>Opnieuw laden</button></div> : <p role="status">Centrale templates laden…</p>}</section>;
  if (editing) return <Editor id={editing} onBack={backToLibrary} model={model}/>;
  return <section className="pts-library">
    <PageTitle title="Template Studio" description="Beheer clubtemplates en hun vaste Castiq-partnerlaag." actions={<button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={17}/> Nieuw template</button>}/>
    {error && <p className="local-access-error" role="alert">{error}</p>}
    <p className="muted">{mode==='server'?'Concepten en gepubliceerde versies worden centraal opgeslagen.':'Demobibliotheek · opgeslagen op dit apparaat.'}</p>
    <div className="pts-table card">
      <div className="pts-filters">
        <label className="search-field"><Search size={17}/><input aria-label="Zoek templates" placeholder="Zoek op templatenaam…" value={query} onChange={event => setQuery(event.target.value)}/></label>
        <select aria-label="Filter op posttype" value={type} onChange={event => setType(event.target.value)}><option value="all">Alle posttypes</option>{Object.entries(POST_TYPES).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select>
        <select aria-label="Filter op status" value={status} onChange={event => setStatus(event.target.value)}><option value="all">Alle statussen</option><option value="active">Actief</option><option value="inactive">Uitgeschakeld</option><option value="draft">Met concept</option></select>
        <span className="pts-count">{visible.length} {visible.length === 1 ? 'template' : 'templates'}</span>
      </div>
      {visible.length > 0 ? <>
        <div className="pts-table-head" aria-hidden="true"><span>Template</span><span>Posttype</span><span>Beschikbaar voor</span><span>Versie</span><span>Actief</span><span>Acties</span></div>
        <ul className="pts-list" aria-label="Ontwerptemplates">
          {visible.map(template => {
            const published = template.versions.find(version => version.number === template.publishedVersion);
            return <li className="pts-row" key={template.id}>
              <button type="button" className="pts-template-name" onClick={() => setEditing(template.id)}><Artwork template={template}/><span><strong>{template.name}</strong><small>{template.defaultFor && <><Star size={12}/> Standaard · </>}{template.id.startsWith('familie-') ? 'Standaardstijl' : 'Eigen ontwerp'}</small></span></button>
              <span className="pts-type">{POST_TYPES[template.postType]}</span>
              <span className="pts-audience">{template.audience === 'all' ? 'Alle verenigingen' : `${template.clubIds.length} geselecteerd`}</span>
              <span className="pts-version"><b>{published ? `v${published.number}` : 'Concept'}</b>{published && <small>{template.draft ? 'Concept klaar' : dateText(published.publishedAt)}</small>}</span>
              <button className="pts-switch" type="button" role="switch" aria-checked={template.enabled} aria-label={`${template.name} actief`} title={published ? template.enabled ? 'Uitschakelen' : 'Inschakelen' : 'Publiceer eerst een versie'} disabled={!published||busy} onClick={async () => {
                setBusy(true); setError('');
                try { await model.setEnabled(template.id, !template.enabled); toast(template.enabled ? 'Template uitgeschakeld voor nieuwe bijdragen.' : 'Template beschikbaar voor nieuwe bijdragen.'); }
                catch (error) { setError((error as Error).message); } finally {setBusy(false);}
              }}><span/></button>
              <span className="pts-actions"><button className="icon-btn" aria-label={`Instellingen ${template.name}`} title="Instellingen" onClick={() => setSettings(template.id)}><Settings2 size={17}/></button><button className="icon-btn" aria-label={`Bewerk ${template.name}`} title="Open canvas" onClick={() => setEditing(template.id)}><Pencil size={17}/></button></span>
            </li>;
          })}
        </ul>
      </> : <Empty title="Geen templates gevonden" description="Pas je zoekopdracht of filters aan."/>}
    </div>
    {settingsTemplate && <AudienceSettings model={model} clubOptions={mode==='server'?model.getClubs():CLUBS} template={settingsTemplate} close={() => setSettings(null)} onSaved={() => { setSettings(null); toast('Template-instellingen opgeslagen.'); }}/>}
    {creating && <NewTemplate model={model} close={() => setCreating(false)} onCreate={id => { setCreating(false); setEditing(id); }}/>}
  </section>;
}
