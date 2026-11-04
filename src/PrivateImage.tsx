import React,{useEffect,useState} from 'react';
import {useCastiq} from './store';
import {fetchPrivateImage} from './authClient';
type Resource={source:string;actor:string;url:string;status:'ready'|'loading'|'error';error?:string};
export function usePrivateImage(source?:string){const src=source||'',{authMode,actor}=useCastiq(),actorId=actor?.id||'',privateMedia=authMode==='supabase'&&src.startsWith('/api/media/');const[resource,setResource]=useState<Resource>({source:src,actor:actorId,url:privateMedia?'':src,status:privateMedia?'loading':'ready'});
 useEffect(()=>{if(!privateMedia){setResource({source:src,actor:actorId,url:src,status:'ready'});return;}const controller=new AbortController();let objectUrl='';setResource({source:src,actor:actorId,url:'',status:'loading'});void fetchPrivateImage(src,controller.signal).then(blob=>{if(controller.signal.aborted)return;objectUrl=URL.createObjectURL(blob);setResource({source:src,actor:actorId,url:objectUrl,status:'ready'});}).catch(e=>{if(!controller.signal.aborted)setResource({source:src,actor:actorId,url:'',status:'error',error:(e as Error).message});});return()=>{controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};},[src,actorId,privateMedia]);
 if(!privateMedia)return {url:src,status:'ready' as const,error:undefined};return resource.source===src&&resource.actor===actorId?resource:{url:'',status:'loading' as const,error:undefined};
}
export function PrivateImage({src,alt,...props}:React.ImgHTMLAttributes<HTMLImageElement>){const image=usePrivateImage(String(src||''));if(image.status==='error')return <span role="alert">{image.error}</span>;if(image.status==='loading')return <span role="status">Afbeelding laden…</span>;return <img src={image.url} alt={alt} {...props}/>;}
