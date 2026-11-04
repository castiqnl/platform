import test from 'node:test';
import assert from 'node:assert/strict';
import {fixtureState,type Actor} from '../server/fixtures.ts';
import {mutate} from '../server/workflow.ts';
const actor:Actor={id:'getijde-club',name:'Fictieve clubredactie',role:'club',clubId:'cl1'};
const noDatabase:any={query:()=>{throw new Error('Deze tijdtest hoort geen databasequery te doen.');}};

test('server-generated clubweek and weekend timestamps respect Amsterdam winter and summer',async()=>{
 for(const fixture of [
  {date:'2026-01-17',week:'2026-01-12',match:'2026-01-17T09:30:00.000Z',weekend:'2026-01-18T17:00:00.000Z'},
  {date:'2026-07-18',week:'2026-07-13',match:'2026-07-18T08:30:00.000Z',weekend:'2026-07-19T16:00:00.000Z'}
 ]){
  const state:any=fixtureState(0);state.content=[];state.matches=[{...state.matches[0],date:fixture.date,time:'10:30'}];
  const generated=await mutate(noDatabase,state,actor,'week.generate',{week:fixture.week,teams:['O14-1'],types:['Matchday']});assert.equal(generated.state.content[0].date,fixture.match);
  const overview=await mutate(noDatabase,generated.state,actor,'weekend.generate',{week:fixture.week,teams:['O14-1'],intro:'Fictief weekend',includeScores:true});assert.equal(overview.state.content.find((item:any)=>item.origin==='weekend').date,fixture.weekend);
 }
});

test('server rejects impossible period dates and nonexistent source kickoff times with recoverable errors',async()=>{
 const state:any=fixtureState(0);
 for(const week of ['2026-02-30','2026-04-31','0000-01-01'])await assert.rejects(mutate(noDatabase,state,actor,'week.generate',{week,teams:['O14-1'],types:['Matchday']}),(error:any)=>error.status===400&&/geldige datum/.test(error.message));
 await assert.rejects(mutate(noDatabase,state,actor,'sponsor.save',{agreement:{name:'Fictief',start:'2026-02-30',end:'2026-12-31',teams:[],types:[],target:1,frequency:'month',active:true,priority:1}}),(error:any)=>error.status===400);
 state.content=[];state.matches=[{...state.matches[0],date:'2026-03-29',time:'02:30'}];
 await assert.rejects(mutate(noDatabase,state,actor,'week.generate',{week:'2026-03-23',teams:['O14-1'],types:['Matchday']}),(error:any)=>error.status===400&&/zomertijd/.test(error.message));
});

test('an away win and score correction preserve fixture order in generated content',async()=>{
 const state:any=fixtureState(0);state.content=[];state.matches=[{...state.matches[0],home:'FC Havenlicht',away:'SC Getijde',homeScore:1,awayScore:3,status:'finished'}];
 const generated=await mutate(noDatabase,state,actor,'week.generate',{week:'2026-11-02',teams:['O14-1'],types:['Einduitslag']});const item=generated.state.content[0];
 assert.equal(item.fixtureLabel,'FC Havenlicht × SC Getijde');assert.equal(item.homeScore,1);assert.equal(item.awayScore,3);assert.match(item.caption,/FC Havenlicht – SC Getijde: 1 – 3/);
 const corrected=await mutate(noDatabase,generated.state,actor,'match.correct',{id:state.matches[0].id,home:2,away:3,reason:'Fictieve scorecorrectie'});const updated=corrected.state.content[0],match=corrected.state.matches[0];
 assert.equal(match.home,'FC Havenlicht');assert.equal(match.away,'SC Getijde');assert.equal(match.homeScore,2);assert.equal(match.awayScore,3);assert.equal(updated.fixtureLabel,'FC Havenlicht × SC Getijde');assert.equal(updated.homeScore,2);assert.equal(updated.awayScore,3);assert.match(updated.caption,/FC Havenlicht – SC Getijde: 2–3/);assert.equal(updated.scoreCorrectionReason,'Fictieve scorecorrectie');assert.equal(updated.sourceVersion,match.sourceVersion);
});
