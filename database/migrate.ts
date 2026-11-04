import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
export async function migrate(pool:pg.Pool){
 const db=await pool.connect();
 try{
  await db.query("SELECT pg_advisory_lock(hashtext('castiq-migrations'))");
  await db.query('CREATE SCHEMA IF NOT EXISTS castiq');await db.query('REVOKE ALL ON SCHEMA castiq FROM PUBLIC');
  await db.query('CREATE TABLE IF NOT EXISTS castiq.migration_history(name text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
  await db.query('REVOKE ALL ON castiq.migration_history FROM PUBLIC');
  for(const name of (await readdir(new URL('./migrations/',import.meta.url))).filter(f=>/^\d+.*\.sql$/.test(f)).sort()){
   const sql=await readFile(new URL('./migrations/'+name,import.meta.url),'utf8');const checksum=createHash('sha256').update(sql).digest('hex');
   const prior=await db.query('SELECT sha256 FROM castiq.migration_history WHERE name=$1',[name]);
   if(prior.rowCount){if(prior.rows[0].sha256!==checksum)throw new Error(`Migratie ${name} wijkt af van de toegepaste versie. Gebruik een nieuwe migratie.`);continue;}
   await db.query('BEGIN');try{await db.query(sql.replace(/^BEGIN;\s*/, '').replace(/COMMIT;\s*$/, ''));await db.query('INSERT INTO castiq.migration_history(name,sha256) VALUES($1,$2)',[name,checksum]);await db.query('COMMIT');}catch(error){await db.query('ROLLBACK');throw error;}
  }
 }finally{await db.query("SELECT pg_advisory_unlock(hashtext('castiq-migrations'))");db.release();}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL ontbreekt');const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});try{await migrate(pool);console.log('Database schema bijgewerkt.');}finally{await pool.end();}}
