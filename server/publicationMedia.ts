import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import sharp from 'sharp';
import type pg from 'pg';
import {ApiError} from './workflow.ts';
import {verifyPublicationPayload} from './publicationIntegrity.ts';
import {assertPostForMeDestination,type PostForMeOptions} from './postForMe.ts';
import {resolveSocialOptions,decryptChannelSecret,type SocialOptions,type Provider} from './socialConnections.ts';
export type PublicationMediaOptions={origin:string;environment:string;key?:string;uploadDir:string;staticDir:string;social?:SocialOptions;postForMe?:PostForMeOptions;now?:()=>Date};
const sha=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
const missing=()=>{throw new ApiError(404,'Publicatiebeeld niet beschikbaar.','not_found');};
const dimensions={'4:5':[1080,1350],'9:16':[1080,1920],'1:1':[1080,1080],'16:9':[1600,900]};
const loadedFonts=new Map<string,Promise<void>>();
async function prepareFonts(staticDir:string,assets:Map<string,any>){
 if(!loadedFonts.has(staticDir))loadedFonts.set(staticDir,(async()=>{
  for(const [url,asset] of assets){if(!url.endsWith('.woff2'))continue;const path=resolve(staticDir,'.'+url),bytes=await readFile(path);if(sha(bytes)!==asset.sha256)throw new Error('publication_font_hash_mismatch');
   // libvips registers the supplied font through Fontconfig. Subsequent SVG
   // rendering uses the same bundled Barlow, Inter and serif as the browser.
   await sharp({text:{text:'Ag',fontfile:path,font:'sans 12',rgba:true}}).png().toBuffer();
  }
 })().catch(error=>{loadedFonts.delete(staticDir);throw error;}));
 return loadedFonts.get(staticDir);
}
export function publicationRatio(channel:string){return channel.endsWith('Story')?'9:16':'4:5';}
function sign(clubId:string,job:any,expires:number,options:PublicationMediaOptions){if(!options.key||Buffer.byteLength(options.key)<32)throw new ApiError(503,'Beveiligde publicatiebeelden zijn nog niet geconfigureerd.','publication_configuration_missing');return createHmac('sha256',options.key).update([options.environment,clubId,job.id,job.contentHash,expires].join('\n')).digest('hex');}
export function publicationMediaUrl(clubId:string,job:any,options:PublicationMediaOptions){const origin=new URL(options.origin);if(origin.protocol!=='https:')throw new Error('publication_media_requires_https');const expires=Math.floor((options.now?.()||new Date()).getTime()/1000)+3600,url=new URL('/api/publication-media/'+encodeURIComponent(job.id),origin);url.search=new URLSearchParams({club:clubId,expires:String(expires),signature:sign(clubId,job,expires,options)}).toString();return url.href;}

const clamp=(value:number)=>Math.max(0,Math.min(1,value));
function hsl(r:number,g:number,b:number){const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;let h=0,s=0;if(d){s=d/(1-Math.abs(2*l-1));h=max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;h=((h*60)+360)%360;}return [h,s,l];}
function fromHsl(h:number,s:number,l:number){const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2,a=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return a.map(v=>Math.round((v+m)*255));}
/** Same chromatic masks as src/templateAtlas.ts; neutral materials stay intact. */
async function recolorAtlas(bytes:Buffer,atlas:number,primary:string,secondary:string){
 const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true}),target=(hex:string)=>hsl(...[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255) as [number,number,number]);
 const p=target(primary),s=target(secondary);
 for(let i=0;i<data.length;i+=4){if(data[i+3]<3)continue;const r=data[i]/255,g=data[i+1]/255,b=data[i+2]/255;if(Math.max(r,g,b)-Math.min(r,g,b)<.055)continue;
  const blue=b-r>.055&&b-g>-.025,pixel=i/4,cell=Math.floor((pixel%info.width)/info.width*3)+3*Math.floor(Math.floor(pixel/info.width)/info.height*3),red=atlas===3&&[2,7,8].includes(cell)&&r-g>.12&&r-b>.1,pink=r-g>.075&&b-g>.025&&r>b*.72||red;
  if(!blue&&!pink)continue;const [h,sat,l]=hsl(r,g,b);if(blue&&!pink&&(h<195||h>285)||pink&&h<285&&!red)continue;const target=pink?s:p,weight=clamp((sat-.08)/.35),light=l<=.54?target[2]*l/.54:target[2]+(1-target[2])*(l-.54)/.46,next=fromHsl(target[0],target[1]*Math.min(1,sat/.7),clamp(light));for(let n=0;n<3;n++)data[i+n]=Math.round(data[i+n]*(1-weight)+next[n]*weight);
 }
 return sharp(data,{raw:info}).png().toBuffer();
}
export async function renderPublicationMedia(db:Pick<pg.Pool,'query'>|Pick<pg.PoolClient,'query'>,clubId:string,job:any,options:PublicationMediaOptions){
 if(!job?.payload?.render||!verifyPublicationPayload(job))throw new Error('publication_snapshot_hash_mismatch');
 const render=job.payload.render,ratio=publicationRatio(job.channel),refs=new Map<string,any>((render.media||[]).map((ref:any)=>[ref.url,ref]));
 const manifest=JSON.parse(await readFile(new URL('../docs/ASSET-MANIFEST.json',import.meta.url),'utf8')),assets=new Map<string,any>(manifest.assets.map((asset:any)=>[asset.path.replace(/^public/,''),asset]));
 await prepareFonts(options.staticDir,assets);
 const renderer=await import(new URL('./generated/posterRenderer.mjs',import.meta.url).href);
 let markup=renderer.posterMarkup(job.payload,ratio);
 const urls=[...new Set(Array.from(markup.matchAll(/href="([^"<]+)"/g),match=>(match as RegExpMatchArray)[1]))] as string[];
 for(const url of urls){let bytes:Buffer,mime='image/webp';
  const asset=assets.get(url);
  if(asset){bytes=await readFile(resolve(options.staticDir,'.'+url));if(sha(bytes)!==asset.sha256)throw new Error('publication_asset_hash_mismatch');mime=url.endsWith('.svg')?'image/svg+xml':url.endsWith('.png')?'image/png':'image/webp';const atlas=/template-atlas-(\d)/.exec(url);if(atlas){bytes=await recolorAtlas(bytes,Number(atlas[1]),render.primary,render.secondary);mime='image/png';}}
  else {const id=/^\/api\/(media|template-media)\/([a-f0-9-]{36})$/.exec(url);if(!id||!refs.get(url)?.sha256)throw new Error('publication_media_not_snapshotted');const media=(await db.query('SELECT object_key,content_sha256 FROM castiq.media WHERE id=$1 AND club_id=$2',[id[2],id[1]==='template-media'?'__platform__':clubId])).rows[0];if(!media||media.content_sha256!==refs.get(url).sha256||! /^[a-f0-9]{64}\.webp$/.test(media.object_key))throw new Error('publication_media_missing');bytes=await readFile(resolve(options.uploadDir,media.object_key));if(sha(bytes)!==media.content_sha256)throw new Error('publication_media_hash_mismatch');}
  markup=markup.split('href="'+url+'"').join('href="data:'+mime+';base64,'+bytes.toString('base64')+'"');
 }
 const [width,height]=dimensions[ratio];return sharp(Buffer.from(markup),{limitInputPixels:20_000_000}).resize(width,height).jpeg({quality:92,mozjpeg:true}).toBuffer();
}

/** Public only through an unguessable, signed, one-hour capability; originals
 * remain private. Revocation, paused publication and changed approval deny it. */
export async function readPublicationMedia(pool:pg.Pool,url:URL,options:PublicationMediaOptions){
 const id=/^\/api\/publication-media\/([a-zA-Z0-9_-]{1,160})$/.exec(url.pathname)?.[1],clubId=url.searchParams.get('club')||'',expires=Number(url.searchParams.get('expires')),signature=url.searchParams.get('signature')||'',now=Math.floor((options.now?.()||new Date()).getTime()/1000);
 if(!id||!clubId||clubId.length>100||!Number.isInteger(expires)||expires<=now||expires>now+3600||!/^[a-f0-9]{64}$/.test(signature))missing();
 const result=await pool.query('SELECT j.state,w.state AS workspace FROM castiq.jobs j JOIN castiq.workspaces w ON w.club_id=j.club_id WHERE j.id=$1 AND j.club_id=$2 AND j.provider_mode=\'provider\'',[id,clubId]),row=result.rows[0],job=row?.state;
 if(!job||!['processing','awaiting_confirmation'].includes(job.status)||!['official-provider','post-for-me'].includes(job.adapter))missing();
 const expected=sign(clubId,job,expires,options);if(!timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(signature,'hex')))missing();
 const item=row.workspace.content?.find((item:any)=>item.jobs?.some((entry:any)=>entry.id===id));
 if(row.workspace.v1?.publicationPaused||!item||item.version!==job.version||item.approvedVersion!==job.version)missing();
 if(job.adapter==='post-for-me'){
  if(!options.postForMe)missing();let destination:any;try{destination=await assertPostForMeDestination(pool,clubId,job.channel,options.postForMe);}catch{missing();}
  if(destination.accountId!==job.providerAccountId||destination.authorizationId!==job.providerAuthorizationId||destination.projectId&&destination.projectId!==job.providerProjectId)missing();
  return {bytes:await renderPublicationMedia(pool,clubId,job,options),contentType:'image/jpeg' as const};
 }
 const provider=(job.channel.toLowerCase().startsWith('instagram')?'instagram':job.channel.toLowerCase().startsWith('facebook')?'facebook':'x') as Provider;
 if(options.social?.publicationMode!=='provider')missing();const social=await resolveSocialOptions(options.social!,clubId,provider);if(social.publicationEnabled!==true)missing();
 const connection=(await pool.query("SELECT account_id,encrypted_tokens,expires_at FROM castiq.social_connections WHERE club_id=$1 AND provider=$2 AND status='connected' AND destinations ? $3",[clubId,provider,job.channel])).rows[0];
 if(!connection||connection.account_id!==job.providerAccountId||connection.expires_at&&Date.parse(connection.expires_at)<=now*1000)missing();
 let authorizationId:string;try{authorizationId=decryptChannelSecret(connection.encrypted_tokens,social,clubId+':'+provider).authorizationId;}catch{missing();}
 if(authorizationId!==job.providerAuthorizationId)missing();return {bytes:await renderPublicationMedia(pool,clubId,job,options),contentType:'image/jpeg' as const};
}
