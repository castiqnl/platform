import {defineConfig,loadEnv} from 'vite';
import {publicConfigurationNames,validateBuildConfiguration} from './scripts/configuration.mjs';
export default defineConfig(({mode})=>{
const environment={...loadEnv(mode,process.cwd(),''),...process.env};
const {configuration,errors}=validateBuildConfiguration(environment);
if(errors.length)throw new Error(errors.join('\n'));
const define=Object.fromEntries(publicConfigurationNames.map(name=>[`import.meta.env.${name}`,JSON.stringify(configuration[name])]));
// Google is an optional local compatibility switch, never an additional GitHub variable.
define['import.meta.env.VITE_AUTH_GOOGLE_ENABLED']=JSON.stringify(environment.VITE_AUTH_GOOGLE_ENABLED||'false');
return {envPrefix:[],define,server:{host:'127.0.0.1',port:4173,strictPort:true,watch:{ignored:['**/playwright-report/**','**/test-results/**','**/docs/evidence/**','**/.local/**']},allowedHosts:['terminal.local'],proxy:{'/api':{target:'http://127.0.0.1:4174',changeOrigin:false}}},preview:{host:'127.0.0.1',port:4173,strictPort:true,proxy:{'/api':{target:'http://127.0.0.1:4174',changeOrigin:false}}},build:{rollupOptions:{output:{manualChunks(id){if(id.includes('node_modules')){if(id.includes('/@supabase/')||id.includes('/iceberg-js/'))return 'auth-vendor';if(id.includes('framer-motion')||id.includes('motion-dom')||id.includes('motion-utils')||id.includes('/motion/'))return 'motion';if(id.includes('lucide-react'))return 'icons';if(id.includes('/react/')||id.includes('/react-dom/')||id.includes('/scheduler/'))return 'react-vendor'}}},onwarn(warning,warn){if(warning.code==='MODULE_LEVEL_DIRECTIVE'&&warning.message.includes('use client'))return;warn(warning)}}}};});
