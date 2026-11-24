/** Small server-only client for the documented Post for Me v1 API.
 * Source checked 2026-11-24: https://api.postforme.dev/docs
 * Never return upstream account tokens, result logs, or error payloads.
 * There is no documented idempotency key: callers must persist write intent and
 * reconcile posts by external_id before considering another create request. */
export const POST_FOR_ME_API_ORIGIN='https://api.postforme.dev';
export type PFMPlatform='facebook'|'instagram';
export type PFMEventType='social.post.created'|'social.post.updated'|'social.post.deleted'|'social.post.result.created'|'social.account.created'|'social.account.updated';
export type PFMAccount={id:string;platform:string;username:string|null;user_id:string;profile_photo_url:string|null;status:'connected'|'disconnected';external_id:string|null;metadata:{display_name?:string}};
export type PFMPage<T>={data:T[];meta:{total:number;offset:number;limit:number;next:string|null}};
export type PFMPost={id:string;external_id:string|null;caption:string;status:'draft'|'scheduled'|'processing'|'processed';scheduled_at:string|null;social_accounts:PFMAccount[];created_at?:string;updated_at?:string};
export type PFMPostResult={id:string;post_id:string;social_account_id:string;success:boolean;platform_data:{id?:string;url?:string};errorCode?:string};
/** A webhook's secret is intentionally server-only and must be encrypted before storage. */
export type PFMWebhook={id:string;url:string;secret:string;event_types:PFMEventType[]};
export type PFMPostInput={caption:string;social_accounts:string[];external_id:string;media:{url:string;alt_text?:string}[];scheduled_at?:string|null;isDraft?:boolean;platform_configurations?:Partial<Record<PFMPlatform,{placement:'timeline'|'stories'}>>};
type ScalarOrArray=string|string[];
type Paging={limit?:number;offset?:number};
export type PFMAccountFilters=Paging&{external_id?:ScalarOrArray;platform?:ScalarOrArray;id?:ScalarOrArray;status?:'connected'|'disconnected'};
export type PFMPostFilters=Paging&{external_id?:ScalarOrArray;social_account_id?:ScalarOrArray;status?:ScalarOrArray};
export type PFMClientOptions={apiKey:string;fetch?:typeof fetch;timeoutMs?:number;maxResponseBytes?:number};
const eventTypes:PFMEventType[]=['social.post.created','social.post.updated','social.post.deleted','social.post.result.created','social.account.created','social.account.updated'];
const messages:Record<string,string>={
 post_for_me_not_configured:'De Post for Me-API-sleutel is niet ingesteld.',
 post_for_me_invalid_input:'De gegevens voor Post for Me zijn ongeldig.',
 post_for_me_unauthorized:'De Post for Me-API-sleutel is ongeldig of heeft geen toegang.',
 post_for_me_not_found:'De gevraagde Post for Me-koppeling of publicatie is niet gevonden.',
 post_for_me_rate_limited:'Post for Me ontvangt tijdelijk te veel aanvragen. Probeer het later opnieuw.',
 post_for_me_unavailable:'Post for Me is tijdelijk niet bereikbaar. Controleer later opnieuw.',
 post_for_me_invalid_response:'Post for Me gaf geen bruikbaar antwoord. Controleer eerst de verwerkingsstatus.',
 post_for_me_rejected:'Post for Me heeft de aanvraag geweigerd. Controleer de koppeling en instellingen.',
};
/** Contains only a fixed error code and safe transport facts; never an upstream cause. */
export class PostForMeError extends Error{
 code:string;status:number;ambiguous:boolean;
 constructor(code:string,status=0,ambiguous=false){super(messages[code]||messages.post_for_me_rejected);this.name='PostForMeError';this.code=code;this.status=status;this.ambiguous=ambiguous;}
}
function invalid():never{throw new PostForMeError('post_for_me_invalid_input');}
function badResponse():never{throw new PostForMeError('post_for_me_invalid_response');}
function object(value:unknown):Record<string,any>{if(!value||typeof value!=='object'||Array.isArray(value))badResponse();return value as Record<string,any>;}
function text(value:unknown,max=500):string{if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))badResponse();return value;}
function identifier(value:unknown):string{if(typeof value!=='string'||(!/^[-a-zA-Z0-9_:.]{1,256}$/.test(value)||/^\.{1,2}$/.test(value)))badResponse();return value;}
function inputIdentifier(value:unknown):string{try{return identifier(value);}catch{invalid();}}
function nullableText(value:unknown,max=500):string|null{return value===null||value===undefined?null:text(value,max);}
function httpsUrl(value:unknown):string{if(typeof value!=='string'||value.length>8192)badResponse();try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.hash||u.port&&u.port!=='443')badResponse();return u.href;}catch{badResponse();}}
function inputHttpsUrl(value:unknown):string{try{return httpsUrl(value);}catch{invalid();}}
function imageUrl(value:unknown):string|null{if(!value)return null;try{const url=new URL(httpsUrl(value));if([...url.searchParams.keys()].some(key=>/access.?token|refresh.?token|authorization|secret/i.test(key)))return null;return url.href;}catch{return null;}}
function account(value:unknown):PFMAccount{
 const v=object(value),metadata=v.metadata==null?{}:object(v.metadata);
 if(!['connected','disconnected'].includes(v.status))badResponse();
 return {id:identifier(v.id),platform:text(v.platform,40),username:nullableText(v.username),user_id:identifier(v.user_id),profile_photo_url:imageUrl(v.profile_photo_url),status:v.status,external_id:nullableText(v.external_id,256),metadata:typeof metadata.display_name==='string'?{display_name:text(metadata.display_name)}:{}};
}
function post(value:unknown):PFMPost{
 const v=object(value);if(!['draft','scheduled','processing','processed'].includes(v.status)||!Array.isArray(v.social_accounts)||v.social_accounts.length>100)badResponse();
 return {id:identifier(v.id),external_id:nullableText(v.external_id,256),caption:text(v.caption,20000),status:v.status,scheduled_at:nullableText(v.scheduled_at,80),social_accounts:v.social_accounts.map(account),...(typeof v.created_at==='string'?{created_at:text(v.created_at,80)}:{}),...(typeof v.updated_at==='string'?{updated_at:text(v.updated_at,80)}:{})};
}
/** Classification inspects an error in memory but never retains provider text/details. */
function resultErrorCode(error:unknown):string{
 const raw=typeof error==='string'?error:JSON.stringify(error||{});const lower=raw.toLowerCase();
 if(/aspect|resolution|dimension|image|media|video|format/.test(lower))return 'provider_media_invalid';
 if(/permission|unauthoriz|revoked|expired|access.?token|not connected/.test(lower))return 'channel_revoked';
 if(/rate.?limit|too many/.test(lower))return 'provider_rate_limited';
 return 'provider_rejected';
}
export function sanitizePostForMeResult(value:unknown):PFMPostResult{
 const v=object(value);if(typeof v.success!=='boolean')badResponse();const data=v.platform_data==null?{}:object(v.platform_data),platform_data:PFMPostResult['platform_data']={};
 if(data.id!==undefined&&data.id!==null){if(typeof data.id==='number'&&Number.isSafeInteger(data.id)&&data.id>0)platform_data.id=String(data.id);else platform_data.id=identifier(data.id);}
 if(data.url){try{const url=new URL(httpsUrl(data.url));if(['facebook.com','www.facebook.com','m.facebook.com','fb.watch','instagram.com','www.instagram.com'].includes(url.hostname)){if([...url.searchParams.keys()].some(key=>/access.?token|refresh.?token|authorization|secret/i.test(key)))throw Error('unsafe link');for(const key of [...url.searchParams.keys()])if(!['story_fbid','id','fbid'].includes(key)||!/^[-a-zA-Z0-9_]{1,180}$/.test(url.searchParams.get(key)||''))url.searchParams.delete(key);platform_data.url=url.href;}}catch{/* An unsafe optional link does not invalidate the durable receipt. */}}
 return {id:identifier(v.id),post_id:identifier(v.post_id),social_account_id:identifier(v.social_account_id),success:v.success,platform_data,...(!v.success?{errorCode:resultErrorCode(v.error)}:{})};
}
function webhook(value:unknown):PFMWebhook{const v=object(value);if(!Array.isArray(v.event_types)||v.event_types.length>eventTypes.length||v.event_types.some((e:unknown)=>!eventTypes.includes(e as PFMEventType)))badResponse();if(typeof v.secret!=='string'||!v.secret.trim())badResponse();return {id:identifier(v.id),url:httpsUrl(v.url),secret:text(v.secret,4096),event_types:[...new Set<PFMEventType>(v.event_types)]};}
function page<T>(value:unknown,parse:(value:unknown)=>T):PFMPage<T>{
 const v=object(value),m=object(v.meta);if(!Array.isArray(v.data)||v.data.length>100||!Number.isInteger(m.total)||m.total<0||!Number.isInteger(m.offset)||m.offset<0||!Number.isInteger(m.limit)||m.limit<1||m.limit>100)badResponse();
 // Never follow provider next URLs. Callers paginate with bounded integer offsets.
 let next:string|null=null;if(m.next!==null){if(typeof m.next!=='string')badResponse();try{const url=new URL(text(m.next,8192));if(url.origin===POST_FOR_ME_API_ORIGIN&&url.pathname.startsWith('/v1/')&&![...url.searchParams.keys()].some(key=>/token|secret|authorization/i.test(key)))next=url.href;}catch{badResponse();}}return {data:v.data.map(parse),meta:{total:m.total,offset:m.offset,limit:m.limit,next}};
}
function query(filters:Record<string,unknown>,allowed:string[]):URLSearchParams{
 const q=new URLSearchParams(),limit=filters.limit??50,offset=filters.offset??0;if(!Number.isInteger(limit)||Number(limit)<1||Number(limit)>100||!Number.isInteger(offset)||Number(offset)<0||Number(offset)>100000)invalid();q.set('limit',String(limit));q.set('offset',String(offset));
 for(const key of allowed){const value=filters[key];if(value===undefined)continue;const values=Array.isArray(value)?value:[value];if(values.length>100)invalid();for(const item of values){if(typeof item!=='string'||item.length<1||item.length>8192)invalid();q.append(key,item);}}
 return q;
}
function postBody(value:PFMPostInput):Record<string,unknown>{
 if(!value||typeof value.caption!=='string'||value.caption.length>20000||!Array.isArray(value.social_accounts)||value.social_accounts.length<1||value.social_accounts.length>8||!Array.isArray(value.media)||value.media.length<1||value.media.length>10)invalid();
 const body:Record<string,unknown>={caption:value.caption,social_accounts:value.social_accounts.map(inputIdentifier),external_id:inputIdentifier(value.external_id),media:value.media.map(m=>({url:inputHttpsUrl(m.url),...(typeof m.alt_text==='string'?{alt_text:m.alt_text.slice(0,1000)}:{})}))};
 if(value.scheduled_at!==undefined){if(value.scheduled_at!==null&&(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value.scheduled_at)||!Number.isFinite(Date.parse(value.scheduled_at))))invalid();body.scheduled_at=value.scheduled_at;}
 if(value.isDraft!==undefined){if(typeof value.isDraft!=='boolean')invalid();body.isDraft=value.isDraft;}
 if(value.platform_configurations!==undefined){const config:Record<string,unknown>={};for(const [key,c] of Object.entries(value.platform_configurations)){if(!['facebook','instagram'].includes(key)||!c||!['timeline','stories'].includes(c.placement))invalid();config[key]={placement:c.placement};}body.platform_configurations=config;}
 return body;
}
export class PostForMeClient{
 #apiKey:string;#fetch:typeof fetch;#timeoutMs:number;#maxBytes:number;
 constructor(options:PFMClientOptions){
  if(!options||typeof options.apiKey!=='string'||!options.apiKey.trim()||options.apiKey.length>4096||/[\r\n]/.test(options.apiKey))throw new PostForMeError('post_for_me_not_configured');
  this.#apiKey=options.apiKey.trim();this.#fetch=options.fetch||fetch;this.#timeoutMs=options.timeoutMs??15000;this.#maxBytes=options.maxResponseBytes??2*1024*1024;
  if(!Number.isInteger(this.#timeoutMs)||this.#timeoutMs<1||this.#timeoutMs>30000||!Number.isInteger(this.#maxBytes)||this.#maxBytes<1||this.#maxBytes>8*1024*1024)invalid();
 }
 async #request<T>(method:string,path:string,parse:(value:unknown)=>T,body?:unknown):Promise<T>{
  const write=method!=='GET',controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.#timeoutMs);let status=0;const aborted=new Promise<never>((_,reject)=>controller.signal.addEventListener('abort',()=>reject(new PostForMeError('post_for_me_unavailable',status,write)),{once:true}));
  try{
   const response=await Promise.race([this.#fetch(POST_FOR_ME_API_ORIGIN+path,{method,headers:{Authorization:'Bearer '+this.#apiKey,Accept:'application/json',...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{}),redirect:'error',signal:controller.signal}),aborted]);
   status=response.status;
   if(!response.ok){await response.body?.cancel().catch(()=>{});throw new PostForMeError(status===401||status===403?'post_for_me_unauthorized':status===404?'post_for_me_not_found':status===429?'post_for_me_rate_limited':status>=500||status===408?'post_for_me_unavailable':'post_for_me_rejected',status,write&&(status>=500||status===408));}
   if(response.url&&new URL(response.url).origin!==POST_FOR_ME_API_ORIGIN)badResponse();
   const length=Number(response.headers.get('content-length'));if(Number.isFinite(length)&&length>this.#maxBytes){await response.body?.cancel().catch(()=>{});badResponse();}
   if(!response.body)badResponse();const reader=response.body.getReader(),chunks:Uint8Array[]=[];let bytes=0;
   try{while(true){const chunk=await Promise.race([reader.read(),aborted]);if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>this.#maxBytes)badResponse();chunks.push(chunk.value);}}
   finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
   let value:unknown;try{value=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{badResponse();}return parse(value);
  }catch(error){if(error instanceof PostForMeError){if(!error.status)error.status=status;if(write&&error.code==='post_for_me_invalid_response')error.ambiguous=true;throw error;}throw new PostForMeError(controller.signal.aborted||status===0?'post_for_me_unavailable':'post_for_me_invalid_response',status,write);}
  finally{clearTimeout(timer);}
 }
 async testConnection():Promise<{ok:true}>{await this.listAccounts({limit:1,offset:0});return {ok:true};}
 listAccounts(filters:PFMAccountFilters={}):Promise<PFMPage<PFMAccount>>{return this.#request('GET','/v1/social-accounts?'+query(filters,['external_id','platform','id','status']),v=>page(v,account));}
 getAccount(id:string):Promise<PFMAccount>{return this.#request('GET','/v1/social-accounts/'+inputIdentifier(id),account);}
 createAuthUrl(platform:PFMPlatform,externalId:string):Promise<{url:string;platform:PFMPlatform}>{
  if(!['facebook','instagram'].includes(platform))invalid();
  return this.#request('POST','/v1/social-accounts/auth-url',value=>{const v=object(value),url=new URL(httpsUrl(v.url));if(v.platform!==platform||!(platform==='facebook'?['facebook.com','www.facebook.com']:['instagram.com','www.instagram.com']).includes(url.hostname))badResponse();return {url:url.href,platform};},{platform,external_id:inputIdentifier(externalId),permissions:['posts'],force_reauth:true,...(platform==='instagram'?{platform_data:{instagram:{connection_type:'instagram'}}}:{})});
 }
 disconnectAccount(id:string):Promise<PFMAccount>{return this.#request('POST','/v1/social-accounts/'+inputIdentifier(id)+'/disconnect',account);}
 listWebhooks(filters:Paging&{url?:ScalarOrArray;id?:ScalarOrArray}={}):Promise<PFMPage<PFMWebhook>>{return this.#request('GET','/v1/webhooks?'+query(filters,['url','id']),v=>page(v,webhook));}
 getWebhook(id:string):Promise<PFMWebhook>{return this.#request('GET','/v1/webhooks/'+inputIdentifier(id),webhook);}
 createWebhook(input:{url:string;event_types:PFMEventType[]}):Promise<PFMWebhook>{return this.#request('POST','/v1/webhooks',webhook,this.#webhookBody(input));}
 updateWebhook(id:string,input:{url?:string;event_types?:PFMEventType[]}):Promise<PFMWebhook>{return this.#request('PATCH','/v1/webhooks/'+inputIdentifier(id),webhook,this.#webhookBody(input));}
 #webhookBody(input:{url?:string;event_types?:PFMEventType[]}):Record<string,unknown>{const body:Record<string,unknown>={};if(input.url!==undefined)body.url=inputHttpsUrl(input.url);if(input.event_types!==undefined){if(!Array.isArray(input.event_types)||!input.event_types.length||input.event_types.some(t=>!eventTypes.includes(t)))invalid();body.event_types=[...new Set(input.event_types)];}if(!Object.keys(body).length)invalid();return body;}
 deleteWebhook(id:string):Promise<{success:boolean}>{return this.#request('DELETE','/v1/webhooks/'+inputIdentifier(id),value=>{const v=object(value);if(v.success!==true)badResponse();return {success:true};});}
 createPost(input:PFMPostInput):Promise<PFMPost>{return this.#request('POST','/v1/social-posts',post,postBody(input));}
 updatePost(id:string,input:PFMPostInput):Promise<PFMPost>{return this.#request('PUT','/v1/social-posts/'+inputIdentifier(id),post,postBody(input));}
 listPosts(filters:PFMPostFilters={}):Promise<PFMPage<PFMPost>>{return this.#request('GET','/v1/social-posts?'+query(filters,['external_id','social_account_id','status']),v=>page(v,post));}
 getPost(id:string):Promise<PFMPost>{return this.#request('GET','/v1/social-posts/'+inputIdentifier(id),post);}
 getPostResults(postId:string,filters:Paging&{social_account_id?:ScalarOrArray}={}):Promise<PFMPage<PFMPostResult>>{return this.#request('GET','/v1/social-post-results?'+query({...filters,post_id:inputIdentifier(postId)},['post_id','social_account_id']),v=>page(v,sanitizePostForMeResult));}
 deletePost(id:string):Promise<{success:boolean}>{return this.#request('DELETE','/v1/social-posts/'+inputIdentifier(id),value=>{const v=object(value);if(v.success!==true)badResponse();return {success:true};});}
}
