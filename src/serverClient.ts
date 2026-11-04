import {authorizationHeaders} from './authClient';
import type {AppState,Role} from './store';
export type Actor={id:string;name:string;role:Role;clubId:string;team?:string};
export type LocalAccount=Actor&{clubName?:string};
export type WorkspaceEnvelope={state:AppState;version:number;actor:Actor;result?:any};
export class ServerError extends Error{code:string;status:number;constructor(message:string,code:string,status:number){super(message);this.code=code;this.status=status;}}
export const dataMode:'demo'|'server'=((import.meta as any).env?.VITE_DATA_MODE==='demo'||new URLSearchParams(location.search).get('demo')==='1')?'demo':'server';
export async function api<T>(path:string,options:RequestInit={}):Promise<T>{
 let response:Response;try{response=await fetch(path,{...options,credentials:'same-origin',headers:{...await authorizationHeaders(),...(options.body instanceof Blob?{}:{'Content-Type':'application/json'}),...options.headers}});}catch{throw new ServerError('Geen verbinding met de clubomgeving. Je invoer blijft beschikbaar. Controleer de verbinding en probeer opnieuw.','offline',0);}
 let body:any;try{body=await response.json();}catch{throw new ServerError('De server gaf geen bruikbaar antwoord. Er is niets als bewaard bevestigd.','invalid_response',response.status);}
 if(!response.ok)throw new ServerError(body.error||'De aanvraag is niet gelukt.',body.code||'request_failed',response.status);return body as T;
}
