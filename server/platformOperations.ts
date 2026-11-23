import type pg from 'pg';
import type {Actor} from './fixtures.ts';
import {ApiError} from './workflow.ts';
import {initializeTemplateLibrary} from './templateLibrary.ts';
import {emptyJobCounts,type JobGroup,type JobOperations,type OperationsData,type OperationsSource,type PlatformOperations} from '../src/platformOperationsTypes.ts';

const jobLimit=200;
const channels=['Instagram Story','Facebook Story','Instagram-feed','Facebook-feed','X-post'];
const statuses=['queued','scheduled','processing','running','awaiting_confirmation','failed','published','paused','cancelled'];
const confirmed="r.job_id IS NOT NULL AND r.provider_post_id<>'' AND (r.kind=j.provider_mode OR (r.kind='provider' AND j.provider_mode='live'))";
const grouped=`CASE WHEN j.status='published' THEN CASE WHEN ${confirmed} THEN 'published' ELSE 'awaiting_confirmation' END WHEN j.status IN ('queued','scheduled','processing','running') THEN 'in_progress' WHEN j.status IN ('failed','awaiting_confirmation','paused','cancelled') THEN j.status ELSE 'other' END`;
const iso=(value:unknown)=>value instanceof Date?value.toISOString():typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
const number=(value:unknown)=>Math.max(0,Number(value)||0);
async function source<T>(read:()=>Promise<T>):Promise<OperationsSource<T>>{
  try{return {status:'ok',data:await read()};}catch{return {status:'unavailable'};}
}
async function jobs(pool:pg.Pool):Promise<JobOperations>{
  const [summary,rows]=await Promise.all([
    pool.query(`SELECT ${grouped} AS status_group,count(*)::integer AS count FROM castiq.jobs j LEFT JOIN castiq.receipts r ON r.job_id=j.id GROUP BY status_group`),
    // The database projection deliberately never selects payload, state, content, provider errors or credentials.
    pool.query(`SELECT j.id,j.club_id,w.state->'club'->>'name' AS club_name,j.state->>'channel' AS channel,j.status,j.revision,j.attempt,j.scheduled_at,j.provider_mode,${grouped} AS status_group,CASE WHEN ${confirmed} THEN r.kind ELSE NULL END AS confirmation_kind,CASE WHEN ${confirmed} THEN r.created_at ELSE NULL END AS confirmed_at FROM castiq.jobs j LEFT JOIN castiq.workspaces w ON w.club_id=j.club_id LEFT JOIN castiq.receipts r ON r.job_id=j.id ORDER BY j.updated_at DESC,j.id LIMIT $1`,[jobLimit]),
  ]);
  const counts=emptyJobCounts();
  for(const row of summary.rows)counts[row.status_group as JobGroup]=number(row.count);
  const total=Object.values(counts).reduce((sum,count)=>sum+count,0);
  return {total,counts,limit:jobLimit,truncated:total>jobLimit,items:rows.rows.map(row=>({
    id:row.id,clubId:row.club_id,clubName:row.club_name||row.club_id,
    channel:channels.includes(row.channel)?row.channel:'Onbekend kanaal',
    status:statuses.includes(row.status)?row.status:'unknown',group:row.status_group,
    revision:number(row.revision),attempt:number(row.attempt),scheduledAt:iso(row.scheduled_at),confirmedAt:iso(row.confirmed_at),
    confirmation:row.confirmation_kind==='demo'?'sandbox':row.confirmation_kind==='provider'?'provider':null,
    providerMode:row.provider_mode==='demo'?'demo':row.provider_mode==='live'?'live':'unknown',
  }))};
}
async function templates(pool:pg.Pool):Promise<OperationsData['templates']>{
  await initializeTemplateLibrary(pool);
  const [summary,recent]=await Promise.all([
    pool.query('SELECT count(*)::integer AS total,count(*) FILTER(WHERE enabled AND published_version IS NOT NULL)::integer AS active,count(*) FILTER(WHERE draft_layouts IS NOT NULL)::integer AS drafts FROM castiq.templates'),
    pool.query('SELECT t.id,t.name,v.number AS version,v.published_at FROM castiq.templates t JOIN castiq.template_versions v ON v.template_id=t.id AND v.number=t.published_version ORDER BY v.published_at DESC,t.id LIMIT 3'),
  ]);
  const row=summary.rows[0];
  return {total:number(row.total),active:number(row.active),drafts:number(row.drafts),recent:recent.rows.map(item=>({id:item.id,name:item.name,version:number(item.version),publishedAt:iso(item.published_at)!}))};
}
/** Called only after normal identity/account checks, with an independent role check for direct callers. */
export async function platformOperations(pool:pg.Pool,actor:Actor):Promise<PlatformOperations>{
  if(actor.role!=='platform')throw new ApiError(403,'Alleen platformbeheer kan operationele metadata bekijken.','forbidden');
  const [jobSource,registrations,privacy,mail,templateSource]=await Promise.all([
    source(()=>jobs(pool)),
    source(async()=>{const row=(await pool.query("SELECT count(*)::integer AS total,count(*) FILTER(WHERE status='registration_pending')::integer AS pending FROM castiq.privacy_accounts")).rows[0];return {total:number(row.total),pending:number(row.pending)};}),
    source(async()=>{const row=(await pool.query("SELECT count(*)::integer AS open,min(due_at) AS next_deadline FROM castiq.privacy_cases WHERE status<>'closed'")).rows[0];return {open:number(row.open),nextDeadline:iso(row.next_deadline)};}),
    source(async()=>{const row=(await pool.query("SELECT count(*)::integer AS incidents FROM castiq.mail_outbox WHERE status IN ('failed','unconfirmed','blocked','bounced','complained')")).rows[0];return {incidents:number(row.incidents)};}),
    source(()=>templates(pool)),
  ]);
  return {generatedAt:new Date().toISOString(),sources:{jobs:jobSource,registrations,privacy,mail,templates:templateSource}};
}
