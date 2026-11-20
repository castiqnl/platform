import {access,readFile,readdir} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import type pg from 'pg';

export function createReadiness(pool:pg.Pool,uploadDir:string,staticDir?:string){
 return async()=>{
  try{
   const migrations=new URL('../database/migrations/',import.meta.url);
   const expected=await Promise.all((await readdir(migrations)).filter(name=>/^\d+.*\.sql$/.test(name)).map(async name=>[name,createHash('sha256').update(await readFile(new URL(name,migrations))).digest('hex')]));
   const applied=await pool.query('SELECT name,sha256 FROM castiq.migration_history');
   const known=new Map(applied.rows.map(row=>[row.name,row.sha256]));
   if(expected.some(([name,hash])=>known.get(name)!==hash))return false;
   await access(uploadDir,constants.R_OK|constants.W_OK);
   if(staticDir)await access(resolve(staticDir,'index.html'),constants.R_OK);
   return true;
  }catch{return false;}
 };
}
