import {createServer} from 'node:http';
import {createManagedPool,closeManagedPool} from './databasePool.ts';
import {createApplication} from './application.ts';
import {withStaticFiles} from './staticFiles.ts';
import {createReadiness} from './readiness.ts';
import {validateRuntimeConfiguration} from '../scripts/configuration.mjs';
const {configuration,errors}=validateRuntimeConfiguration(process.env);
if(errors.length)throw new Error(errors.join('\n'));
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL ontbreekt. Voer eerst lokale setup uit.');
if(process.env.AUTH_MODE!=='local'){
 for(const name of ['MAIL_ENCRYPTION_KEY','PRIVACY_LEDGER_HMAC_KEY','SUPABASE_ACCOUNT_OPERATIONS_KEY','PRIVACY_LEDGER_DIR'])if(!process.env[name])throw new Error(`${name} ontbreekt in de afgeschermde runtimeconfiguratie.`);
 if(!/^[a-f0-9]{64}$/i.test(process.env.MAIL_ENCRYPTION_KEY!))throw new Error('MAIL_ENCRYPTION_KEY moet een afzonderlijke 32-byte hexsleutel zijn.');
 if(Buffer.byteLength(process.env.PRIVACY_LEDGER_HMAC_KEY!)<32||Buffer.byteLength(process.env.SUPABASE_ACCOUNT_OPERATIONS_KEY!)<32)throw new Error('De afgeschermde account- en privacysleutels moeten minimaal 32 bytes bevatten.');
}
const host=process.env.HOST||'127.0.0.1',port=Number(process.env.PORT||4174);
const pool=createManagedPool({connectionString:process.env.DATABASE_URL,max:10,connectionTimeoutMillis:5000});
const uploadDir=process.env.UPLOAD_DIR||'.local/uploads';
const channelProviders=Object.fromEntries(['instagram','facebook','x'].map(provider=>{const prefix=provider.toUpperCase();return [provider,{clientId:process.env[prefix+'_CLIENT_ID']||'',clientSecret:process.env[prefix+'_CLIENT_SECRET']||'',approvedScopes:(process.env[prefix+'_APPROVED_SCOPES']||'').split(/[ ,]+/).filter(Boolean),apiVersion:process.env[prefix+'_API_VERSION']}];}));
const handler=createApplication({social:{encryptionKey:process.env.CHANNEL_TOKEN_ENCRYPTION_KEY,providers:channelProviders},pool,host,uploadDir,authMode:(process.env.AUTH_MODE||'supabase') as 'local'|'supabase',appEnv:process.env.APP_ENV,origin:configuration.CASTIQ_APP_ORIGIN,supabaseUrl:configuration.NEXT_PUBLIC_SUPABASE_URL,supabasePublishableKey:configuration.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,commit:process.env.RELEASE_SHA,publicationMode:process.env.PUBLICATION_MODE||'sandbox',readiness:createReadiness(pool,uploadDir,process.env.STATIC_DIR),mailEncryptionKey:process.env.MAIL_ENCRYPTION_KEY,privacyReferenceKey:process.env.PRIVACY_LEDGER_HMAC_KEY,privacyLedgerDir:process.env.PRIVACY_LEDGER_DIR,accountOperationsKey:process.env.SUPABASE_ACCOUNT_OPERATIONS_KEY});
const server=createServer(process.env.STATIC_DIR?withStaticFiles(process.env.STATIC_DIR,handler):handler);server.requestTimeout=30000;server.headersTimeout=10000;
server.listen(port,host,()=>console.log(`CASTIQ API actief op http://${host}:${port} (${process.env.APP_ENV||'staging'}, uitsluitend sandboxpublicaties)`));
let closing=false;
for(const signal of ['SIGTERM','SIGINT'] as const)process.on(signal,()=>{if(closing)return;closing=true;server.close(()=>{void closeManagedPool(pool).then(()=>process.exit(0),()=>process.exit(1));});});
