import type {IncomingMessage,ServerResponse} from 'node:http';
import {readFile,realpath,stat} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';

const types:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf'};

/** Only the sealed frontend output is public. API/media always keep their own authorization. */
export function withStaticFiles(directory:string,api:(req:IncomingMessage,res:ServerResponse)=>Promise<void>){
 let root:string|undefined;
 return async(req:IncomingMessage,res:ServerResponse)=>{
  let path:string;
  try{path=decodeURIComponent(new URL(req.url||'/','http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
  if(path==='/api'||path.startsWith('/api/')){await api(req,res);return;}
  const deny=()=>{res.writeHead(404,{'Cache-Control':'no-store'});res.end();};
  if(!['GET','HEAD'].includes(req.method||'GET')){res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return;}
  if(path.includes('\\')||path.includes('\0')||path.split('/').some(p=>p.startsWith('.'))){deny();return;}
  try{root||=await realpath(resolve(directory));}catch{deny();return;}
  let target=resolve(root,'.'+path);
  if(!target.startsWith(root+sep)&&target!==root){deny();return;}
  try{
   try{if((await stat(target)).isDirectory())target=resolve(target,'index.html');await stat(target);}catch{
    // Hash navigation is used today; allow ordinary SPA routes without hiding missing assets.
    if(extname(path)||path.startsWith('/assets/')){deny();return;}
    target=resolve(root,'index.html');
   }
   const canonical=await realpath(target);
   if(!canonical.startsWith(root+sep)||(await stat(canonical)).isDirectory()){deny();return;}
   const content=await readFile(canonical),extension=extname(canonical);
   res.writeHead(200,{'Content-Type':types[extension]||'application/octet-stream','Content-Length':content.length,'Cache-Control':extension==='.html'?'no-store':'public, max-age=3600','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Robots-Tag':'noindex, nofollow'});
   res.end(req.method==='HEAD'?undefined:content);
  }catch{deny();}
 };
}
