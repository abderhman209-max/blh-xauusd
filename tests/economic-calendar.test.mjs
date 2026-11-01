import {test} from 'node:test';import assert from 'node:assert/strict';
import {CALENDAR,newsWindow,nextNews} from '../lib/economic-calendar.js';
const nfp=Date.parse('2026-11-06T13:30:00Z');
test('high-impact releases pause the agent 30 minutes on each side, other releases never do',()=>{
  for(const offset of [-30,-1,0,29,30])assert.equal(newsWindow(nfp+offset*60000)?.name,'Emploi américain · octobre',String(offset));
  for(const offset of [-31,31])assert.equal(newsWindow(nfp+offset*60000),null);
  assert.equal(newsWindow(Date.parse('2026-11-13T13:30:00Z')),null,'PPI is listed but not high impact');
});
test('a plan that is still open at a release is warned about it',()=>{
  assert.equal(nextNews(nfp-3*3600000,nfp-3600000),null);
  assert.equal(nextNews(nfp-3*3600000,nfp-20*60000).name,'Emploi américain · octobre');
  assert.equal(nextNews(nfp+60000,nfp+3600000),null);
});
test('every calendar entry is dated, sourced and in order',()=>{
  for(const e of CALENDAR)assert.ok(Number.isFinite(Date.parse(e.at))&&e.name&&e.url.startsWith('https://')&&e.source);
  assert.deepEqual(CALENDAR.map(e=>e.at),[...CALENDAR.map(e=>e.at)].sort());
});
