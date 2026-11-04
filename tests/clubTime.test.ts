import test from 'node:test';
import assert from 'node:assert/strict';
import {parseClubLocalTime,formatClubTime} from '../src/clubTime.ts';

test('Amsterdam winter and summer planning produces the correct absolute instant',()=>{
 assert.equal(parseClubLocalTime('2026-01-17T10:30'),'2026-01-17T09:30:00.000Z');
 assert.equal(parseClubLocalTime('2026-07-18T10:30'),'2026-07-18T08:30:00.000Z');
 assert.equal(formatClubTime('2026-01-17T09:30:00.000Z'),'2026-01-17T10:30');
 assert.equal(formatClubTime('2026-07-18T08:30:00.000Z'),'2026-07-18T10:30');
});

test('the 2026 Amsterdam spring gap is rejected with a recoverable message',()=>{
 assert.equal(parseClubLocalTime('2026-03-29T01:59'),'2026-03-29T00:59:00.000Z');
 assert.throws(()=>parseClubLocalTime('2026-03-29T02:00'),/bestaat niet.*zomertijd/);
 assert.throws(()=>parseClubLocalTime('2026-03-29T02:59'),/bestaat niet.*zomertijd/);
 assert.equal(parseClubLocalTime('2026-03-29T03:00'),'2026-03-29T01:00:00.000Z');
});

test('the 2026 Amsterdam autumn overlap requires a deliberate offset or a different time',()=>{
 assert.throws(()=>parseClubLocalTime('2026-10-25T02:30'),/twee keer.*wintertijd/);
 assert.equal(parseClubLocalTime('2026-10-25T02:30+02:00'),'2026-10-25T00:30:00.000Z');
 assert.equal(parseClubLocalTime('2026-10-25T02:30:00+01:00'),'2026-10-25T01:30:00.000Z');
 assert.throws(()=>parseClubLocalTime('2026-10-25T02:30+03:00'),/offset hoort niet/);
 assert.equal(parseClubLocalTime('2026-10-25T03:00'),'2026-10-25T02:00:00.000Z');
});

test('the explicit club timezone controls planning across device timezone settings',()=>{
 const previous=process.env.TZ;
 try{for(const deviceZone of ['UTC','America/Los_Angeles','Asia/Tokyo']){
  process.env.TZ=deviceZone;
  assert.equal(parseClubLocalTime('2026-07-18T10:30','Europe/Amsterdam'),'2026-07-18T08:30:00.000Z');
  assert.equal(formatClubTime('2026-07-18T08:30:00Z','Europe/Amsterdam'),'2026-07-18T10:30');
  assert.equal(parseClubLocalTime('2026-07-18T10:30','America/New_York'),'2026-07-18T14:30:00.000Z');
 }}finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});

test('invalid calendar dates, empty input and invalid zones are rejected without normalization',()=>{
 for(const input of ['','2026-02-29T10:00','2026-04-31T10:00','2026-00-01T10:00','2026-13-01T10:00','2026-01-00T10:00','2026-01-17T24:00','2026-01-17T10:60','2026-01-17T10:30:60','2026-01-17','2026-01-17 10:30'])assert.throws(()=>parseClubLocalTime(input));
 assert.equal(parseClubLocalTime('2028-02-29T10:00'),'2028-02-29T09:00:00.000Z');
 assert.throws(()=>parseClubLocalTime('2026-01-17T10:30','Invalid/Zone'),/clubtijdzone/);
 assert.throws(()=>parseClubLocalTime('2026-01-17T10:30+01:60'),/offset/);
 assert.throws(()=>formatClubTime('2026-01-17T10:30'),/tijdzone/);
 assert.throws(()=>formatClubTime('2026-02-30T10:30Z'),/bestaat niet/);
});

test('non-hour timezone offsets and exact seconds are preserved',()=>{
 assert.equal(parseClubLocalTime('2026-07-18T10:30','Asia/Kathmandu'),'2026-07-18T04:45:00.000Z');
 assert.equal(parseClubLocalTime('2026-07-18T10:30:45.123'),'2026-07-18T08:30:45.123Z');
 assert.equal(formatClubTime('2026-07-18T10:30:00+05:45','Asia/Kathmandu'),'2026-07-18T10:30');
 assert.equal(parseClubLocalTime('2026-01-17T10:30Z','UTC'),'2026-01-17T10:30:00.000Z');
});
