import {spawn} from 'node:child_process';
import {access} from 'node:fs/promises';
// CI supplies configuration through the environment; local setup keeps it in the ignored file.
try {await access('.env.local');} catch {if(!process.env.DATABASE_URL){console.error('Voer eerst npm run local:setup uit of stel de serverconfiguratie in.');process.exit(1);}}
const children=[];
let stopping=false;
function stop(code=0) {if(stopping)return;stopping=true;for(const child of children)child.kill('SIGTERM');process.exitCode=code;}
function start(args) {const child=spawn(process.execPath,args,{stdio:'inherit',env:process.env});children.push(child);child.on('exit',code=>stop(code||0));return child;}
start(['--env-file-if-exists=.env.local','server/index.ts']);
start(['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4173','--strictPort']);
process.on('SIGINT',()=>stop());
process.on('SIGTERM',()=>stop());
