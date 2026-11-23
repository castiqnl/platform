import {createClient,type SupabaseClient} from '@supabase/supabase-js';
const url=String(import.meta.env.NEXT_PUBLIC_SUPABASE_URL||'').trim(),key=String(import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'').trim();
let configurationError='';
if(url||key){try{const parsed=new URL(url);if(parsed.protocol!=='https:'||!key.startsWith('sb_publishable_'))throw new Error();}catch{configurationError='De aanmelding is nog niet volledig geconfigureerd. Gebruik de project-URL en uitsluitend de publieke publishable key.';}}
export const authConfigurationError=configurationError;
export const authClient:SupabaseClient|null=url&&key&&!configurationError?createClient(url,key,{auth:{flowType:'pkce',detectSessionInUrl:true,persistSession:true,autoRefreshToken:true,storageKey:'castiq-auth-v1'}}):null;
export const googleAuthEnabled=Boolean(authClient);
export const authRedirect=()=>`${import.meta.env.CASTIQ_APP_ORIGIN||location.origin}${location.pathname}#/club/dashboard`;
export async function authorizationHeaders():Promise<Record<string,string>>{if(!authClient)return {};const {data,error}=await authClient.auth.getSession();if(error)throw new Error('Je sessie kon niet worden geladen. Meld opnieuw aan.');return data.session?.access_token?{Authorization:`Bearer ${data.session.access_token}`}:{ };}
export async function fetchPrivateImage(url:string,signal:AbortSignal,clubId?:string){if(!/^\/api\/(?:media|template-media)\/[a-f0-9-]{36}$/.test(url))throw new Error('Ongeldige mediareferentie.');const response=await fetch(url,{headers:{...await authorizationHeaders(),...(clubId?{'x-castiq-club-id':clubId}:{})},credentials:'same-origin',signal});if(!response.ok)throw new Error(response.status===401?'Meld opnieuw aan om deze foto te bekijken.':'Deze foto kon niet uit de clubomgeving worden geladen.');const blob=await response.blob();if(!blob.type.startsWith('image/'))throw new Error('De server gaf geen bruikbare afbeelding terug.');return blob;}
