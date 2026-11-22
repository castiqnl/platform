import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {LEGAL_DOCUMENTS} from '../shared/legalDocuments.ts';

const manifest = JSON.parse(await readFile(new URL('../public/legal/2026-11-22.1/manifest.json', import.meta.url), 'utf8'));
for (const [kind, document] of Object.entries(LEGAL_DOCUMENTS)) {
  const archived = await readFile(new URL(`../public${document.downloadPath}`, import.meta.url), 'utf8');
  const sha256 = createHash('sha256').update(archived).digest('hex');
  if (archived !== document.content || sha256 !== document.sha256 || manifest[kind].sha256 !== sha256) throw new Error(`Legal archive mismatch: ${kind}. Use a new version when an already offered text changes.`);
  if (/<!--|\[(?:GEVERIFIEERD|VESTIGINGSADRES|VERSIE EN|KVK-NUMMER)|Ã|Â·|â€/.test(archived)) throw new Error(`Unresolved publication text: ${kind}`);
  if (document.version !== '2026-11-22.1' || document.effectiveDate !== '2026-11-22') throw new Error(`Legal version mismatch: ${kind}`);
}
console.log('Three exact legal texts, downloads, versions and SHA-256 checks verified.');
