import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const manifest=JSON.parse(await readFile(root+'docs/ASSET-MANIFEST.json','utf8'));
for(const item of manifest.assets){
 const bytes=await readFile(root+item.path);
 if(bytes.length!==item.bytes||createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw new Error('Asset wijkt af: '+item.path);
}
console.log(`${manifest.assets.length} assets gecontroleerd; alle SHA-256 hashes kloppen.`);
