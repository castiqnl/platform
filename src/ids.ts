/** Local demo identifiers also work in an HTTP preview. Server records need server-issued IDs. */
export function newId():string{
 if(typeof globalThis.crypto?.randomUUID==='function')return globalThis.crypto.randomUUID();
 if(typeof globalThis.crypto?.getRandomValues==='function'){
  const bytes=globalThis.crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const h=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
 }
 return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
