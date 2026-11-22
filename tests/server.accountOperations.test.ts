import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAccountOperations} from '../server/accountOperations.ts';
const actor='11111111-1111-4111-8111-111111111111';
test('account operations only confirm the matching authorized identity and operation',async()=>{
 const calls:any[]=[];const client=createAccountOperations({supabaseUrl:'https://test.supabase.co',key:'a'.repeat(64),fetch:async(url,request)=>{calls.push({url:String(url),request});const body=JSON.parse(request.body as string);return Response.json({confirmed:true,...body});}});
 await client.revokeIdentitySessions(actor);await client.deleteIdentity(actor);
 assert.equal(calls.length,2);assert.equal(calls[0].url,'https://test.supabase.co/functions/v1/castiq-account-operations');
 assert.equal(calls[0].request.headers['x-castiq-operations-key'],'a'.repeat(64));assert.equal(calls[1].request.redirect,'error');
 for(const response of [{confirmed:false,actorId:actor,operation:'delete_identity'},{confirmed:true,actorId:'other',operation:'delete_identity'},{confirmed:true,actorId:actor,operation:'revoke_sessions'}]){
  const wrong=createAccountOperations({supabaseUrl:'https://test.supabase.co',key:'a'.repeat(64),fetch:async()=>Response.json(response)});
  await assert.rejects(wrong.deleteIdentity(actor),error=>(error as any).code==='account_operation_unconfirmed');
 }
});
test('missing credentials, non-HTTPS, provider outage and invalid identities fail closed',async()=>{
 await assert.rejects(createAccountOperations({}).deleteIdentity(actor));
 await assert.rejects(createAccountOperations({supabaseUrl:'http://test.invalid',key:'a'.repeat(64)}).deleteIdentity(actor));
 const client=createAccountOperations({supabaseUrl:'https://test.supabase.co',key:'a'.repeat(64),fetch:async()=>{throw new Error('sensitive upstream body');}});
 await assert.rejects(client.deleteIdentity(actor),error=>(error as any).code==='account_operation_unconfirmed'&&!(error as Error).message.includes('sensitive'));
 await assert.rejects(client.deleteIdentity('invalid'));
});
