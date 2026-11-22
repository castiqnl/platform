/// <reference types="vite/client" />
interface ImportMetaEnv {
 readonly CASTIQ_APP_ORIGIN:string;
 readonly CASTIQ_DATA_MODE:'supabase'|'server'|'demo';
 readonly NEXT_PUBLIC_SUPABASE_URL:string;
 readonly NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:string;
}
