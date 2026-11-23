import {useCallback,useEffect,useState} from 'react';
import {api} from './serverClient';
import {operationLabels,type OperationsData,type PlatformOperations} from './platformOperationsTypes';
export type LoadedOperations = {[K in keyof OperationsData]:OperationsData[K]|null};
const empty = ():LoadedOperations => ({jobs:null,registrations:null,privacy:null,mail:null,templates:null});
const sourceKeys=Object.keys(operationLabels) as (keyof OperationsData)[];
/** A failed source stays visibly stale; a valid zero is never substituted for an unavailable source. */
export function usePlatformOperations(enabled:boolean,scope:string) {
  const [data,setData]=useState<LoadedOperations>(empty),[errors,setErrors]=useState<string[]>([]);
  const [loading,setLoading]=useState(enabled),[updatedAt,setUpdatedAt]=useState<Date|null>(null),[request,setRequest]=useState(0);
  useEffect(()=>{setData(empty());setErrors([]);setUpdatedAt(null);},[scope,enabled]);
  useEffect(()=>{
    if(!enabled){setLoading(false);return;}
    let active=true;setLoading(true);
    void api<PlatformOperations>('/api/admin/operations').then(result=>{
      if(!active)return;
      const failed=sourceKeys.filter(key=>result.sources[key]?.status!=='ok');
      setData(previous=>{
        const next={...previous};
        for(const key of sourceKeys){const source=result.sources[key];if(source?.status==='ok')(next[key] as OperationsData[typeof key])=source.data;}
        return next;
      });
      setErrors(failed.map(key=>operationLabels[key]));
      if(failed.length<sourceKeys.length)setUpdatedAt(new Date());
    }).catch(()=>{if(active)setErrors(sourceKeys.map(key=>operationLabels[key]));}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[enabled,scope,request]);
  return {data,errors,loading,updatedAt,refresh:useCallback(()=>setRequest(value=>value+1),[])};
}
