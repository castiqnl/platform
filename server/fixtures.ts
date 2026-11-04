import type pg from 'pg';
import {normalizeContent} from '../src/v1Workflow.ts';
export type Actor={id:string;name:string;role:'club'|'team'|'platform';clubId:string;team?:string};
export const fixtureAccounts: (Actor&{clubName:string})[]=[
 {id:'getijde-club',name:'Fictieve clubredactie · Getijde',role:'club',clubId:'cl1',clubName:'SC Getijde'},
 {id:'getijde-team',name:'Fictieve manager O14 · Getijde',role:'team',clubId:'cl1',team:'O14-1',clubName:'SC Getijde'},
 {id:'getijde-o10',name:'Fictieve manager O10 · Getijde',role:'team',clubId:'cl1',team:'O10-1',clubName:'SC Getijde'},
 {id:'havenlicht-club',name:'Fictieve clubredactie · Havenlicht',role:'club',clubId:'cl2',clubName:'FC Havenlicht'},
 {id:'havenlicht-team',name:'Fictieve manager O14 · Havenlicht',role:'team',clubId:'cl2',team:'O14-1',clubName:'FC Havenlicht'},
 {id:'noordhaven-club',name:'Fictieve clubredactie · Noordhaven',role:'club',clubId:'cl3',clubName:'SV Noordhaven'},
 {id:'noordhaven-team',name:'Fictieve manager O14 · Noordhaven',role:'team',clubId:'cl3',team:'O14-1',clubName:'SV Noordhaven'},
 {id:'noordhaven-o10',name:'Fictieve manager O10 · Noordhaven',role:'team',clubId:'cl3',team:'O10-1',clubName:'SV Noordhaven'},
 {id:'platform',name:'Fictief platformbeheer',role:'platform',clubId:'__platform__',clubName:'Platform'}
];
export function fixtureState(index:number) {
 const clubs=[{id:'cl1',name:'SC Getijde',color:'#2463eb',accent:'#ffffff'},{id:'cl2',name:'FC Havenlicht',color:'#c82333',accent:'#111111'},{id:'cl3',name:'SV Noordhaven',color:'#17844d',accent:'#ddbb55'}];
 const club={...clubs[index],hashtags:`#${clubs[index].name.replace(/\s/g,'')}`,youthNames:index===2?'Anoniem':'Voornaam + initiaal',plan:'Lokale pilot',trial:false,timeZone:'Europe/Amsterdam',fictional:true};
 const teams=['Eerste elftal','O14-1','O10-1'].map((name,n)=>({id:`${club.id}-t${n+1}`,name,category:n?'Jeugd':'Senioren',manager:'Fictieve vrijwilliger',family:'Penseelkracht',active:true,publishScores:name!=='O10-1',namePolicy:index===2?'anonymous':'initials'}));
 const matches=[{id:`${club.id}-m1`,home:club.name,away:clubs[(index+1)%3].name,team:'O14-1',date:'2026-11-07',time:'10:30',location:'Fictief sportpark',status:'finished',homeScore:3,awayScore:2,sourceVersion:1,source:'Handmatig · fictieve pilotdata'}, {id:`${club.id}-m2`,home:clubs[(index+1)%3].name,away:club.name,team:'Eerste elftal',date:'2026-11-07',time:'14:30',location:'Fictief sportpark',status:'scheduled',homeScore:0,awayScore:0,sourceVersion:1,source:'Handmatig · fictieve pilotdata'}, {id:`${club.id}-m3`,home:club.name,away:clubs[(index+2)%3].name,team:'O10-1',date:'2026-11-07',time:'09:00',location:'Fictief sportpark',status:'finished',homeScore:2,awayScore:1,sourceVersion:1,source:'Handmatig · fictieve pilotdata'}];
 const content=[normalizeContent({id:`${club.id}-c1`,clubId:club.id,matchId:matches[0].id,title:'Samen voor het team',team:'O14-1',type:'Wedstrijdverslag',version:1,status:'review',caption:'Een mooie wedstrijd met inzet en samenspel. Samen voor het team!',date:'2026-11-07T12:00:00+01:00',author:'Fictieve teammanager',image:'/assets/team-celebration.webp',photoUsage:'photo',photoConsent:'approved',namePolicy:index===2?'anonymous':'initials',scoreConfirmed:true,homeScore:3,awayScore:2,opponent:matches[0].away,family:'Penseelkracht',jobs:[],feedback:'',sourceVersion:1})];
 return {activeMatchId:matches[0].id,club,teams,matches,content,players:[],users:[],events:[],clubs:[{...club,teams:teams.length,status:'Fictieve pilot',contact:''}],connections:[{name:'Instagram',handle:'Niet gekoppeld · sandbox beschikbaar',connected:false},{name:'Facebook',handle:'Niet gekoppeld · sandbox beschikbaar',connected:false},{name:'X',handle:'Niet gekoppeld · sandbox beschikbaar',connected:false},{name:'Sportlink',handle:'Niet gekoppeld',connected:false}],rules:{},activity:[],templateRequests:[],customTemplates:[],v1:{drafts:{},sponsorAgreements:[],weekPlans:[],weekendReports:[],audit:[],publicationPaused:false}};
}
export async function seedFixtures(pool:pg.Pool) {
 for(let i=0;i<3;i++){const state=fixtureState(i);await pool.query('INSERT INTO castiq.workspaces(club_id,state) VALUES($1,$2) ON CONFLICT DO NOTHING',[state.club.id,JSON.stringify(state)]);}
 for(const actor of fixtureAccounts)await pool.query('INSERT INTO castiq.memberships(actor_id,club_id,actor_name,role,team) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[actor.id,actor.clubId,actor.name,actor.role,actor.team||null]);
}
