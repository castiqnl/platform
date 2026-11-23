import {useEffect,useState} from 'react';
import {fetchPrivateImage} from '../authClient';
import {useCastiq} from '../store';
export function useTemplateImages(sources:string[]){
 const {actor}=useCastiq(),urls=[...new Set(sources.filter(source=>typeof source==='string'&&source.startsWith('/api/template-media/')))].sort(),signature=JSON.stringify([actor?.id||'',actor?.clubId||'',urls]);
 const [images,setImages]=useState<{signature:string;values:Record<string,string>;status:'ready'|'loading'|'error';error?:string}>({signature:'',values:{},status:'ready'});
 useEffect(()=>{if(!urls.length){setImages({signature,values:{},status:'ready'});return;}const controller=new AbortController(),allocated:string[]=[];setImages({signature,values:{},status:'loading'});void Promise.all(urls.map(async url=>{const blob=await fetchPrivateImage(url,controller.signal,actor?.clubId);if(controller.signal.aborted)return [url,''];const objectUrl=URL.createObjectURL(blob);allocated.push(objectUrl);return [url,objectUrl];})).then(entries=>{if(!controller.signal.aborted)setImages({signature,values:Object.fromEntries(entries),status:'ready'});}).catch(error=>{if(!controller.signal.aborted)setImages({signature,values:{},status:'error',error:error.message||'Een ontwerpafbeelding kon niet worden geladen.'});});return()=>{controller.abort();allocated.forEach(url=>URL.revokeObjectURL(url));};},[signature]);
 const current=images.signature===signature?images:{values:{},status:urls.length?'loading':'ready',error:undefined};
 return {status:current.status,error:current.error,resolve:(source:string)=>source?.startsWith('/api/template-media/')?current.values[source]||'':source};
}
