import {ApiError} from './workflow.ts';

/** The service credential remains in Supabase. This client can only request scoped account operations. */
export function createAccountOperations(options:{supabaseUrl?:string;key?:string;fetch?:typeof fetch}){
 async function invoke(operation:'revoke_sessions'|'delete_identity',actorId:string){
  if(!options.supabaseUrl||!options.key)throw new ApiError(503,'De beveiligde accountafhandeling is nog niet geconfigureerd.','account_operations_unconfigured');
  if(!/^[a-f0-9-]{36}$/i.test(actorId))throw new Error('invalid_account_identity');
  const target=new URL('/functions/v1/castiq-account-operations',options.supabaseUrl);
  if(target.protocol!=='https:')throw new Error('account_operations_requires_https');
  let response:Response;
  try{response=await (options.fetch||fetch)(target,{method:'POST',headers:{'Content-Type':'application/json','x-castiq-operations-key':options.key},body:JSON.stringify({operation,actorId}),signal:AbortSignal.timeout(15000),redirect:'error'});}catch{throw new ApiError(503,'De accountactie is nog niet bevestigd. De aanvraag blijft bewaard voor een nieuwe poging.','account_operation_unconfirmed');}
  if(!response.ok)throw new ApiError(503,'De identiteitsdienst heeft de accountactie niet bevestigd.','account_operation_unconfirmed');
  const result=await response.json().catch(()=>null);
  if(result?.confirmed!==true||result?.actorId!==actorId||result?.operation!==operation)throw new ApiError(503,'Een passende bevestiging van de accountactie ontbreekt.','account_operation_unconfirmed');
 }
 return {revokeIdentitySessions:(actorId:string)=>invoke('revoke_sessions',actorId),deleteIdentity:(actorId:string)=>invoke('delete_identity',actorId)};
}
