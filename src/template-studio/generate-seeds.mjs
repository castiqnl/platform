// Rebuild the server initializer from the exact existing SVG composition source.
// No hand-written approximation and no browser storage participate in this file.
import {build} from 'esbuild';
import {mkdir, writeFile, rm} from 'node:fs/promises';
const root = new URL('../../', import.meta.url);
const scratch = new URL('node_modules/.cache/castiq-template-seeds.mjs', root);
await mkdir(new URL('./', scratch), {recursive: true});
const result = await build({entryPoints: [new URL('./managedTemplates.ts', import.meta.url).pathname], bundle: true, platform: 'node', format: 'esm', packages: 'external', write: false});
await writeFile(scratch, result.outputFiles[0].contents);
try {
  const module = await import(scratch.href + '?build=' + Date.now());
  const templates = module.managedTemplates.state.templates.map(template => ({
    ...template,
    variants: Object.fromEntries(Object.keys(module.repoPostTypes).map(type => [type, module.sourceLayouts(template.family, type)])),
  }));
  const content = JSON.stringify(templates) + '\n';
  const target = new URL('./builtin-templates.json', import.meta.url);
  if (process.argv.includes('--check')) {
    const {readFile} = await import('node:fs/promises');
    if (await readFile(target, 'utf8') !== content) throw new Error('Template-initialisatie wijkt af van de SVG-bron. Genereer de seeds opnieuw.');
  } else await writeFile(target, content);
} finally {await rm(scratch, {force: true});}
