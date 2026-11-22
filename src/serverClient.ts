import {authorizationHeaders} from './authClient';
import type {AppState,Role} from './store';
export type Actor={id:string;name:string;role:Role;clubId:string;team?:string};
export type LocalAccount=Actor&{clubName?:string};
export type AccountIdentity={id:string;email?:string;status:string;deadline?:string|null;registeredAt?:string|null;lastConsciousAt?:string|null;reliableActivity?:boolean;transitionPending?:boolean;deletionReason?:string|null;recoverable?:boolean};
export type LegalStatus={documents:{kind:string;version:string;sha256:string;effectiveDate:string}[];acceptances:{kind:string;version:string;sha256:string;scope:string;club_id:string|null;accepted_at:string}[]};
export type SessionEnvelope={actor:Actor|null;identity:AccountIdentity|null;memberships:LocalAccount[];legal:LegalStatus|null;environment:string;authMode:'local'|'supabase';accounts:LocalAccount[]};
export type WorkspaceEnvelope={state:AppState;version:number;actor:Actor;result?:any};
export class ServerError extends Error{code:string;status:number;constructor(message:string,code:string,status:number){super(message);this.code=code;this.status=status;}}
export const dataMode:'demo'|'server'=(import.meta.env.CASTIQ_DATA_MODE==='demo'||(import.meta.env.DEV&&new URLSearchParams(location.search).get('demo')==='1'))?'demo':'server';
let selectedClubId:string|null=null;
/** The API rechecks this selection against the authenticated user's memberships. */
export function selectClubHeader(clubId:string|null){selectedClubId=clubId;}
export async function api<T>(path:string,options:RequestInit={}):Promise<T>{
 const requestClubId=selectedClubId;
 let response:Response;try{response=await fetch(path,{...options,credentials:'same-origin',headers:{...await authorizationHeaders(),...(requestClubId?{'x-castiq-club-id':requestClubId}:{}),...(options.body instanceof Blob?{}:{'Content-Type':'application/json'}),...options.headers}});}catch{throw new ServerError('Geen verbinding met de clubomgeving. Je invoer blijft beschikbaar. Controleer de verbinding en probeer opnieuw.','offline',0);}
 let body:any;try{body=await response.json();}catch{throw new ServerError('De server gaf geen bruikbaar antwoord. Er is niets als bewaard bevestigd.','invalid_response',response.status);}
 if(!response.ok)throw new ServerError(body.error||'De aanvraag is niet gelukt.',body.code||'request_failed',response.status);return body as T;
}
