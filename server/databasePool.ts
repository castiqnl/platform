import pg from 'pg';
export type PoolError=Error&{code?:string};
type PoolLifecycle={clients:Set<pg.PoolClient>;waiters:Set<()=>void>};
const lifecycles=new WeakMap<pg.Pool,PoolLifecycle>();
export function logPoolError(error:PoolError,component='postgres-pool'){
 const code=typeof error.code==='string'&&/^[a-zA-Z0-9_]{1,32}$/.test(error.code)?error.code:'database_error';
 console.error(JSON.stringify({level:'error',component,code}));
}
/** pg already discards the failed idle client before emitting `error`; the next query reconnects. */
export function createManagedPool(config:pg.PoolConfig,onIdleError:(error:PoolError)=>void=logPoolError){
 const pool=new pg.Pool(config),lifecycle:PoolLifecycle={clients:new Set(),waiters:new Set()};
 lifecycles.set(pool,lifecycle);
 pool.on('connect',client=>lifecycle.clients.add(client));
 pool.on('remove',client=>{lifecycle.clients.delete(client);if(!lifecycle.clients.size){for(const resolve of lifecycle.waiters)resolve();lifecycle.waiters.clear();}});
 pool.on('error',onIdleError);
 return pool;
}
/** Pool.end can resolve before client socket close callbacks. Wait for public `remove` events too. */
export async function closeManagedPool(pool:pg.Pool){
 const lifecycle=lifecycles.get(pool);if(!lifecycle)throw new Error('Gebruik createManagedPool voor gecontroleerde databaseafsluiting.');
 await pool.end();
 if(lifecycle.clients.size)await new Promise<void>(resolve=>lifecycle.waiters.add(resolve));
}
