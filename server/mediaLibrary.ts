import type pg from 'pg';
import type {Actor} from './fixtures.ts';
import {ApiError} from './workflow.ts';
const item=(row:any)=>({id:row.id,url:'/api/media/'+row.id,team:row.team,width:row.width,height:row.height,byteSize:Number(row.byte_size),createdAt:row.created_at,label:row.label,archived:row.archived,version:row.version});
export async function handleMediaLibrary(pool:pg.Pool,actor:Actor,input:{method:string;path:string;body?:any}){
 if(!input.path.startsWith('/api/club/media'))return null;if(actor.role==='platform')throw new ApiError(403,'Platformbeheer heeft geen toegang tot clubmedia.','forbidden');
 if(input.path==='/api/club/media'&&input.method==='GET'){const rows=await pool.query('SELECT id,team,width,height,byte_size,created_at,label,archived,version FROM castiq.media WHERE club_id=$1 AND ($2::text IS NULL OR team=$2) ORDER BY created_at DESC LIMIT 1000',[actor.clubId,actor.role==='team'?actor.team:null]);return {status:200,body:{media:rows.rows.map(item)}};}
 const match=/^\/api\/club\/media\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/.exec(input.path);if(!match||input.method!=='PATCH')return null;const data=input.body;
 if(!data||!Number.isInteger(data.expectedVersion)||typeof data.archived!=='boolean'||typeof data.label!=='string'||data.label.length>160||/[\u0000-\u001f<>]/.test(data.label))throw new ApiError(400,'Vul een geldige omschrijving, archiefkeuze en versie in.');
 const db=await pool.connect();try{await db.query('BEGIN');const row=(await db.query('SELECT * FROM castiq.media WHERE id=$1 AND club_id=$2 FOR UPDATE',[match[1],actor.clubId])).rows[0];if(!row||actor.role==='team'&&row.team!==actor.team)throw new ApiError(404,'Afbeelding niet gevonden.','not_found');if(row.version!==data.expectedVersion)throw new ApiError(409,'De afbeelding is gewijzigd. Herlaad voordat je opnieuw bewaart.','conflict');
 const saved=(await db.query('UPDATE castiq.media SET label=$1,archived=$2,version=version+1 WHERE id=$3 RETURNING *',[data.label.trim(),data.archived,row.id])).rows[0];await db.query('COMMIT');return {status:200,body:{media:item(saved)}};
 }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
}
