import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context=vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../public/feed-status.js',import.meta.url),'utf8'),context);
const F=context.PIPVORIA_FEED;
test('missing receive time does not show seconds since 1970',()=>{
  for(const receivedAt of [0,null,undefined,'bad']) {const value=F.read({receivedAt},1791320000000);assert.equal(value.age,null);assert.equal(value.stale,true);}
});
test('valid receive times preserve normal age and stale checks',()=>{
  assert.equal(F.read({receivedAt:100000},130000).age,30);
  assert.equal(F.read({receivedAt:100000},130000).stale,false);
  assert.equal(F.read({receivedAt:100000},230000).stale,true);
});
test('only public diagnostic codes can reach the feed text',()=>{
  assert.equal(F.read({feedError:'raw credential or provider response'}).reason,null);
  assert.equal(F.read({feedError:'provider_not_configured'}).reason,'provider_not_configured');
  assert.match(F.text('provider_not_configured','es'),/Twelve Data/);
  assert.match(F.text('waiting','de'),/Keine Daten/);
});
