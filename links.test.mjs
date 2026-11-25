import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {fixtureServer} from './server.mjs';
import {publicRoute,deferredRoute,destinations} from './links.mjs';
const link='https://links.example.com/p/42';
test('installed app input/universal links: exact canonical host and route only',()=>{
 assert.deepEqual(publicRoute(link),{screen:'product',id:'42'});
 for(const s of [link+'?next=x',link+'#go',link+'/',link+'\n','https://attacker.example/p/42','https://links.example.com.evil.example/p/42','https://links.example.com/p/%34%32','http://links.example.com/p/42'])assert.equal(publicRoute(s),null,s);
});
test('Android referrer round trip preserves public route; iOS fallback has explicit continuation only',()=>{
 const d=destinations(link),store=new URL(d.android),referrer=store.searchParams.get('referrer');
 assert.equal(store.hostname,'play.google.com');
 assert.deepEqual(deferredRoute(referrer),{screen:'product',id:'42'});
 assert.equal(deferredRoute(referrer+'&'+referrer),null);
 assert.equal(deferredRoute('blink_link=https://invalid.example/p/42'),null);
 assert.equal(new URL(d.ios).search,'');
 assert.equal(d.iosManualContinuation,link);
});
test('HTTP homepage entry → product link → fallback and association docs without account',async()=>{
 const s=fixtureServer();s.listen(0,'127.0.0.1');await once(s,'listening');
 const origin='http://127.0.0.1:'+s.address().port;
 try{
  const home=await (await fetch(origin)).text(),path=home.match(/href="(\/p\/42)"/)[1];
  const r=await fetch(origin+path,{redirect:'manual'});assert.equal(r.status,200);
  const body=await r.text();assert.match(body,/https:\/\/apps.apple.com/);assert.match(body,/https:\/\/play.google.com/);assert.match(body,/https:\/\/www.example.com\/products\/42/);assert.match(body,/reopen the original link from the message/);assert.ok(!body.includes('href="'+link+'"'));
  for(const f of ['apple-app-site-association','assetlinks.json']){
   const a=await fetch(origin+'/.well-known/'+f,{redirect:'manual'});assert.equal(a.status,200);assert.equal(a.headers.get('content-type'),'application/json');assert.ok(await a.json());
  }
  assert.equal((await fetch(origin+path+'?next=evil')).status,404);
  assert.equal((await fetch(origin+path,{method:'POST'})).status,405);
 }finally{await new Promise(r=>s.close(r));}
});
