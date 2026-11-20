/// <reference types="vite/client" />
interface ImportMetaEnv {
 readonly CASTIQ_APP_ORIGIN:string;
 readonly CASTIQ_DATA_MODE:'server'|'demo';
 readonly NEXT_PUBLIC_SUPABASE_URL:string;
 readonly NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:string;
 readonly VITE_AUTH_GOOGLE_ENABLED:'true'|'false';
}
