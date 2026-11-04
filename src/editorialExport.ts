import {getTemplateAtlas} from './templateAtlas';
import {getTemplate} from './templateCatalog';
import {posterFormats,type PosterFormat} from './Poster';
let fontCss:Promise<string>|undefined;
function dataUrl(blob:Blob){return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Bestand kon niet worden ingesloten.'));reader.readAsDataURL(blob);});}
async function embedFonts(){if(!fontCss)fontCss=Promise.all([
 ['Inter','400','font-6f9490582c2ac6f7.woff2'],['Inter','600 900','font-3100e775e8616cd2.woff2'],['Barlow Condensed','600','font-215a93c696f44203.woff2'],['Barlow Condensed','700','font-3787a5a419171630.woff2'],['Barlow Condensed','800 900','font-2515494e8cc2ca07.woff2'],['DejaVu Serif','400 500','editorial-serif-regular.woff2'],['DejaVu Serif','600 900','editorial-serif-bold.woff2']
].map(async([family,weight,file])=>{const response=await fetch('/assets/'+file);if(!response.ok)throw new Error('Een lettertype voor de export ontbreekt.');const uri=await dataUrl(await response.blob());return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};src:url('${uri}') format('woff2');font-display:block;}`;})).then(css=>css.join('')).catch(error=>{fontCss=undefined;throw error;});return fontCss;}
/** Export the exact visible approved-data SVG, with its real bitmap overlay and selected photo. */
export async function downloadEditorialPng(svg:SVGSVGElement,options:{family:string;primary:string;secondary:string;format:PosterFormat;name:string}){
 await document.fonts.ready;
 const template=getTemplate(options.family),atlas=template?await getTemplateAtlas(template.atlas,options.primary,options.secondary):undefined;
 const clone=svg.cloneNode(true) as SVGSVGElement;
 if(atlas)clone.querySelectorAll('[data-layer-group="effectoverlay"] image').forEach(image=>image.setAttribute('href',atlas));
 const dimension=posterFormats[options.format];clone.setAttribute('width',String(dimension.w));clone.setAttribute('height',String(dimension.h));clone.removeAttribute('style');clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
 const style=document.createElementNS('http://www.w3.org/2000/svg','style');style.textContent=await embedFonts();const defs=clone.querySelector('defs')||clone;defs.insertBefore(style,defs.firstChild);
 for(const img of Array.from(clone.querySelectorAll('image'))){const src=img.getAttribute('href');if(src&&!src.startsWith('data:')){const response=await fetch(src);if(!response.ok)throw new Error('Een afbeelding voor de export kon niet worden geladen.');img.setAttribute('href',await dataUrl(await response.blob()));}}
 const markup=new XMLSerializer().serializeToString(clone),url=URL.createObjectURL(new Blob([markup],{type:'image/svg+xml;charset=utf-8'}));
 try{const image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('Het ontwerp kon niet naar PNG worden omgezet.'));image.src=url;});const canvas=document.createElement('canvas');canvas.width=dimension.w;canvas.height=dimension.h;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Deze browser ondersteunt geen afbeeldingsexport.');ctx.drawImage(image,0,0,dimension.w,dimension.h);const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('De PNG kon niet worden aangemaakt.');const pngUrl=URL.createObjectURL(blob),a=document.createElement('a');a.href=pngUrl;a.download=`CASTIQ-${options.name.replace(/[^a-zA-Z0-9-]/g,'-').slice(0,80)}-${dimension.w}x${dimension.h}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(pngUrl),2000);}finally{URL.revokeObjectURL(url)}
}
