import {readFileSync} from 'node:fs';
import {createHash, randomUUID} from 'node:crypto';
import type pg from 'pg';
import type {Actor} from './fixtures.ts';
import {ApiError} from './workflow.ts';
import {FORMATS, BINDINGS, withCastiqPartnerLayer, CASTIQ_PARTNER_LAYER_ID, LAYER_EFFECT_DEFAULTS} from '../src/template-studio/studio-model.mjs';

type Database = Pick<pg.PoolClient, 'query'>;
export type TemplateLayouts = Record<string, any[]>;
const seeds: any[] = JSON.parse(readFileSync(new URL('../src/template-studio/builtin-templates.json', import.meta.url), 'utf8'));
const formats = Object.keys(FORMATS), postTypes = ['match', 'result', 'news', 'lineup'];
const families = new Set(seeds.map(item => item.family));
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const invalid = (message: string) => {throw new ApiError(400, message, 'invalid_template');};
const platform = (actor: Actor) => {if (actor.role !== 'platform') throw new ApiError(403, 'Alleen platformbeheer kan de centrale templates beheren.', 'forbidden');};
const label = (value: unknown, max = 90) => {if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f<>]/.test(value)) invalid('Vul een geldige templatenaam in.'); return (value as string).trim();};
const text = (value: unknown, max = 2000) => {if (typeof value !== 'string' || value.length > max || /[\u0000\u000b\u000c]/.test(value)) invalid('Ongeldige templatetekst.'); return value as string;};
const number = (value: unknown, min: number, max: number, fallback: number) => {const result = value === undefined ? fallback : value; if (typeof result !== 'number' || !Number.isFinite(result) || result < min || result > max) invalid('Een laagwaarde valt buiten de toegestane grenzen.'); return result as number;};
const boolean = (value: unknown, fallback: boolean) => {if (value === undefined) return fallback; if (typeof value !== 'boolean') invalid('Kies een geldige aan/uit-waarde.'); return value as boolean;};
const colour = (value: unknown, fallback = '#ffffff') => {const result = value === undefined ? fallback : value; if (typeof result !== 'string' || !/^#(?:[a-f0-9]{3,4}|[a-f0-9]{6}|[a-f0-9]{8})$/i.test(result)) invalid('Gebruik een geldige hexkleur.'); return result as string;};
function picture(value: string) {
  if (!value || /^\/assets\/[a-zA-Z0-9_.-]+$/.test(value)) return value;
  let url: URL; try {url = new URL(value);} catch {invalid('Gebruik een openbare HTTPS-afbeelding of een meegeleverde asset.');}
  if (url!.protocol !== 'https:' || url!.username || url!.password || url!.hash || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url!.hostname) || /(?:^|\.)(?:localhost|local|internal)$/i.test(url!.hostname) || value.length > 2000) invalid('Gebruik een openbare HTTPS-afbeelding zonder inloggegevens.');
  return value;
}

/** Strict server boundary; partner geometry is reconstructed, never trusted. */
export function normalizeTemplateLayouts(input: unknown): TemplateLayouts {
  if (!input || typeof input !== 'object' || Array.isArray(input) || JSON.stringify(input).length > 500000) invalid('De vier templateformaten ontbreken of zijn te groot.');
  if (Object.keys(input).some(key => !formats.includes(key)) || formats.some(key => !Array.isArray(input[key]) || input[key].length > 100)) invalid('Lever precies de vier formaten met maximaal 100 lagen per formaat aan.');
  const layouts: TemplateLayouts = {};
  const allowed = new Set(['id','name','type','binding','text','x','y','width','height','rotation','fontSize','fontWeight','align','color','opacity','locked','visible','clubEditable','shape','fit','radius','groupId','groupName','required','nativeKind','nativeFont','nativeTracking','nativeOutline', ...Object.keys(LAYER_EFFECT_DEFAULTS)]);
  for (const format of formats) {
    const dimensions = FORMATS[format], seen = new Set<string>();
    const layers = input[format].filter((layer: any) => layer?.id !== CASTIQ_PARTNER_LAYER_ID).map((layer: any) => {
      if (!layer || typeof layer !== 'object' || Array.isArray(layer) || Object.keys(layer).some(key => !allowed.has(key))) invalid('Onbekend laagveld of ongeldige laag.');
      if (typeof layer.id !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(layer.id) || seen.has(layer.id)) invalid('Laag-ID’s moeten uniek zijn.');
      seen.add(layer.id);
      if (!['text','image','shape'].includes(layer.type)) invalid('Kies een geldig laagtype.');
      if (layer.binding != null && !Object.hasOwn(BINDINGS, layer.binding)) invalid('Onbekende gegevensbron.');
      if (layer.align !== undefined && !['left','center','right'].includes(layer.align)) invalid('Onbekende tekstuitlijning.');
      if (layer.shape !== undefined && !['rect','circle'].includes(layer.shape)) invalid('Onbekende vorm.');
      if (layer.fit !== undefined && !['cover','contain'].includes(layer.fit)) invalid('Onbekende afbeeldingspassing.');
      const nativeKinds = {text: ['text','sponsor'], image: ['photo','crest'], shape: ['rule']};
      if (layer.nativeKind !== undefined && !nativeKinds[layer.type].includes(layer.nativeKind)) invalid('Laagtype en renderer komen niet overeen.');
      const result: any = {
        id: layer.id, name: label(layer.name), type: layer.type, binding: layer.binding || null,
        text: layer.type === 'image' ? picture(text(layer.text ?? '')) : text(layer.text ?? ''),
        x: number(layer.x, -2 * dimensions.width, 2 * dimensions.width, 0), y: number(layer.y, -2 * dimensions.height, 2 * dimensions.height, 0),
        width: number(layer.width, 1, 2 * dimensions.width, 100), height: number(layer.height, 1, 2 * dimensions.height, 100),
        rotation: number(layer.rotation, -360, 360, 0), fontSize: number(layer.fontSize, layer.type==='text'?8:0.1, 384, 54), fontWeight: number(layer.fontWeight, 100, 900, 700),
        align: layer.align || 'left', color: colour(layer.color), opacity: number(layer.opacity, 0, 1, 1),
        locked: boolean(layer.locked, false), visible: boolean(layer.visible, true), clubEditable: boolean(layer.clubEditable, false),
        shape: layer.shape || 'rect', fit: layer.fit || 'contain', radius: number(layer.radius, 0, 540, 0),
      };
      for (const key of ['outlineEnabled','shadowEnabled','nativeOutline']) if (layer[key] !== undefined) result[key] = boolean(layer[key], false);
      for (const key of ['outlineColor','shadowColor']) if (layer[key] !== undefined) result[key] = colour(layer[key]);
      for (const [key, min, max] of [['outlineWidth',0,40],['shadowOpacity',0,1],['shadowOffsetX',-200,200],['shadowOffsetY',-200,200],['shadowBlur',0,120],['nativeTracking',-20,20]] as [string,number,number][]) if (layer[key] !== undefined) result[key] = number(layer[key], min, max, 0);
      if (layer.nativeKind !== undefined) result.nativeKind = layer.nativeKind;
      if (layer.nativeFont !== undefined) result.nativeFont = text(layer.nativeFont, 180);
      if (layer.groupId !== undefined) {if (typeof layer.groupId !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(layer.groupId)) invalid('Ongeldige laag-groep.'); result.groupId = layer.groupId; result.groupName = label(layer.groupName);}
      return result;
    });
    const groups = new Map<string,string>();
    for (const layer of layers) if (layer.groupId) {if (groups.has(layer.groupId) && groups.get(layer.groupId) !== layer.groupName) invalid('Groepsnamen moeten overeenkomen.'); groups.set(layer.groupId, layer.groupName);}
    layouts[format] = withCastiqPartnerLayer(layers, format);
  }
  if (Buffer.byteLength(JSON.stringify(layouts)) > 500000) invalid('Het template is groter dan 500 KB.');
  return layouts;
}

const initializations = new WeakMap<object,Promise<void>>();
export function initializeTemplateLibrary(pool: pg.Pool): Promise<void> {
  let work = initializations.get(pool);
  if (!work) {
    work = (async () => {const db = await pool.connect(); try {
      await db.query('BEGIN'); await db.query("SELECT pg_advisory_xact_lock(hashtext('castiq-template-library'))");
      for (const seed of seeds) {
        const inserted = await db.query('INSERT INTO castiq.templates(id,name,description,family,post_type,enabled,published_version) VALUES($1,$2,$3,$4,$5,true,1) ON CONFLICT(id) DO NOTHING RETURNING id',[seed.id,seed.name,seed.description,seed.family,seed.postType]);
        if (!inserted.rowCount) continue;
        const layouts = normalizeTemplateLayouts(seed.versions[0].layouts);
        await db.query('INSERT INTO castiq.template_versions(template_id,number,layouts,content_sha256,actor_id) VALUES($1,1,$2,$3,$4)',[seed.id,JSON.stringify(layouts),digest(layouts),'builtin-initialization']);
        await audit(db,seed.id,'builtin-initialization','initialized',1,{sha256:digest(layouts)});
      }
      await db.query('COMMIT');
    } catch (error) {await db.query('ROLLBACK'); throw error;} finally {db.release();}})();
    initializations.set(pool,work); work.catch(() => initializations.delete(pool));
  }
  return work;
}
async function audit(db: Database, id: string, actor: string, action: string, revision: number, metadata: unknown = {}) {await db.query('INSERT INTO castiq.template_audit(id,template_id,actor_id,action,revision,metadata) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),id,actor,action,revision,JSON.stringify(metadata)]);}
async function readTemplates(db: Database, clubId?: string) {
  const rows = await db.query(`SELECT t.*,COALESCE((SELECT jsonb_agg(a.club_id ORDER BY a.club_id) FROM castiq.template_assignments a WHERE a.template_id=t.id),'[]'::jsonb) AS club_ids,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('number',v.number,'publishedAt',v.published_at,'sha256',v.content_sha256,'layouts',v.layouts) ORDER BY v.number) FROM castiq.template_versions v WHERE v.template_id=t.id ${clubId ? 'AND v.number=t.published_version' : ''}),'[]'::jsonb) AS versions
    FROM castiq.templates t ${clubId ? "WHERE t.enabled AND t.published_version IS NOT NULL AND (t.audience='all' OR EXISTS(SELECT 1 FROM castiq.template_assignments a WHERE a.template_id=t.id AND a.club_id=$1))" : ''} ORDER BY t.created_at,t.id`,clubId?[clubId]:[]);
  return rows.rows.map(row => ({id:row.id,name:row.name,description:row.description,family:row.family,postType:row.post_type,revision:row.revision,enabled:row.enabled,audience:row.audience,clubIds:clubId?[]:row.club_ids,defaultFor:row.is_default,publishedVersion:row.published_version,versions:row.versions,draft:!clubId&&row.draft_layouts?{layouts:row.draft_layouts,savedAt:row.draft_saved_at,basedOnVersion:row.draft_based_on}:null}));
}

export function createTemplateLibrary(pool: pg.Pool) {
  async function list(actor: Actor) {platform(actor); await initializeTemplateLibrary(pool); const clubs = await pool.query("SELECT club_id AS id,state->'club'->>'name' AS name FROM castiq.workspaces WHERE club_id<>'__platform__' ORDER BY club_id"); return {templates:await readTemplates(pool),clubs:clubs.rows};}
  async function available(actor: Actor) {if (!['club','team'].includes(actor.role)) throw new ApiError(403,'Open een bevoegde clubomgeving.','forbidden'); await initializeTemplateLibrary(pool); return {templates:await readTemplates(pool,actor.clubId)};}
  async function create(actor: Actor,input: any) {
    platform(actor); await initializeTemplateLibrary(pool);
    if (!postTypes.includes(input.postType)||!families.has(input.family)) invalid('Kies een bekend posttype en een bestaande basisstijl.');
    const name=label(input.name),description=text(input.description||'',280),layouts=normalizeTemplateLayouts(input.layouts||seeds.find(seed=>seed.family===input.family).variants[input.postType]),id='template-'+randomUUID();
    const db=await pool.connect(); try {await db.query('BEGIN');await db.query("SELECT pg_advisory_xact_lock(hashtext('castiq-template-library'))");await db.query('INSERT INTO castiq.templates(id,name,description,family,post_type,draft_layouts,draft_saved_at) VALUES($1,$2,$3,$4,$5,$6,now())',[id,name,description,input.family,input.postType,JSON.stringify(layouts)]);await audit(db,id,actor.id,'created',1,{sha256:digest(layouts)});await db.query('COMMIT');}catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
    return {template:(await readTemplates(pool)).find(item=>item.id===id)};
  }
  async function mutate(actor: Actor,id: string,input: any) {
    platform(actor);await initializeTemplateLibrary(pool);
    const operations=['configure','availability','save-draft','publish','discard-draft','restore-version'];
    if(!operations.includes(input.operation)||!Number.isInteger(input.expectedRevision))invalid('Een bewerking en de actuele templaterevisie zijn verplicht.');
    const db=await pool.connect(); try {
      await db.query('BEGIN');await db.query("SELECT pg_advisory_xact_lock(hashtext('castiq-template-library'))");
      const row=(await db.query('SELECT * FROM castiq.templates WHERE id=$1 FOR UPDATE',[id])).rows[0];
      if(!row)throw new ApiError(404,'Het template bestaat niet.','not_found');
      if(row.revision!==input.expectedRevision)throw new ApiError(409,'Het template is elders gewijzigd. Herlaad de bibliotheek; je niet opgeslagen canvas blijft in deze pagina staan.','template_conflict');
      let changes:any={},metadata:any={};
      if(input.operation==='configure'){
        if(!['all','selected'].includes(input.audience)||!Array.isArray(input.clubIds)||input.clubIds.length>2000||typeof input.defaultFor!=='boolean')invalid('Kies een geldig bereik en een geldige standaardinstelling.');
        const clubIds=input.audience==='selected'?[...new Set(input.clubIds)]:[];
        if(clubIds.some(value=>typeof value!=='string'||value.length>120)||input.audience==='selected'&&!clubIds.length)invalid('Selecteer minimaal één bestaande vereniging.');
        if(clubIds.length){const found=await db.query("SELECT club_id FROM castiq.workspaces WHERE club_id=ANY($1::text[]) AND club_id<>'__platform__'",[clubIds]);if(found.rowCount!==clubIds.length)invalid('Een geselecteerde vereniging bestaat niet.');}
        if(input.defaultFor&&(!row.enabled||!row.published_version))invalid('Activeer eerst een gepubliceerde versie voordat je die standaard maakt.');
        if(input.defaultFor){const cleared=await db.query('UPDATE castiq.templates SET is_default=false,revision=revision+1,updated_at=now() WHERE post_type=$1 AND is_default AND id<>$2 RETURNING id,revision',[row.post_type,id]);for(const other of cleared.rows)await audit(db,other.id,actor.id,'default-replaced',other.revision,{replacementId:id});}
        changes={name:label(input.name),audience:input.audience,is_default:input.defaultFor};
        await db.query('DELETE FROM castiq.template_assignments WHERE template_id=$1',[id]);
        for(const clubId of clubIds)await db.query('INSERT INTO castiq.template_assignments(template_id,club_id) VALUES($1,$2)',[id,clubId]);
        metadata={clubIds,defaultFor:input.defaultFor};
      }else if(input.operation==='availability'){
        if(typeof input.enabled!=='boolean'||input.enabled&&!row.published_version)invalid('Publiceer eerst een versie voordat je het template activeert.');
        changes={enabled:input.enabled,is_default:input.enabled?row.is_default:false};
      }else if(input.operation==='save-draft'||input.operation==='publish'){
        const layouts=normalizeTemplateLayouts(input.layouts);
        if(input.operation==='save-draft')changes={draft_layouts:JSON.stringify(layouts),draft_saved_at:new Date().toISOString(),draft_based_on:row.draft_based_on??row.published_version};
        else {const last=(await db.query('SELECT COALESCE(max(number),0)::integer AS n FROM castiq.template_versions WHERE template_id=$1',[id])).rows[0].n;const number=last+1;await db.query('INSERT INTO castiq.template_versions(template_id,number,layouts,content_sha256,actor_id) VALUES($1,$2,$3,$4,$5)',[id,number,JSON.stringify(layouts),digest(layouts),actor.id]);changes={published_version:number,draft_layouts:null,draft_saved_at:null,draft_based_on:null};metadata={number,sha256:digest(layouts)};}
      }else if(input.operation==='discard-draft')changes={draft_layouts:null,draft_saved_at:null,draft_based_on:null};
      else {if(!Number.isInteger(input.number))invalid('Kies een bestaande versie.');const version=(await db.query('SELECT layouts FROM castiq.template_versions WHERE template_id=$1 AND number=$2',[id,input.number])).rows[0];if(!version)throw new ApiError(404,'De templateversie bestaat niet.','not_found');changes={draft_layouts:JSON.stringify(normalizeTemplateLayouts(version.layouts)),draft_saved_at:new Date().toISOString(),draft_based_on:input.number};metadata={number:input.number};}
      const keys=Object.keys(changes),values=Object.values(changes);await db.query(`UPDATE castiq.templates SET ${keys.map((key,index)=>`${key}=$${index+2}`).join(',')},revision=revision+1,updated_at=now() WHERE id=$1`,[id,...values]);
      await audit(db,id,actor.id,input.operation,row.revision+1,metadata);await db.query('COMMIT');
    }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
    return {template:(await readTemplates(pool)).find(item=>item.id===id)};
  }
  return {list,available,create,mutate};
}

export function managedPostType(type: string) {return type==='Opstelling'?'lineup':['Einduitslag','Ruststand','Toernooiresultaat'].includes(type)?'result':['Matchday','Aftrap','Afgelasting'].includes(type)?'match':'news';}
/** Call inside the workspace transaction. Existing snapshots are trusted only from storage. */
export async function stampContentTemplate(db: Database,actor: Actor,item: any,existing?: any) {
  if(!['club','team'].includes(actor.role))throw new ApiError(403,'Clubtoegang ontbreekt.','forbidden');
  const changedFamily=!!existing&&!!item.family&&item.family!==existing.family;
  const changedId=!!item.templateId&&item.templateId!==(existing?.templateId||existing?.templateSnapshot?.id);
  if(existing?.templateSnapshot&&!changedFamily&&!changedId)return {templateId:existing.templateSnapshot.id,templateSnapshot:structuredClone(existing.templateSnapshot)};
  if(existing&&!existing.templateSnapshot&&!item.templateId&&!changedFamily)return {};
  await db.query("SELECT pg_advisory_xact_lock_shared(hashtext('castiq-template-library'))");
  const postType=managedPostType(item.type),templates=await readTemplates(db,actor.clubId);
  const candidates=templates.filter(template=>template.postType===postType||template.id.startsWith('familie-'));
  const requestedId=changedFamily&&!changedId?undefined:item.templateId;
  const template=requestedId?candidates.find(value=>value.id===requestedId):item.family?candidates.find(value=>value.family===item.family):candidates.find(value=>value.defaultFor&&value.postType===postType)||candidates[0];
  if(!template&&existing&&!existing.templateSnapshot&&!requestedId)return {};
  if(!template)throw new ApiError(403,'Dit template is niet actief of niet aan deze vereniging toegewezen.','template_unavailable');
  const version=template.versions.find(value=>value.number===template.publishedVersion);
  const source=template.id.startsWith('familie-')&&template.postType!==postType?seeds.find(seed=>seed.id===template.id)?.variants[postType]:version.layouts;
  const layouts=normalizeTemplateLayouts(source);
  return {templateId:template.id,templateSnapshot:{id:template.id,name:template.name,family:template.family,postType,version:version.number,sha256:digest(layouts),layouts}};
}

export async function assertTemplateFamilyAvailable(db: Database,actor: Actor,family: string) {
  await db.query("SELECT pg_advisory_xact_lock_shared(hashtext('castiq-template-library'))");
  if(!(await readTemplates(db,actor.clubId)).some(template=>template.family===family))throw new ApiError(403,'Deze stijl is niet actief of niet aan deze vereniging toegewezen.','template_unavailable');
}
