import pg from 'pg';
import {seedFixtures} from '../server/fixtures.ts';
if(process.env.APP_ENV!=='local'||process.env.AUTH_MODE!=='local')throw new Error('Fictieve accounts mogen alleen met APP_ENV=local en AUTH_MODE=local worden aangemaakt.');
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL ontbreekt');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
try {await seedFixtures(pool);console.log('Drie fictieve pilotclubs beschikbaar; bestaande gegevens behouden.');} finally{await pool.end();}
