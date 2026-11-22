import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
const headers={'Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers});
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return reply(405,{error:'method_not_allowed'});
 try{
  const key=req.headers.get('x-castiq-operations-key')||'';
  if(key.length<32||key.length>256)return reply(401,{error:'unauthorized'});
  const raw=await req.text();if(raw.length>2048)return reply(413,{error:'too_large'});
  const input=JSON.parse(raw),operation=input.operation,actorId=input.actorId;
  if(!['ensure_admin','revoke_sessions','delete_identity'].includes(operation))return reply(400,{error:'invalid_operation'});
  if(operation!=='ensure_admin'&&(typeof actorId!=='string'||!/^[-a-f0-9]{36}$/.test(actorId)))return reply(400,{error:'invalid_actor'});
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key)))).map(x=>x.toString(16).padStart(2,'0')).join('');
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const authorization=await admin.rpc('castiq_authorize_account_operation',{p_key_sha256:digest,p_operation:operation,p_actor_id:operation==='ensure_admin'?null:actorId});
  if(authorization.error||authorization.data!==true)return reply(403,{error:'operation_not_authorized'});
  if(operation==='revoke_sessions')return reply(200,{confirmed:true,actorId,operation});
  if(operation==='delete_identity'){
   const deleted=await admin.auth.admin.deleteUser(actorId);
   if(deleted.error&&deleted.error.status!==404)return reply(503,{error:'identity_deletion_unconfirmed'});
   return reply(200,{confirmed:true,actorId,operation});
  }
  // Bootstrap is fixed to the owner's explicitly authorized address, never arbitrary users.
  const email='info@dgwebservices.nl';
  const created=await admin.auth.admin.createUser({email,email_confirm:true});
  if(created.data.user)return reply(200,{confirmed:true,actorId:created.data.user.id,operation});
  // Idempotent retry without enumerating or exposing any other account.
  for(let page=1;page<=20;page++){
   const listed=await admin.auth.admin.listUsers({page,perPage:100});
   if(listed.error)return reply(503,{error:'administrator_unconfirmed'});
   const user=listed.data.users.find(u=>u.email?.toLowerCase()===email);
   if(user)return reply(200,{confirmed:true,actorId:user.id,operation});
   if(listed.data.users.length<100)break;
  }
  return reply(503,{error:'administrator_unconfirmed'});
 }catch{return reply(503,{error:'account_operation_unconfirmed'});}
});
