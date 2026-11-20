import {mkdir, readFile, writeFile, access} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
await mkdir('.local', {recursive:true,mode:0o700});
async function exists(path) {try {await access(path);return true;} catch {return false;}}
if (!await exists('.env.local')) {
  if(await exists('.local/postgres.env')) throw new Error('Bestaande lokale databaseconfiguratie gevonden. Herstel .env.local uit je lokale backup; er wordt geen wachtwoord vervangen.');
  const password=randomBytes(32).toString('hex');
  await writeFile('.local/postgres.env', `POSTGRES_USER=castiq_local\nPOSTGRES_DB=castiq_local\nPOSTGRES_PASSWORD=${password}\n`, {mode:0o600,flag:'wx'});
  await writeFile('.env.local', `APP_ENV=local\nAUTH_MODE=local\nHOST=127.0.0.1\nPORT=4174\nCASTIQ_APP_ORIGIN=http://127.0.0.1:4173\nCASTIQ_DATA_MODE=server\nDATABASE_URL=postgresql://castiq_local:${password}@127.0.0.1:55439/castiq_local\nUPLOAD_DIR=.local/uploads\nPUBLICATION_MODE=sandbox\n`, {mode:0o600,flag:'wx'});
} else {
  const config=await readFile('.env.local','utf8');
  if(!/^APP_ENV=local$/m.test(config)||!/^AUTH_MODE=local$/m.test(config)||!/@127\.0\.0\.1:55439\/castiq_local$/m.test(config)) throw new Error('local:setup is uitsluitend voor de eigen lokale database. Bestaande configuratie blijft behouden.');
  if(!await exists('.local/postgres.env')) throw new Error('Lokale Dockerconfiguratie ontbreekt; herstel .local/postgres.env zonder bestaande credentials te vervangen.');
}
function run(cmd,args) {const result=spawnSync(cmd,args,{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);}
run('docker',['compose','-f','compose.local.yaml','up','-d','--wait']);
run(process.execPath,['--env-file=.env.local','database/migrate.ts']);
run(process.execPath,['--env-file=.env.local','database/seed.ts']);
console.log('Lokale database gereed. Start de website met npm run dev. Secrets zijn alleen in genegeerde lokale bestanden bewaard.');
