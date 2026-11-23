import {verifyPublicationPayload} from './publicationIntegrity.ts';
import {socialConfiguration,type Provider,type SocialOptions} from './socialConnections.ts';
export type DispatchState={phase?:'uploading'|'ready'|'publishing'|'rejected'|'confirmed';mediaId?:string;mediaKey?:string;containerId?:string;providerPostId?:string;providerObjectType?:'post'|'container';url?:string;startedAt?:string;errorCode?:string};
export type PublicationResult={status:'published'|'awaiting_confirmation'|'failed';state:DispatchState;providerPostId?:string;providerObjectType?:'post'|'container';url?:string;errorCode?:string};
export type ProviderPublication={provider:Provider;accountId:string;accessToken:string;job:any;mediaUrl:string;mediaBytes?:Buffer;state:DispatchState;checkpoint:(state:DispatchState)=>Promise<void>;options:SocialOptions};
class PublicationRequestError extends Error {
 code:string;ambiguous:boolean;
 constructor(code:string,ambiguous:boolean){super('De provider heeft de publicatie nog niet bevestigd.');this.code=code;this.ambiguous=ambiguous;}
}
function validId(value:unknown):value is string{return typeof value==='string'&&/^[a-zA-Z0-9_-]{1,180}$/.test(value);}
function requiredId(value:unknown){if(typeof value==='number'&&Number.isSafeInteger(value)&&value>0)value=String(value);if(!validId(value))throw new PublicationRequestError('provider_response_invalid',true);return value;}
function safeUrl(value:unknown,provider:Provider){if(typeof value!=='string')return '';try{const url=new URL(value);return url.protocol==='https:'&&(provider==='instagram'?['instagram.com','www.instagram.com']:provider==='facebook'?['facebook.com','www.facebook.com']:['x.com','www.x.com']).includes(url.hostname)?url.href:'';}catch{return '';}}
async function request(input:ProviderPublication,url:string,body?:Record<string,unknown>){
 let response:Response;try{response=await (input.options.fetch||fetch)(url,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+input.accessToken,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(15000)});}catch{throw new PublicationRequestError('provider_unavailable',true);}
 let value:any;try{value=await response.json();}catch{throw new PublicationRequestError('provider_response_invalid',true);}
 if(!response.ok||value?.error||value?.errors&&body){const code=response.status===401||value?.error?.code===190?'channel_revoked':response.status===429?'provider_rate_limited':'provider_rejected';throw new PublicationRequestError(code,!body||response.ok||response.status>=500);}
 return value;
}
/** Every public-write intent is committed separately before the network call.
 * Providers do not share an idempotency contract. An uncertain POST is only
 * reconciled from its saved resource ID, never blindly sent a second time. */
export async function publishSocialImage(input:ProviderPublication):Promise<PublicationResult>{
 const config=socialConfiguration(input.provider,input.options);
 if(input.options.publicationMode!=='provider'||input.options.publicationEnabled!==true||input.job.providerMode!=='provider'||input.job.adapter!=='official-provider')throw new Error('provider_publication_not_enabled');
 if(!validId(input.accountId)||!input.job.requestId||!verifyPublicationPayload(input.job))throw new Error('provider_publication_snapshot_invalid');
 const origin=new URL(input.mediaUrl);if(origin.origin!==new URL(input.options.origin).origin||origin.protocol!=='https:'||!origin.pathname.startsWith('/api/publication-media/'))throw new Error('provider_media_capability_invalid');
 let state={...input.state};const save=async(patch:Partial<DispatchState>)=>{state={...state,...patch};await input.checkpoint(state);};
 const complete=async(id:string,type:'post'|'container'='post',url='')=>{await save({phase:'confirmed',providerPostId:requiredId(id),providerObjectType:type,url:safeUrl(url,input.provider),errorCode:undefined});return {status:'published' as const,state,providerPostId:state.providerPostId,providerObjectType:type,url:state.url};};
 if(state.phase==='confirmed'&&state.providerPostId)return {status:'published',state,providerPostId:state.providerPostId,providerObjectType:state.providerObjectType||'post',url:state.url||''};
 const graph=`https://${input.provider==='instagram'?'graph.instagram.com':'graph.facebook.com'}/${config.apiVersion}`;
 const text=String(input.job.payload.caption||input.job.payload.title||'');
 try{
  // A provider explicitly rejecting a request permits another attempt with the
  // same uploaded resource. Timeouts and 5xx keep phase=publishing instead.
  if(state.phase==='rejected')await save({phase:state.containerId||state.mediaId?'ready':'uploading',errorCode:undefined});
  if(input.provider==='instagram'){
   if(!state.containerId){await save({phase:'uploading'});const value=await request(input,`${graph}/${input.accountId}/media`,{image_url:input.mediaUrl,...(input.job.channel.endsWith('Story')?{media_type:'STORIES'}:{caption:text,alt_text:String(input.job.payload.title||'Clubmoment').slice(0,1000)})});await save({phase:'ready',containerId:requiredId(value.id)});}
   const status=await request(input,`${graph}/${state.containerId}?fields=status_code`);
   if(status.status_code==='PUBLISHED')return complete(state.containerId!,'container');
   if(['ERROR','EXPIRED'].includes(status.status_code)){await save({phase:'rejected',errorCode:'provider_container_failed'});return {status:'failed',state,errorCode:'provider_container_failed'};}
   if(state.phase==='publishing'||status.status_code!=='FINISHED')return {status:'awaiting_confirmation',state};
   await save({phase:'publishing',startedAt:new Date().toISOString()});const value=await request(input,`${graph}/${input.accountId}/media_publish`,{creation_id:state.containerId});
   return complete(requiredId(value.id));
  }
  if(input.provider==='facebook'){
   if(!state.mediaId){await save({phase:'uploading'});const value=await request(input,`${graph}/${input.accountId}/photos`,{url:input.mediaUrl,published:false,temporary:true});await save({phase:'ready',mediaId:requiredId(value.id)});}
   const story=input.job.channel.endsWith('Story');
   if(state.phase==='publishing'){
    if(story){const value=await request(input,`${graph}/${input.accountId}/stories?fields=post_id,status,media_id,url&limit=100`);const matches=(value.data||[]).filter((entry:any)=>String(entry.media_id)===state.mediaId&&['PUBLISHED','ARCHIVED'].includes(entry.status));if(matches.length===1)return complete(String(matches[0].post_id),'post',matches[0].url);}
    else {const value=await request(input,`${graph}/${state.mediaId}?fields=page_story_id`);if(validId(value.page_story_id))return complete(value.page_story_id,'post',`https://www.facebook.com/${value.page_story_id}`);}
    return {status:'awaiting_confirmation',state};
   }
   await save({phase:'publishing',startedAt:new Date().toISOString()});
   const value=await request(input,`${graph}/${input.accountId}/${story?'photo_stories':'feed'}`,story?{photo_id:state.mediaId}:{message:text,attached_media:[{media_fbid:state.mediaId}]});
   if(story&&value.success!==true)throw new PublicationRequestError('provider_response_invalid',true);
   const id=requiredId(story?value.post_id:value.id);return complete(id,'post',story?`https://www.facebook.com/stories/${id}`:`https://www.facebook.com/${id}`);
  }
  if(!state.mediaId){
   if(!input.mediaBytes?.length||input.mediaBytes.length>5*1024*1024)throw new Error('provider_image_size_invalid');
   await save({phase:'uploading'});const value=await request(input,'https://api.x.com/2/media/upload',{media:input.mediaBytes.toString('base64'),media_category:'tweet_image',media_type:'image/jpeg'});
   await save({phase:'ready',mediaId:requiredId(value.data?.id),mediaKey:requiredId(value.data?.media_key)});
  }
  if(state.phase==='publishing'){
   const value=await request(input,`https://api.x.com/2/users/${input.accountId}/tweets?max_results=100&tweet.fields=attachments,created_at&expansions=attachments.media_keys&media.fields=media_key`);
   const matches=(value.data||[]).filter((post:any)=>post.text===text&&post.attachments?.media_keys?.includes(state.mediaKey));
   if(matches.length===1){const id=requiredId(matches[0].id);return complete(id,'post',`https://x.com/i/status/${id}`);}
   return {status:'awaiting_confirmation',state};
  }
  await save({phase:'publishing',startedAt:new Date().toISOString()});const value=await request(input,'https://api.x.com/2/tweets',{text,media:{media_ids:[state.mediaId]}});const id=requiredId(value.data?.id);return complete(id,'post',`https://x.com/i/status/${id}`);
 }catch(error){
  if(!(error instanceof PublicationRequestError))throw error;
  if(!error.ambiguous){await save({phase:'rejected',errorCode:error.code});return {status:'failed',state,errorCode:error.code};}
  return {status:'awaiting_confirmation',state,errorCode:error.code};
 }
}
