import {build} from 'esbuild';
// Reuse the actual browser SVG composition. The server supplies frozen bindings
// and embeds checked assets; no browser, network access or alternate template.
await build({entryPoints:['server/publicationPoster.tsx'],outfile:'server/generated/posterRenderer.mjs',bundle:true,platform:'node',format:'esm',target:'node24',external:['react','react-dom/server'],logLevel:'warning'});
