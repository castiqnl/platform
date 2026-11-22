import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {LEGAL_DOCUMENTS, legalDocumentReferences} from '../shared/legalDocuments.ts';

test('offered legal text, static archive and acceptance proof are byte-for-byte identical', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/legal/2026-11-22.1/manifest.json', import.meta.url), 'utf8'));
  for (const [kind, document] of Object.entries(LEGAL_DOCUMENTS)) {
    const archived = await readFile(new URL(`../public${document.downloadPath}`, import.meta.url), 'utf8');
    assert.equal(archived, document.content, kind);
    assert.equal(createHash('sha256').update(archived).digest('hex'), document.sha256, kind);
    assert.equal(manifest[kind].sha256, document.sha256);
    assert.equal(document.version, '2026-11-22.1');
    assert.equal(document.effectiveDate, '2026-11-22');
    assert.doesNotMatch(archived, /<!--|\[(?:GEVERIFIEERD|VESTIGINGSADRES|VERSIE EN|KVK-NUMMER)|Ã|Â·|â€/, kind);
    assert.match(archived, /DG Webservices/);
    assert.match(archived, /Den Haag/);
    assert.match(archived, /88135713/);
    assert.match(archived, /info@dgwebservices\.nl/);
  }
});

test('personal and club evidence refer to distinct document scopes without privacy consent', () => {
  assert.deepEqual(legalDocumentReferences(['terms']), [{kind: 'terms', version: LEGAL_DOCUMENTS.terms.version, sha256: LEGAL_DOCUMENTS.terms.sha256}]);
  assert.deepEqual(legalDocumentReferences(['terms', 'processor']).map(document => document.kind), ['terms', 'processor']);
  assert.ok(!legalDocumentReferences(['terms', 'processor']).some(document => document.kind === 'privacy'));
});

test('supplied source bytes are independently archived with provenance hashes', async () => {
  const manifest = JSON.parse(await readFile(new URL('../docs/legal/sources/manifest.json', import.meta.url), 'utf8'));
  for (const source of Object.values(manifest) as {path: string; sha256: string}[]) {
    const bytes = await readFile(new URL('../' + source.path, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sha256);
  }
});
