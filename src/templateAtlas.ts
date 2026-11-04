import {useEffect,useState} from 'react';

// Each source contains nine separate transparent artwork frames. Only the two
// chromatic artwork masks are recolored; photos, alpha and neutral materials
// never pass through this transformation.
const sources=new Map<number,Promise<ImageData>>();
const colored=new Map<string,Promise<string>>();
const ready=new Map<string,string>();
const sourceUrl=(atlas:number)=>`/assets/template-atlas-${atlas}${atlas===3?'-v2':''}.png`;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
function rgb(hex:string){const h=/^#[0-9a-f]{6}$/i.test(hex)?hex:'#2463eb';return [1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);}
function hsl(r:number,g:number,b:number){const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;let h=0,s=0;if(d){s=d/(1-Math.abs(2*l-1));h=max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;h=((h*60)+360)%360;}return [h,s,l];}
function fromHsl(h:number,s:number,l:number){const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;let a=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return a.map(v=>Math.round((v+m)*255));}
function source(atlas:number){if(!sources.has(atlas))sources.set(atlas,new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx){reject(new Error('Canvas niet beschikbaar'));return;}ctx.drawImage(img,0,0);resolve(ctx.getImageData(0,0,canvas.width,canvas.height));};img.onerror=()=>reject(new Error('Templatebeeld niet beschikbaar'));img.src=sourceUrl(atlas);}));return sources.get(atlas)!;}
export async function getTemplateAtlas(atlas:number,primary:string,secondary:string){
 const key=`${atlas}|${primary.toLowerCase()}|${secondary.toLowerCase()}`;
 if(!colored.has(key))colored.set(key,(async()=>{
  const original=await source(atlas),out=new ImageData(new Uint8ClampedArray(original.data),original.width,original.height),p=hsl(...rgb(primary) as [number,number,number]),s=hsl(...rgb(secondary) as [number,number,number]);
  const d=out.data;
  for(let i=0;i<d.length;i+=4){if(d[i+3]<3)continue;const r=d[i]/255,g=d[i+1]/255,b=d[i+2]/255,max=Math.max(r,g,b),min=Math.min(r,g,b);if(max-min<.055)continue;
   // Royal blue is primary, magenta secondary. Warm wood/foil/film stays intact.
   const blue=b-r>.055&&b-g>-.025;
   const pixel=i/4,cell=Math.floor((pixel%out.width)/out.width*3)+3*Math.floor(Math.floor(pixel/out.width)/out.height*3);
   const redAccent=atlas===3&&[2,7,8].includes(cell)&&r-g>.12&&r-b>.1;
   const pink=r-g>.075&&b-g>.025&&r>b*.72||redAccent;
   if(!blue&&!pink)continue;
   const [h,sat,l]=hsl(r,g,b);if(blue&&!pink&&(h<195||h>285)||pink&&h<285&&!redAccent)continue;
   const target=pink?s:p,weight=clamp((sat-.08)/.35),baseLight=.54;
   // Preserve highlights and sculptural shadows, using the club tone as midtone.
   const targetLight=l<=baseLight?target[2]*l/baseLight:target[2]+(1-target[2])*(l-baseLight)/(1-baseLight);
   const next=fromHsl(target[0],target[1]*Math.min(1,sat/.7),clamp(targetLight));
   d[i]=Math.round(d[i]*(1-weight)+next[0]*weight);d[i+1]=Math.round(d[i+1]*(1-weight)+next[1]*weight);d[i+2]=Math.round(d[i+2]*(1-weight)+next[2]*weight);
  }
  const canvas=document.createElement('canvas');canvas.width=out.width;canvas.height=out.height;canvas.getContext('2d')!.putImageData(out,0,0);
  const url=canvas.toDataURL('image/png');ready.set(key,url);
  while(ready.size>12){const oldest=ready.keys().next().value!;ready.delete(oldest);colored.delete(oldest);}
  return url;
 })().catch(error=>{colored.delete(key);throw error;}));
 return colored.get(key)!;
}
export function useTemplateAtlas(atlas:number,primary:string,secondary:string){
 const key=`${atlas}|${primary.toLowerCase()}|${secondary.toLowerCase()}`;
 const [result,setResult]=useState<{key:string,url:string}>(()=>({key,url:ready.get(key)||sourceUrl(atlas)}));
 useEffect(()=>{let active=true;getTemplateAtlas(atlas,primary,secondary).then(url=>{if(active)setResult({key,url});}).catch(()=>{if(active)setResult({key,url:sourceUrl(atlas)});});return()=>{active=false;};},[key,atlas,primary,secondary]);
 return result.key===key?result.url:ready.get(key)||sourceUrl(atlas);
}
