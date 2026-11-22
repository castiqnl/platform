import {createHmac,randomUUID} from 'node:crypto';
import {mkdir,readFile,rename,writeFile,unlink,open,readdir} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {afterDays,validInstant} from './privacyTime.ts';
export type LedgerEntry={reference:string;scope:'personal_account';blockedAt:string;status:'blocked'|'completed'|'recovered';completedAt?:string;expiresAt?:string;result?:string};
export interface DeletionLedger{read():Promise<LedgerEntry[]>;put(entry:LedgerEntry):Promise<void>;prune(now:string):Promise<number>;}
export type FileLedgerOptions={continuityPath?:string;environmentId?:string};
type Continuity={version:1;ledgerId:string;environmentId:string;initializedAt:string};
const unavailable=(reason:string)=>new Error('Onafhankelijk wisregister niet beschikbaar: '+reason+'. Herstel blijft in quarantaine.');
function paths(directory:string,options:FileLedgerOptions){const dir=resolve(directory);return {dir,path:join(dir,'deletion-ledger.json'),continuityPath:resolve(options.continuityPath||dir+'.continuity.json'),lock:join(dir,'.write.lock')};}
function continuity(value:any):Continuity{if(value?.version!==1||typeof value.ledgerId!=='string'||!/^[-a-f0-9]{36}$/.test(value.ledgerId)||typeof value.environmentId!=='string'||!value.environmentId||typeof value.initializedAt!=='string')throw unavailable('ongeldig continuïteitsbewijs');validInstant(value.initializedAt);return value;}
export function privacyReference(actorId:string,key:string){if(Buffer.byteLength(key)<32)throw new Error('Privacyreferenties vereisen een aparte sleutel van minimaal 32 bytes.');return createHmac('sha256',key).update('castiq-person-v1\0'+actorId).digest('hex');}
/** Root/operator only: independently verify a new empty deletion scope before invoking. Never recover a lost ledger by initializing. */
export async function initializeFileDeletionLedger(directory:string,options:FileLedgerOptions&{environmentId:string;confirmedEmptyScope:true}){
 if(options.confirmedEmptyScope!==true||!options.environmentId||!/^[a-zA-Z0-9_./:-]{1,100}$/.test(options.environmentId))throw unavailable('nieuwe lege omgeving is niet expliciet bevestigd');
 const {dir,path,continuityPath}=paths(directory,options);
 try{await readFile(continuityPath);throw unavailable('continuïteitsbewijs bestaat al; initialisatie geweigerd');}catch(error){if((error as any).code!=='ENOENT')throw error;}
 try{if((await readdir(dir)).length)throw unavailable('registermap is niet leeg; initialisatie geweigerd');}catch(error){if((error as any).code!=='ENOENT')throw error;}
 await mkdir(dir,{recursive:true,mode:0o700});
 const marker:Continuity={version:1,ledgerId:randomUUID(),environmentId:options.environmentId,initializedAt:new Date().toISOString()};
 // Marker first: an interrupted initialization is visibly incomplete, never silently retried as a new register.
 await writeFile(continuityPath,JSON.stringify(marker),{mode:0o600,flag:'wx'});
 const markerHandle=await open(continuityPath,'r');await markerHandle.sync();await markerHandle.close();const markerParent=await open(dirname(continuityPath),'r');await markerParent.sync();await markerParent.close();
 await writeFile(path,JSON.stringify({version:2,ledgerId:marker.ledgerId,environmentId:marker.environmentId,initializedAt:marker.initializedAt,entries:[]}),{mode:0o600,flag:'wx'});
 const dataHandle=await open(path,'r');await dataHandle.sync();await dataHandle.close();
 const directoryHandle=await open(dir,'r');await directoryHandle.sync();await directoryHandle.close();
 return {ledgerId:marker.ledgerId,environmentId:marker.environmentId,continuityPath};
}
/** Root-owned continuity marker must sit outside the app-writable ledger directory and ordinary product backups. */
export function createFileDeletionLedger(directory:string,options:FileLedgerOptions={}):DeletionLedger{
 const {dir,path,lock,continuityPath}=paths(directory,options);
 async function readDocument(){let marker:Continuity,document:any;try{marker=continuity(JSON.parse(await readFile(continuityPath,'utf8')));document=JSON.parse(await readFile(path,'utf8'));}catch(error){throw unavailable((error as any).code==='ENOENT'?'register of continuïteitsbewijs ontbreekt':'onleesbaar register of continuïteitsbewijs');}
  if(document.version!==2||document.ledgerId!==marker.ledgerId||document.environmentId!==marker.environmentId||document.initializedAt!==marker.initializedAt||!Array.isArray(document.entries)||(options.environmentId&&marker.environmentId!==options.environmentId))throw unavailable('continuïteit of omgeving komt niet overeen');
  const seen=new Set<string>();for(const entry of document.entries){if(!entry||!/^[a-f0-9]{64}$/.test(entry.reference)||seen.has(entry.reference)||entry.scope!=='personal_account'||!['blocked','completed','recovered'].includes(entry.status))throw unavailable('ongeldige wisreferentie');seen.add(entry.reference);validInstant(entry.blockedAt);if(entry.status==='completed'){if(!entry.completedAt||entry.expiresAt!==afterDays(entry.completedAt,210))throw unavailable('ongeldige uiterste bewijsdatum');}else if(entry.status==='recovered'&&(!entry.expiresAt||!Number.isFinite(Date.parse(entry.expiresAt))))throw unavailable('ongeldige hersteldatum');}
  return document as {version:2;ledgerId:string;environmentId:string;initializedAt:string;entries:LedgerEntry[]};
 }
 async function read(){return (await readDocument()).entries;}
 async function change(mutator:(entries:LedgerEntry[])=>LedgerEntry[]){let owned=false;let temp:string|undefined;try{const handle=await open(lock,'wx',0o600);owned=true;await handle.close();const current=await readDocument();const next=mutator(current.entries);temp=join(dir,'.ledger-'+randomUUID()+'.tmp');await writeFile(temp,JSON.stringify({...current,entries:next}),{mode:0o600,flag:'wx'});const sync=await open(temp,'r');await sync.sync();await sync.close();await rename(temp,path);temp=undefined;const directoryHandle=await open(dir,'r');await directoryHandle.sync();await directoryHandle.close();}finally{if(temp)await unlink(temp).catch(()=>{});if(owned)await unlink(lock);}}
 return {read,async put(entry){if(!/^[a-f0-9]{64}$/.test(entry.reference))throw new Error('Ongeldige wisreferentie.');validInstant(entry.blockedAt);await change(entries=>{const old=entries.find(e=>e.reference===entry.reference);if(old?.status==='completed'&&entry.status!=='completed')throw new Error('Definitieve wissing is onomkeerbaar.');if(old?.completedAt&&entry.completedAt!==old.completedAt)throw new Error('Herhaling mag het wisbewijs niet verlengen.');return [...entries.filter(e=>e.reference!==entry.reference),{...entry,...(entry.completedAt?{expiresAt:afterDays(entry.completedAt,210)}:{})}];});},async prune(now){let count=0;await change(entries=>entries.filter(entry=>{const due=entry.expiresAt&&Date.parse(entry.expiresAt)<=Date.parse(now);if(due)count++;return !due;}));return count;}};
}
export async function verifyRestoreLedger(ledger:DeletionLedger,backupCreatedAt:string,now:string){if(Date.parse(now)>=Date.parse(afterDays(backupCreatedAt,180)))throw new Error('Back-up is 180 dagen oud; herstel wordt geweigerd.');const entries=await ledger.read();return entries.filter(entry=>entry.status!=='recovered'&&(!entry.expiresAt||Date.parse(entry.expiresAt)>Date.parse(now)));}
