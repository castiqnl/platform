import {randomUUID} from 'node:crypto';
import type pg from 'pg';
import type {Actor} from './fixtures.ts';
import {ApiError} from './workflow.ts';

type Database=Pick<pg.PoolClient,'query'>;
export type TemplateRequestInput={method:string;path:string;body?:any;query?:URLSearchParams};
export type TemplateRequestResult={status:number;body:any};
const statuses=['Nieuw','In behandeling','Gereed','Afgewezen'];
function requireRole(actor:Actor,role:'club'|'platform'){if(actor.role!==role)throw new ApiError(403,role==='club'?'Alleen clubbeheer kan maatwerk aanvragen.':'Alleen platformbeheer kan maatwerkaanvragen behandelen.','forbidden');}
function text(value:unknown,max:number,required=false){if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)||(required&&!value.trim()))throw new ApiError(400,'Vul de ontwerpaanvraag volledig in binnen de aangegeven tekstlimieten.','invalid_template_request');return value.trim();}
const conflict=()=>{throw new ApiError(409,'Deze aanvraag of het gekozen template is elders gewijzigd. Ververs de werkvoorraad en controleer de actuele versie.','template_request_conflict');};
async function audit(db:Database,id:string,actor:string,action:string,revision:number,metadata:unknown={}){await db.query('INSERT INTO castiq.template_request_events(id,request_id,actor_id,action,revision,metadata) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),id,actor,action,revision,JSON.stringify(metadata)]);}
async function read(db:Database,clubId?:string,id?:string){const result=await db.query(`SELECT r.*,w.state->'club'->>'name' AS club_name,t.name AS template_name,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('id',e.id,'action',e.action,'revision',e.revision,'metadata',e.metadata,'createdAt',e.created_at) ORDER BY e.created_at,e.id) FROM castiq.template_request_events e WHERE e.request_id=r.id),'[]'::jsonb) AS history
 FROM castiq.template_requests r JOIN castiq.workspaces w ON w.club_id=r.club_id LEFT JOIN castiq.templates t ON t.id=r.template_id
 WHERE ($1::text IS NULL OR r.club_id=$1) AND ($2::uuid IS NULL OR r.id=$2) ORDER BY r.created_at DESC,r.id`,[clubId||null,id||null]);return result.rows.map(row=>({id:row.id,clubId:row.club_id,clubName:row.club_name||row.club_id,title:row.title,brief:row.brief,status:row.status,revision:row.revision,templateId:row.template_id,templateName:row.template_name,reviewNote:row.review_note,createdAt:row.created_at,updatedAt:row.updated_at,history:row.history}));}
export async function handleTemplateRequestRoute(pool:pg.Pool,actor:Actor,input:TemplateRequestInput):Promise<TemplateRequestResult|null>{
 const clubRoute=input.path==='/api/template-requests',adminRoute=input.path==='/api/admin/template-requests',match=/^\/api\/admin\/template-requests\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/.exec(input.path);
 if(!clubRoute&&!adminRoute&&!match)return null;
 if(clubRoute)requireRole(actor,'club');else requireRole(actor,'platform');
 if(input.method==='GET'&&(clubRoute||adminRoute)){const clubId=clubRoute?actor.clubId:input.query?.get('clubId')||undefined;return {status:200,body:{requests:await read(pool,clubId)}};}
 if(clubRoute&&input.method==='POST'){
  const title=text(input.body?.title,70,true),brief=text(input.body?.brief,1500,true),id=randomUUID(),db=await pool.connect();
  try{await db.query('BEGIN');const workspace=await db.query('SELECT club_id FROM castiq.workspaces WHERE club_id=$1 FOR UPDATE',[actor.clubId]);if(!workspace.rowCount)throw new ApiError(404,'De clubomgeving bestaat niet.','not_found');
   const pending=(await db.query("SELECT count(*)::integer AS n FROM castiq.template_requests WHERE club_id=$1 AND status IN ('Nieuw','In behandeling')",[actor.clubId])).rows[0].n;if(pending>=25)throw new ApiError(409,'Er staan al 25 open aanvragen voor jouw vereniging. Rond eerst een bestaande aanvraag af.','template_request_limit');
   await db.query('INSERT INTO castiq.template_requests(id,club_id,title,brief,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$5)',[id,actor.clubId,title,brief,actor.id]);await audit(db,id,actor.id,'created',1,{status:'Nieuw'});await db.query('COMMIT');
  }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
  return {status:201,body:{request:(await read(pool,actor.clubId,id))[0]}};
 }
 if(match&&input.method==='PATCH'){
  const body=input.body;if(!body||!['status','assign'].includes(body.operation)||!Number.isInteger(body.expectedRevision))throw new ApiError(400,'Een geldige bewerking en actuele aanvraagrevisie zijn verplicht.','invalid_template_request');
  const reviewNote=body.reviewNote===undefined?undefined:text(body.reviewNote,1500),db=await pool.connect();
  try{await db.query('BEGIN');
   // Same lock and order as central-template changes; assignment and completion commit together.
   await db.query("SELECT pg_advisory_xact_lock(hashtext('castiq-template-library'))");
   const row=(await db.query('SELECT * FROM castiq.template_requests WHERE id=$1 FOR UPDATE',[match[1]])).rows[0];if(!row)throw new ApiError(404,'Deze aanvraag bestaat niet.','not_found');if(row.revision!==body.expectedRevision)conflict();
   let status=row.status,templateId=row.template_id,metadata:any={};
   if(body.operation==='status'){
    if(!statuses.includes(body.status)||body.status==='Gereed')throw new ApiError(400,'Kies Nieuw, In behandeling of Afgewezen. Rond af door een gepubliceerd clubtemplate toe te wijzen.','invalid_template_request');
    if(row.status==='Gereed')throw new ApiError(409,'Deze aanvraag is afgerond. Pas het toegewezen ontwerp aan in de centrale Template Studio.','template_request_completed');
    status=body.status;if(status==='Afgewezen'&&!(reviewNote??row.review_note).trim())throw new ApiError(400,'Geef een toelichting bij het afwijzen.','invalid_template_request');metadata={from:row.status,status};
   }else{
    if(row.status==='Afgewezen')throw new ApiError(409,'Heropen de aanvraag voordat je een clubtemplate toewijst.','template_request_rejected');
    if(typeof body.templateId!=='string'||!Number.isInteger(body.expectedTemplateRevision))throw new ApiError(400,'Kies een gepubliceerd centraal clubtemplate met actuele revisie.','invalid_template_request');
    const template=(await db.query('SELECT * FROM castiq.templates WHERE id=$1 FOR UPDATE',[body.templateId])).rows[0];if(!template)throw new ApiError(404,'Het gekozen template bestaat niet.','not_found');if(template.revision!==body.expectedTemplateRevision)conflict();
    if(template.id.startsWith('familie-')||!template.enabled||!template.published_version||template.is_default)throw new ApiError(400,'Kies een actief gepubliceerd maatwerktemplate. Standaardstijlen en algemene standaardtemplates kunnen niet als exclusief maatwerk worden toegewezen.','invalid_template_request');
    if(template.audience==='all'&&body.restrictToClub!==true)throw new ApiError(400,'Bevestig dat dit maatwerktemplate alleen voor geselecteerde verenigingen beschikbaar wordt.','template_audience_confirmation');
    await db.query("UPDATE castiq.templates SET audience='selected',revision=revision+1,updated_at=now() WHERE id=$1",[template.id]);
    await db.query('INSERT INTO castiq.template_assignments(template_id,club_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[template.id,row.club_id]);
    await db.query('INSERT INTO castiq.template_audit(id,template_id,actor_id,action,revision,metadata) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),template.id,actor.id,'request-assigned',template.revision+1,JSON.stringify({requestId:row.id,clubId:row.club_id,publishedVersion:template.published_version})]);
    status='Gereed';templateId=template.id;metadata={from:row.status,status,templateId,publishedVersion:template.published_version};
   }
   await db.query('UPDATE castiq.template_requests SET status=$2,template_id=$3,review_note=$4,updated_by=$5,reviewed_by=$5,revision=revision+1,updated_at=now() WHERE id=$1',[row.id,status,templateId,reviewNote??row.review_note,actor.id]);await audit(db,row.id,actor.id,body.operation==='assign'?'assigned':'status-changed',row.revision+1,metadata);await db.query('COMMIT');
  }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
  return {status:200,body:{request:(await read(pool,undefined,match[1]))[0]}};
 }
 return null;
}
/** Must run inside the personal erasure transaction; free text authored by the erased account is removed. */
export async function pseudonymizeTemplateRequestActor(db:Database,actorId:string,pseudonym:string){
 if(!/^erased:[a-f0-9]{64}$/.test(pseudonym))throw new Error('Invalid erasure reference');
 await db.query("SELECT set_config('castiq.privacy_erasure','on',true)");
 await db.query(`UPDATE castiq.template_requests SET
 title=CASE WHEN created_by=$1 THEN 'Verwijderde aanvraag' ELSE title END,
 brief=CASE WHEN created_by=$1 THEN '' ELSE brief END,
 review_note=CASE WHEN reviewed_by=$1 THEN '' ELSE review_note END,
 created_by=CASE WHEN created_by=$1 THEN $2 ELSE created_by END,
 updated_by=CASE WHEN updated_by=$1 THEN $2 ELSE updated_by END,
 reviewed_by=CASE WHEN reviewed_by=$1 THEN $2 ELSE reviewed_by END,
 revision=revision+1,updated_at=now() WHERE created_by=$1 OR updated_by=$1 OR reviewed_by=$1`,[actorId,pseudonym]);
 await db.query('UPDATE castiq.template_request_events SET actor_id=$2 WHERE actor_id=$1',[actorId,pseudonym]);
}
