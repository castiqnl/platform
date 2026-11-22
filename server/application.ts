import {createHash,randomBytes,randomUUID} from 'node:crypto';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {mkdir,readFile,writeFile,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createPrivacyService,handlePrivacyRoute,type PrivacyService,type PrivacyIdentity} from './privacy.ts';
import {createFileDeletionLedger} from './privacyLedger.ts';
import {LEGAL_DOCUMENTS} from '../shared/legalDocuments.ts';
import {createAccountOperations} from './accountOperations.ts';
import {mailAdminOverview,saveMailConfiguration,saveMailTemplate,exportSupabaseMailTemplates,enqueueMailTest,receiveMailWebhook,enqueueMail,erasePersonalMail,type MailOptions} from './mail.ts';
import {listClubs,createClub,listAccounts,assignMembership} from './administration.ts';
import sharp, {type Metadata} from 'sharp';
import type pg from 'pg';
import {fixtureAccounts,type Actor} from './fixtures.ts';
import {ApiError,bad,deny,conflict,mutate,project,persistHistory,mayReadSharedSponsorMedia} from './workflow.ts';
export type ApplicationOptions={pool:pg.Pool;uploadDir:string;authMode:'local'|'supabase';appEnv?:string;host?:string;origin?:string;supabaseUrl?:string;supabasePublishableKey?:string;commit?:string;publicationMode?:string;readiness?:()=>Promise<boolean>;mailEncryptionKey?:string;privacyReferenceKey?:string;privacyLedgerDir?:string;accountOperationsKey?:string;identityFetch?:typeof fetch;privacy?:PrivacyService};
const loopback=(host:string)=>['127.0.0.1','localhost','::1','::ffff:127.0.0.1'].includes(host);
const digest=(token:string)=>createHash('sha256').update(token).digest('hex');
const cookieName='castiq_session';
function cookie(req:IncomingMessage){return req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';}
function send(res:ServerResponse,status:number,data:any){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
async function body(req:IncomingMessage,limit:number){const chunks:Buffer[]=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>limit)throw new ApiError(413,'Bestand of verzoek is te groot.','too_large');chunks.push(chunk);}return Buffer.concat(chunks);}
async function json(req:IncomingMessage){if(req.headers['content-type']?.split(';')[0]!=='application/json')throw new ApiError(415,'Gebruik application/json.');try{const value=JSON.parse((await body(req,1024*1024)).toString('utf8'));if(!value||typeof value!=='object'||Array.isArray(value))bad('Een JSON-object is verplicht.');return value;}catch(error){if(error instanceof ApiError)throw error;bad('Ongeldige JSON.');}}
function actorFrom(row:any):Actor{return {id:row.actor_id,name:row.actor_name,role:row.role,clubId:row.club_id,...(row.team?{team:row.team}:{})};}
export function createApplication(options:ApplicationOptions){
 const {pool}=options;const local=options.authMode==='local',host=options.host||'127.0.0.1',origin=options.origin||'http://127.0.0.1:4173';
 if(local&&(options.appEnv!=='local'||!loopback(host)))throw new Error('Lokale fixture-auth vereist APP_ENV=local en uitsluitend loopbackbinding.');
 if(options.publicationMode&&options.publicationMode!=='sandbox')throw new Error('Alleen de expliciete sandboxadapter is beschikbaar; echte publicatie is uitgeschakeld.');
 if(!['local','supabase'].includes(options.authMode))throw new Error('Onbekende authenticatiemethode.');
 const uploadDir=resolve(options.uploadDir);const requests=new Map<string,{n:number;until:number}>();
 const mailOptions:MailOptions={origin,environment:options.appEnv||'staging',encryptionKey:options.mailEncryptionKey};
 const accountOperations=createAccountOperations({supabaseUrl:options.supabaseUrl,key:options.accountOperationsKey});
 const privacy=options.privacy||createPrivacyService({pool,documents:LEGAL_DOCUMENTS,referenceKey:options.privacyReferenceKey,ledger:options.privacyLedgerDir?createFileDeletionLedger(options.privacyLedgerDir,{environmentId:options.appEnv&&options.appEnv!=='local'?'castiq-vps08-'+options.appEnv:undefined}):undefined,enqueueMail:(db,input)=>enqueueMail(db,input,mailOptions),erasePersonalMail,...accountOperations,deletePrivateMedia:async objectKey=>{if(!/^[a-f0-9]{64}\.webp$/.test(objectKey))throw new Error('invalid_private_media_key');try{await unlink(resolve(uploadDir,objectKey));}catch(error){if((error as any).code!=='ENOENT')throw error;}}});
 type Authentication={actor:Actor|null;identity:PrivacyIdentity|null;memberships:(Actor&{clubName?:string})[];createdAt?:string};
 async function auth(req:IncomingMessage):Promise<Authentication>{
  const empty={actor:null,identity:null,memberships:[]};
  if(local){const token=cookie(req);if(!token||!/^([a-f0-9]{64})$/.test(token))return empty;const result=await pool.query('SELECT m.* FROM castiq.sessions s JOIN castiq.memberships m ON m.actor_id=s.actor_id AND m.club_id=s.club_id WHERE s.token_hash=$1 AND s.expires_at>now() AND m.active AND (m.expires_at IS NULL OR m.expires_at>now())',[digest(token)]);if(!result.rowCount)return empty;const actor=actorFrom(result.rows[0]);return {actor,identity:{id:actor.id},memberships:[actor]};}
  const authorization=req.headers.authorization;if(!authorization)return empty;if(!/^Bearer [^\s]+$/.test(authorization))throw new ApiError(401,'De identiteit kon niet worden gecontroleerd.','unauthorized');
  if(!options.supabaseUrl||!options.supabasePublishableKey)throw new ApiError(503,'De identiteit is nog niet geconfigureerd.','unconfigured');
  const target=new URL('/auth/v1/user',options.supabaseUrl);if(target.protocol!=='https:')throw new ApiError(503,'Identiteitsconfiguratie vereist HTTPS.','unconfigured');
  let verified:any;try{const response=await (options.identityFetch||fetch)(target,{headers:{Authorization:authorization,apikey:options.supabasePublishableKey},signal:AbortSignal.timeout(8000),redirect:'error'});if(!response.ok)throw new Error('invalid identity');verified=await response.json();}catch{throw new ApiError(401,'De sessie is verlopen of kon niet worden gecontroleerd. Meld opnieuw aan.','unauthorized');}
  if(typeof verified?.id!=='string')throw new ApiError(401,'De identiteit kon niet worden gecontroleerd.','unauthorized');
  // Claims become usable only after the provider has verified this bearer and its subject.
  // Refreshed iat and globally updated last_sign_in_at never establish recent authentication.
  let authenticatedAt:string|undefined,sessionStartedAt:string|undefined;
  try{const claims=JSON.parse(Buffer.from(authorization.slice(7).split('.')[1],'base64url').toString('utf8'));if(claims.sub===verified.id&&Array.isArray(claims.amr)){const times=claims.amr.filter((a:any)=>['otp','oauth','password','totp','recovery','sso/saml','webauthn'].includes(a.method)&&typeof a.timestamp==='number'&&a.timestamp>0&&a.timestamp*1000<=Date.now()+30000).map((a:any)=>a.timestamp*1000);if(times.length){authenticatedAt=new Date(Math.max(...times)).toISOString();sessionStartedAt=new Date(Math.min(...times)).toISOString();}}}catch{/* A verified user can read their account, but sensitive actions require proven sign-in recency. */}
  const identity:PrivacyIdentity={id:verified.id,...(typeof verified.email==='string'?{email:verified.email}:{}),authenticatedAt,sessionStartedAt};
  const result=await pool.query("SELECT m.*,w.state->'club'->>'name' AS club_name FROM castiq.memberships m LEFT JOIN castiq.workspaces w ON w.club_id=m.club_id WHERE m.actor_id=$1 AND m.active AND (m.expires_at IS NULL OR m.expires_at>now()) AND (m.role='platform' OR NOT EXISTS(SELECT 1 FROM castiq.memberships p WHERE p.actor_id=m.actor_id AND p.role='platform' AND p.active AND (p.expires_at IS NULL OR p.expires_at>now()))) ORDER BY m.club_id",[verified.id]);
  const memberships=result.rows.map(row=>({...actorFrom(row),clubName:row.club_name||row.club_id}));
  const requested=req.headers['x-castiq-club-id'];if(requested!==undefined&&(typeof requested!=='string'||!memberships.some(m=>m.clubId===requested)))deny('Je hebt geen actief recht voor deze clubomgeving.');
  const actor=requested?memberships.find(m=>m.clubId===requested)!:memberships.length===1?memberships[0]:null;
  const createdAt=typeof verified.created_at==='string'&&Number.isFinite(Date.parse(verified.created_at))?new Date(verified.created_at).toISOString():undefined;
  await privacy.ensureAccount(identity,{createdForRegistration:memberships.length===0&&Boolean(createdAt)&&Date.now()-Date.parse(createdAt!)<=10*60*1000,registrationStartedAt:createdAt});
  if(sessionStartedAt)await privacy.activity(identity,{kind:'session_start',eventId:'signin/'+sessionStartedAt});
  return {actor,identity,memberships,createdAt};
 }
 async function envelope(db:pg.Pool|pg.PoolClient,actor:Actor){if(actor.role==='platform'){const rows=await db.query("SELECT club_id,state->'club'->>'name' AS name,version,updated_at FROM castiq.workspaces WHERE club_id<>'__platform__' ORDER BY club_id");const state=project({},actor);state.clubs=rows.rows.map((r:any)=>({id:r.club_id,name:r.name||r.club_id,status:'Actief',version:Number(r.version),updatedAt:r.updated_at}));return {state,version:0,actor};}const result=await db.query('SELECT state,version FROM castiq.workspaces WHERE club_id=$1',[actor.clubId]);if(!result.rowCount)throw new ApiError(404,'Clubomgeving ontbreekt.','not_found');return {state:project(result.rows[0].state,actor),version:Number(result.rows[0].version),actor};}
 return async function application(req:IncomingMessage,res:ServerResponse){
  const correlationId=randomUUID();res.setHeader('X-Correlation-Id',correlationId);res.setHeader('Referrer-Policy','same-origin');
  try{
   const url=new URL(req.url||'/','http://localhost');const method=req.method||'GET';if(!url.pathname.startsWith('/api/'))throw new ApiError(404,'Niet gevonden.','not_found');
   if(local&&!loopback(req.socket.remoteAddress||''))deny('De lokale server is uitsluitend vanaf dit apparaat toegankelijk.');
   if(local){let requestHost='';try{requestHost=new URL('http://'+(req.headers.host||'')).hostname;}catch{deny();}if(!loopback(requestHost.replace(/^\[|\]$/g,''))&&requestHost!==new URL(origin).hostname)deny('Onbekende host voor de lokale omgeving.');}
   const webhook=url.pathname==='/api/mail/webhook'&&method==='POST';
   if(!webhook&&!['GET','HEAD'].includes(method)&&req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='same-origin'&&req.headers['sec-fetch-site']!=='none')deny('Open de clubomgeving rechtstreeks om deze actie uit te voeren.');
   const key=req.socket.remoteAddress||'unknown',time=Date.now();let rate=requests.get(key);if(!rate||rate.until<time){rate={n:0,until:time+60000};requests.set(key,rate);}if(++rate.n>240)throw new ApiError(429,'Te veel verzoeken. Wacht even en probeer opnieuw.','rate_limit');if(requests.size>10000)for(const [id,value] of requests)if(value.until<time)requests.delete(id);
   if(!webhook&&!['GET','HEAD'].includes(method)&&req.headers.origin&&req.headers.origin!==origin)deny('Het verzoek komt niet van de ingestelde Castiq-omgeving.');
   if(url.pathname==='/api/health'&&method==='GET'){await pool.query('SELECT 1');send(res,200,{status:'ok',environment:options.appEnv||'staging',publicationMode:'sandbox-only',authMode:options.authMode,commit:options.commit||null});return;}
   if(url.pathname==='/api/readiness'&&method==='GET'){const ready=options.readiness?await options.readiness():false;send(res,ready?200:503,{status:ready?'ready':'not_ready',commit:options.commit||null});return;}
   if(webhook){const raw=(await body(req,1024*1024)).toString('utf8');const headers=Object.fromEntries(['svix-id','svix-timestamp','svix-signature'].map(key=>[key,typeof req.headers[key]==='string'?req.headers[key]:'' as string]));send(res,200,await receiveMailWebhook(pool,raw,headers,mailOptions));return;}
   const authentication=await auth(req),{actor,identity,memberships}=authentication;
   if(url.pathname==='/api/session'){
    if(method==='GET'){const status=identity&&!local?await privacy.status(identity.id):null;send(res,200,{actor,identity:identity?{id:identity.id,email:identity.email,...status}:null,memberships,legal:identity&&!local?await privacy.legalStatus(identity,actor&&actor.role!=='platform'?actor.clubId:undefined):null,accounts:local?fixtureAccounts:[],environment:options.appEnv||'staging',authMode:options.authMode});return;}
    if(method==='POST'){if(!local)throw new ApiError(405,'Meld aan via de geconfigureerde identiteitsprovider.');const data=await json(req);const selected=fixtureAccounts.find(a=>a.id===data.accountId);if(!selected)throw new ApiError(401,'Kies een fictief lokaal pilotaccount.','unauthorized');const membership=await pool.query('SELECT * FROM castiq.memberships WHERE actor_id=$1 AND club_id=$2 AND active AND (expires_at IS NULL OR expires_at>now())',[selected.id,selected.clubId]);if(!membership.rowCount)deny();const token=randomBytes(32).toString('hex');const old=cookie(req);if(old)await pool.query('DELETE FROM castiq.sessions WHERE token_hash=$1',[digest(old)]);await pool.query('INSERT INTO castiq.sessions(token_hash,actor_id,club_id,expires_at) VALUES($1,$2,$3,now()+interval \'8 hours\')',[digest(token),selected.id,selected.clubId]);res.setHeader('Set-Cookie',`${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=28800`);send(res,200,{actor:actorFrom(membership.rows[0]),accounts:fixtureAccounts});return;}
    if(method==='DELETE'){const token=cookie(req);if(token)await pool.query('DELETE FROM castiq.sessions WHERE token_hash=$1',[digest(token)]);res.setHeader('Set-Cookie',`${cookieName}=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0`);send(res,200,{actor:null,accounts:local?fixtureAccounts:[]});return;}
   }
   if(url.pathname==='/api/privacy/successors'&&method==='GET'){
    if(!identity)throw new ApiError(401,'Meld aan om clubbeheer over te dragen.','unauthorized');if(!actor||actor.role!=='club')deny('Alleen een huidige clubbeheerder kan een opvolger kiezen.');if(!local){await privacy.assertActive(identity.id);await privacy.assertPersonalAgreement(identity.id);}
    const rows=await pool.query("SELECT m.actor_id,m.actor_name,m.role,m.team FROM castiq.memberships m JOIN castiq.privacy_accounts p ON p.actor_id=m.actor_id WHERE m.club_id=$1 AND m.actor_id<>$2 AND m.active AND (m.expires_at IS NULL OR m.expires_at>now()) AND p.status='active' ORDER BY m.actor_name",[actor.clubId,actor.id]);send(res,200,{accounts:rows.rows.map(row=>({id:row.actor_id,name:row.actor_name,role:row.role,...(row.team?{team:row.team}:{})}))});return;
   }
   if(url.pathname.startsWith('/api/privacy/')||url.pathname.startsWith('/api/legal/')){const input=['POST','PUT','PATCH'].includes(method)?await json(req):undefined;const handled=await handlePrivacyRoute(privacy,{method,path:url.pathname,identity,actor,body:input});if(handled){send(res,handled.status,handled.body);return;}}
   if(!identity)throw new ApiError(401,'Meld aan om de clubomgeving te openen.','unauthorized');
   if(!local){await privacy.assertActive(identity.id);await privacy.assertPersonalAgreement(identity.id);}
   if(!actor)throw new ApiError(403,memberships.length?'Kies eerst de clubomgeving die je wilt openen.':'Je account heeft nog geen clubrechten. Een beheerder kan deze toewijzen.','membership_required');
   const recentAuth=local||Boolean(identity.authenticatedAt&&Date.now()-Date.parse(identity.authenticatedAt)<=10*60*1000),adminMailOptions={...mailOptions,recentAuth};
   if(url.pathname==='/api/admin/mail'&&method==='GET'){send(res,200,await mailAdminOverview(pool,actor,adminMailOptions));return;}
   if(url.pathname==='/api/admin/mail/configuration'&&method==='PUT'){send(res,200,await saveMailConfiguration(pool,actor,await json(req),adminMailOptions));return;}
   if(url.pathname==='/api/admin/mail/supabase-export'&&method==='GET'){send(res,200,await exportSupabaseMailTemplates(pool,actor,adminMailOptions));return;}
   if(url.pathname==='/api/admin/mail/test'&&method==='POST'){send(res,202,await enqueueMailTest(pool,actor,adminMailOptions));return;}
   const mailTemplate=/^\/api\/admin\/mail\/templates\/([a-z_]{1,80})$/.exec(url.pathname);if(mailTemplate&&method==='PUT'){send(res,200,await saveMailTemplate(pool,actor,mailTemplate[1],await json(req),adminMailOptions));return;}
   if(url.pathname==='/api/admin/clubs'&&method==='GET'){send(res,200,await listClubs(pool,actor));return;}
   if(url.pathname==='/api/admin/clubs'&&method==='POST'){send(res,201,await createClub(pool,actor,await json(req),recentAuth));return;}
   if(url.pathname==='/api/admin/users'&&method==='GET'){send(res,200,await listAccounts(pool,actor));return;}
   const membership=/^\/api\/admin\/clubs\/([a-f0-9-]{36})\/memberships$/.exec(url.pathname);if(membership&&method==='PUT'){send(res,200,await assignMembership(pool,actor,membership[1],await json(req),recentAuth));return;}
   if(!local&&!['GET','HEAD'].includes(method)&&actor.role!=='platform')await privacy.assertClubAgreement(actor.clubId);
   if(url.pathname==='/api/workspace'&&method==='GET'){send(res,200,await envelope(pool,actor));return;}
   if(url.pathname==='/api/commands'&&method==='POST'){
    const data=await json(req);if(typeof data.type!=='string'||!Number.isInteger(data.expectedVersion))bad('Een serveractie en verwachte werkversie zijn verplicht.');if(actor.role==='platform')deny('Platformbeheer heeft geen standaard toegang tot clubinhoud.');
    const db=await pool.connect();try{await db.query('BEGIN');await db.query("SELECT set_config('castiq.club_id',$1,true)",[actor.clubId]);const row=await db.query('SELECT state,version FROM castiq.workspaces WHERE club_id=$1 FOR UPDATE',[actor.clubId]);if(!row.rowCount)throw new ApiError(404,'Clubomgeving ontbreekt.','not_found');if(Number(row.rows[0].version)!==data.expectedVersion)conflict();const before=row.rows[0].state;const {state,objectId}=await mutate(db,before,actor,data.type,data.data);await persistHistory(db,actor,before,state,data.type,data.data||{},objectId,correlationId);const nextVersion=Number(row.rows[0].version)+1;await db.query('UPDATE castiq.workspaces SET state=$1,version=$2,updated_at=now() WHERE club_id=$3',[JSON.stringify(state),nextVersion,actor.clubId]);await db.query('COMMIT');if(!local)await privacy.activity(identity,{kind:'user_action',eventId:correlationId});send(res,200,{state:project(state,actor),version:nextVersion,actor,result:{itemId:objectId}});}catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}return;
   }
   if(url.pathname==='/api/uploads'&&method==='POST'){
    if(actor.role==='platform')deny();const team=url.searchParams.get('team')||'';const workspace=await envelope(pool,actor);if(!workspace.state.teams.some((t:any)=>t.name===team)&&!(actor.role==='club'&&['Hele club','Clubbreed'].includes(team)))deny('Selecteer een team waarvoor je bevoegd bent.');const mime=req.headers['content-type']?.split(';')[0];if(!['image/jpeg','image/png','image/webp'].includes(mime||''))throw new ApiError(415,'Kies een JPG, PNG of WebP-afbeelding.','media_type');
    const input=await body(req,8*1024*1024);const expected=mime==='image/jpeg'?'jpeg':mime?.slice(6);let metadata:Metadata,output:Buffer;try{metadata=await sharp(input,{limitInputPixels:40000000,animated:false,failOn:'warning'}).metadata();if(metadata.format!==expected||!metadata.width||!metadata.height||metadata.width<16||metadata.height<16||metadata.width>10000||metadata.height>10000||(metadata.pages||1)>1)throw new Error('invalid image');output=await sharp(input,{limitInputPixels:40000000,failOn:'warning'}).rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).webp({quality:88}).toBuffer();}catch{bad('De afbeelding is niet veilig leesbaar of het bestandstype klopt niet.');}
    const quota=await pool.query('SELECT COALESCE(sum(byte_size),0) AS total FROM castiq.media WHERE club_id=$1',[actor.clubId]);if(Number(quota.rows[0].total)+output.length>512*1024*1024)throw new ApiError(413,'De opslaglimiet voor deze club is bereikt.','upload_quota');
    const id=randomUUID(),objectKey=randomBytes(32).toString('hex')+'.webp';await mkdir(uploadDir,{recursive:true,mode:0o700});const path=resolve(uploadDir,objectKey);await writeFile(path,output,{flag:'wx',mode:0o600});const out=await sharp(output).metadata();try{await pool.query('INSERT INTO castiq.media(id,club_id,team,actor_id,object_key,mime,width,height,byte_size,content_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[id,actor.clubId,team,actor.id,objectKey,'image/webp',out.width,out.height,output.length,createHash('sha256').update(output).digest('hex')]);}catch(error){await unlink(path);throw error;}send(res,201,{id,mediaId:id,url:`/api/media/${id}`,width:out.width,height:out.height,mime:'image/webp'});return;
   }
   const media=/^\/api\/media\/([a-f0-9-]{36})$/.exec(url.pathname);if(media&&method==='GET'){
    if(actor.role==='platform')deny();const found=await pool.query('SELECT * FROM castiq.media WHERE id=$1 AND club_id=$2',[media[1],actor.clubId]);if(!found.rowCount)throw new ApiError(404,'Afbeelding niet gevonden.','not_found');const row=found.rows[0];if(actor.role==='team'&&row.team!==actor.team){const workspace=await pool.query('SELECT state FROM castiq.workspaces WHERE club_id=$1',[actor.clubId]);if(!workspace.rowCount||!mayReadSharedSponsorMedia(workspace.rows[0].state,actor,`/api/media/${row.id}`))deny();}if(!/^[a-f0-9]{64}\.webp$/.test(row.object_key))throw new ApiError(500,'De afbeelding is niet beschikbaar.');const content=await readFile(resolve(uploadDir,row.object_key));res.writeHead(200,{'Content-Type':'image/webp','Content-Length':content.length,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'inline'});res.end(content);return;
   }
   throw new ApiError(404,'Deze serveractie bestaat niet.','not_found');
  }catch(error){if(error instanceof ApiError){send(res,error.status,{error:error.message,code:error.code,correlationId});return;}console.error(JSON.stringify({level:'error',correlationId,code:(error as any)?.code||'internal',message:'Serverrequest mislukt'}));send(res,500,{error:'Bewaren is niet gelukt. Je wijzigingen zijn niet bevestigd; probeer opnieuw of herlaad.',code:'server_error',correlationId});}
 };
}
