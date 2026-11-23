import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import type pg from 'pg';
import sharp from 'sharp';
import type {Actor} from './fixtures.ts';
import {ApiError} from './workflow.ts';
export type TemplateMediaOptions={uploadDir:string};
export async function uploadTemplateMedia(pool:pg.Pool,actor:Actor,bytes:Buffer,mime:string,options:TemplateMediaOptions,recentAuth:boolean){
 if(actor.role!=='platform')throw new ApiError(403,'Alleen platformbeheer kan afbeeldingen aan centrale ontwerpen toevoegen.','forbidden');
 if(!recentAuth)throw new ApiError(403,'Meld opnieuw aan om een centrale ontwerpafbeelding te uploaden.','recent_auth_required');
 if(bytes.length>8*1024*1024)throw new ApiError(413,'Kies een afbeelding van maximaal 8 MB.','too_large');
 if(!['image/jpeg','image/png','image/webp'].includes(mime))throw new ApiError(415,'Kies een JPG, PNG of WebP-afbeelding.','media_type');
 let output:Buffer;try{const image=sharp(bytes,{limitInputPixels:40_000_000,animated:false,failOn:'warning'}),metadata=await image.metadata();if(metadata.format!==(mime==='image/jpeg'?'jpeg':mime.slice(6))||!metadata.width||!metadata.height||metadata.width<16||metadata.height<16||metadata.width>10000||metadata.height>10000||(metadata.pages||1)>1)throw new Error();output=await image.rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).webp({quality:90}).toBuffer();}catch{throw new ApiError(400,'Deze afbeelding is niet veilig leesbaar of het bestandstype klopt niet.','invalid_image');}
 const db=await pool.connect(),id=randomUUID(),objectKey=randomBytes(32).toString('hex')+'.webp',path=resolve(options.uploadDir,objectKey);let written=false;
 try{await db.query('BEGIN');if(!(await db.query("SELECT club_id FROM castiq.workspaces WHERE club_id='__platform__' FOR UPDATE")).rowCount)throw new ApiError(503,'De centrale ontwerpomgeving is nog niet beschikbaar.','platform_unconfigured');const quota=Number((await db.query("SELECT COALESCE(sum(byte_size),0) AS bytes FROM castiq.media WHERE club_id='__platform__'")).rows[0].bytes);if(quota+output.length>512*1024*1024)throw new ApiError(413,'De centrale opslaglimiet is bereikt.','upload_quota');
  const metadata=await sharp(output).metadata(),sha256=createHash('sha256').update(output).digest('hex');await mkdir(options.uploadDir,{recursive:true,mode:0o700});await writeFile(path,output,{flag:'wx',mode:0o600});written=true;
  await db.query("INSERT INTO castiq.media(id,club_id,team,actor_id,object_key,mime,width,height,byte_size,content_sha256) VALUES($1,'__platform__','Centrale templates',$2,$3,'image/webp',$4,$5,$6,$7)",[id,actor.id,objectKey,metadata.width,metadata.height,output.length,sha256]);await db.query('COMMIT');return {id,url:'/api/template-media/'+id,width:metadata.width,height:metadata.height,mime:'image/webp',sha256};
 }catch(error){await db.query('ROLLBACK');if(written)await unlink(path);throw error;}finally{db.release();}
}
export async function readTemplateMedia(pool:pg.Pool,actor:Actor,path:string,options:TemplateMediaOptions){
 const id=/^\/api\/template-media\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/.exec(path)?.[1];if(!id)throw new ApiError(404,'Ontwerpafbeelding niet gevonden.','not_found');
 if(actor.role!=='platform'){
  const allowed=await pool.query(`SELECT 1 FROM castiq.templates t JOIN castiq.template_versions v ON v.template_id=t.id AND v.number=t.published_version
   WHERE t.enabled AND (t.audience='all' OR EXISTS(SELECT 1 FROM castiq.template_assignments a WHERE a.template_id=t.id AND a.club_id=$1))
   AND EXISTS(SELECT 1 FROM jsonb_each(v.layouts) format CROSS JOIN LATERAL jsonb_array_elements(format.value) layer WHERE layer->>'type'='image' AND layer->>'text'=$2 AND COALESCE(layer->>'binding','')='') LIMIT 1`,[actor.clubId,path]);
  if(!allowed.rowCount)throw new ApiError(404,'Ontwerpafbeelding niet gevonden.','not_found');
 }
 const row=(await pool.query("SELECT object_key,content_sha256 FROM castiq.media WHERE id=$1 AND club_id='__platform__'",[id])).rows[0];if(!row||! /^[a-f0-9]{64}\.webp$/.test(row.object_key))throw new ApiError(404,'Ontwerpafbeelding niet gevonden.','not_found');const bytes=await readFile(resolve(options.uploadDir,row.object_key));if(createHash('sha256').update(bytes).digest('hex')!==row.content_sha256)throw new ApiError(503,'De ontwerpafbeelding kon niet worden gecontroleerd.','media_integrity');return {bytes,contentType:'image/webp' as const};
}
