import {randomUUID} from 'node:crypto';
import type pg from 'pg';
import type {Actor} from './fixtures.ts';
import {ApiError} from './workflow.ts';
import {encryptChannelSecret,decryptChannelSecret,requiredChannelScopes,type Provider,type SocialOptions} from './socialConnections.ts';
const providers=['instagram','facebook','x','sportlink'];
function assertClub(actor:Actor){if(actor.role!=='club')throw new ApiError(403,'Alleen de clubbeheerder kan koppelingen inrichten.','forbidden');}
const purpose=(clubId:string,provider:string)=>'integration:'+clubId+':'+provider;
export async function resolveClubProvider(pool:pg.Pool,clubId:string,provider:Provider,base:SocialOptions):Promise<SocialOptions>{
 const row=(await pool.query("SELECT * FROM castiq.club_integrations WHERE club_id IN ($1,'__platform__') AND provider=$2 ORDER BY CASE WHEN club_id=$1 THEN 0 ELSE 1 END LIMIT 1",[clubId,provider])).rows[0];
 if(!row)return {...base,resolveProvider:undefined,publicationEnabled:false,configurationVersion:0,configurationClubId:'__platform__'};
 const secrets=row.encrypted_config?decryptChannelSecret(row.encrypted_config,base,purpose(row.club_id,provider)):{};
 return {...base,resolveProvider:undefined,publicationEnabled:row.enabled,configurationVersion:row.version,configurationClubId:row.club_id,providers:{...base.providers,[provider]:{clientId:row.public_config.clientId,clientSecret:secrets.clientSecret||'',approvedScopes:row.public_config.approvedScopes||[],apiVersion:row.public_config.apiVersion||'v27.0'}}};
}
function publicRow(row:any,origin:string,base:SocialOptions){const provider=row?.provider;return {provider,version:row?.version||0,configured:Boolean(row?.encrypted_config),enabled:row?.enabled===true,config:row?.public_config||{},updatedAt:row?.updated_at||null,callbackUrl:provider!=='sportlink'?new URL('/api/channels/oauth/'+provider+'/callback',origin).href:undefined,requiredScopes:provider!=='sportlink'?requiredChannelScopes[provider as Provider]:undefined,secureStorageConfigured:Boolean(base.encryptionKey)};}
export async function handleIntegrationRoute(pool:pg.Pool,actor:Actor,input:{method:string;path:string;body?:any},base:SocialOptions,recentAuth:boolean){
 const platform=input.path.startsWith('/api/admin/integrations'),prefix=platform?'/api/admin/integrations':'/api/club/integrations';if(!input.path.startsWith(prefix))return null;if(platform){if(actor.role!=='platform')throw new ApiError(403,'Alleen platformbeheer kan de centrale Castiq-appregistratie beheren.','forbidden');}else assertClub(actor);const owner=platform?'__platform__':actor.clubId;
 if(input.path===prefix&&input.method==='GET'){const rows=(await pool.query('SELECT * FROM castiq.club_integrations WHERE club_id=$1',[owner])).rows;return {status:200,body:{integrations:(platform?providers.filter(provider=>provider!=='sportlink'):providers).map(provider=>publicRow(rows.find(row=>row.provider===provider)||{provider},base.origin,base))}};}
 const match=/^\/api\/(?:club|admin)\/integrations\/(instagram|facebook|x|sportlink)$/.exec(input.path);if(!match||input.method!=='PUT')return null;if(platform&&match[1]==='sportlink')throw new ApiError(400,'Sportlink wordt per vereniging ingericht.');if(!recentAuth)throw new ApiError(403,'Meld opnieuw aan voordat je de afgeschermde appregistratie wijzigt.','recent_auth_required');
 const provider=match[1],data=input.body;if(!data||!Number.isInteger(data.expectedVersion)||typeof data.enabled!=='boolean')throw new ApiError(400,'Een versie en expliciete activeringskeuze zijn vereist.');
 const db=await pool.connect();try{await db.query('BEGIN');await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",['integration-config:'+provider]);const workspace=await db.query('SELECT club_id FROM castiq.workspaces WHERE club_id=$1 FOR UPDATE',[owner]);if(!workspace.rowCount)throw new ApiError(404,'De beheeromgeving bestaat niet.','not_found');
  const current=(await db.query('SELECT * FROM castiq.club_integrations WHERE club_id=$1 AND provider=$2 FOR UPDATE',[owner,provider])).rows[0];if(data.expectedVersion!==(current?.version||0))throw new ApiError(409,'De koppeling is gewijzigd. Herlaad voordat je opnieuw bewaart.','conflict');
  if(provider!=='sportlink'&&(await db.query("SELECT 1 FROM castiq.social_oauth_flows WHERE ($1::text IS NULL OR club_id=$1) AND provider=$2 AND status IN ('pending','processing','select') AND expires_at>now() LIMIT 1",[platform?null:owner,provider])).rowCount)throw new ApiError(409,'Rond eerst de lopende kanaalautorisatie af of wacht tot deze is verlopen voordat je de appregistratie wijzigt.','authorization_active');
  let secrets=current?.encrypted_config?decryptChannelSecret(current.encrypted_config,base,purpose(owner,provider)):{};
  const config:any={};const raw=data.config||{};
  if(provider!=='sportlink'){
   if(typeof raw.clientId!=='string'||!raw.clientId.trim()||raw.clientId.length>200||!/^[a-zA-Z0-9_.:-]+$/.test(raw.clientId))throw new ApiError(400,'Vul de app-ID van jullie providerregistratie in.');
   config.clientId=raw.clientId.trim();config.apiVersion=raw.apiVersion||'v27.0';if(!/^v\d+\.\d+$/.test(config.apiVersion))throw new ApiError(400,'Gebruik een geldige Meta API-versie.');
   config.approvedScopes=requiredChannelScopes[provider as Provider].filter(scope=>Array.isArray(raw.approvedScopes)&&raw.approvedScopes.includes(scope));
   const connections=(await db.query("SELECT status FROM castiq.social_connections WHERE ($1::text IS NULL OR club_id=$1) AND provider=$2 FOR UPDATE",[platform?null:owner,provider])).rows;
   const authChanged=config.clientId!==current?.public_config?.clientId||config.apiVersion!==(current?.public_config?.apiVersion||'v27.0')||JSON.stringify(config.approvedScopes)!==JSON.stringify(current?.public_config?.approvedScopes||[])||typeof data.secret==='string'&&!!data.secret.trim();
   if(connections.some(connection=>!['disconnected','revoked'].includes(connection.status))&&(platform||authChanged))throw new ApiError(409,'Ontkoppel het kanaal en rond de intrekking af voordat je de appregistratie wijzigt.','connection_active');
   if(data.enabled&&requiredChannelScopes[provider as Provider].some(scope=>!config.approvedScopes.includes(scope)))throw new ApiError(400,'Bevestig eerst alle vereiste goedgekeurde providerrechten.');
   if(typeof data.secret==='string'&&data.secret.trim()){if(data.secret.length>4096||/[\r\n]/.test(data.secret))throw new ApiError(400,'Ongeldig appgeheim.');secrets={clientSecret:data.secret.trim()};}
   if(!secrets.clientSecret)throw new ApiError(400,'Vul het appgeheim veilig in dit formulier in.');
  }else{
   if(typeof data.secret==='string'&&data.secret.trim()){if(data.secret.length>1024||! /^[a-zA-Z0-9_.:-]+$/.test(data.secret.trim()))throw new ApiError(400,'Ongeldig Sportlink Client-ID.');secrets={clientId:data.secret.trim()};}
   if(!secrets.clientId)throw new ApiError(400,'Vul jullie Sportlink Client-ID in.');
  }
  const encrypted=encryptChannelSecret(secrets,base,purpose(owner,provider));
  const saved=(await db.query('INSERT INTO castiq.club_integrations(club_id,provider,public_config,encrypted_config,enabled,updated_by) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(club_id,provider) DO UPDATE SET public_config=EXCLUDED.public_config,encrypted_config=EXCLUDED.encrypted_config,enabled=EXCLUDED.enabled,version=club_integrations.version+1,updated_by=EXCLUDED.updated_by,updated_at=now() RETURNING *',[owner,provider,JSON.stringify(config),encrypted,data.enabled,actor.id])).rows[0];
  await db.query('INSERT INTO castiq.integration_events(id,club_id,provider,actor_id,action) VALUES($1,$2,$3,$4,$5)',[randomUUID(),owner,provider,actor.id,data.enabled?'configuration.enabled':'configuration.saved']);await db.query('COMMIT');return {status:200,body:{integration:publicRow(saved,base.origin,base)}};
 }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
}
/** Fixed supplier host and bounded response; credentials never leave the server. */
export async function readSportlink(pool:pg.Pool,actor:Actor,article:'teams'|'programma'|'uitslagen',base:SocialOptions,teamCode?:string){assertClub(actor);const row=(await pool.query("SELECT * FROM castiq.club_integrations WHERE club_id=$1 AND provider='sportlink'",[actor.clubId])).rows[0];if(!row?.enabled||!row.encrypted_config)throw new ApiError(409,'Koppel en activeer eerst jullie Sportlink Club.Dataservice.','integration_required');
 const secrets=decryptChannelSecret(row.encrypted_config,base,purpose(actor.clubId,'sportlink')),url=new URL('https://data.sportlink.com/'+article);url.searchParams.set('client_id',secrets.clientId);url.searchParams.set('aantaldagen','14');if(teamCode){if(!/^[a-zA-Z0-9_-]{1,60}$/.test(teamCode))throw new ApiError(400,'Kies een geldig Sportlink-team.');url.searchParams.set('teamcode',teamCode);}
 let response:Response;try{response=await(base.fetch||fetch)(url,{redirect:'error',signal:AbortSignal.timeout(10000)});}catch{throw new ApiError(502,'Sportlink is niet bereikbaar. De bestaande wedstrijden blijven bewaard.','provider_unavailable');}if(!response.ok)throw new ApiError(502,'Sportlink heeft de aanvraag geweigerd. Controleer jullie abonnement en Client-ID.','provider_rejected');
 const reader=response.body?.getReader(),chunks:Uint8Array[]=[];let bytes=0;
 if(reader)try{for(;;){const value=await reader.read();if(value.done)break;bytes+=value.value.byteLength;if(bytes>2_000_000){await reader.cancel();throw new ApiError(502,'Het antwoord van Sportlink is te groot.');}chunks.push(value.value);}}finally{reader.releaseLock();}
 const text=Buffer.concat(chunks).toString('utf8');let rows:any;try{rows=JSON.parse(text);}catch{throw new ApiError(502,'Sportlink gaf geen leesbaar antwoord.');}if(!Array.isArray(rows))throw new ApiError(502,'Sportlink gaf geen lijst terug. Controleer de toegang.');
 return rows.slice(0,1000).filter(row=>row&&typeof row==='object'&&!Array.isArray(row)).map(row=>Object.fromEntries(Object.entries(row).filter(([key,value])=>['teamcode','teamnaam','wedstrijdcode','datum','wedstrijddatum','aanvangstijd','thuisteam','uitteam','accommodatie','uitslag','status'].includes(key)&&['string','number'].includes(typeof value)).map(([key,value])=>[key,String(value).slice(0,200)])));
}
