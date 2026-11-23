import {createHash} from 'node:crypto';
/** PostgreSQL JSONB reorders object keys. Provider payload verification must
 * compare canonical JSON instead of serializing incidental JS insertion order. */
function canonical(value:any):any {
 if(Array.isArray(value))return value.map(value=>value===undefined?null:canonical(value));
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,canonical(value[key])]));
 return value;
}
export function canonicalPayloadHash(value:any){return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');}
export function verifyPublicationPayload(job:any){return !!job?.payload&&(job.providerPayloadHash?canonicalPayloadHash(job.payload)===job.providerPayloadHash:createHash('sha256').update(JSON.stringify(job.payload)).digest('hex')===job.contentHash);}
