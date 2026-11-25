import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {deferredRoute} from './links.mjs';
import {generateStatic} from './static.mjs';

test('generator CLI → customer-owned static HTML → shop/referrer + associations; no runtime dependencies',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'blinklinks-static-')),out=join(dir,'site');
 const cfg=JSON.parse(await readFile(new URL('./static.example.json',import.meta.url)));
 const s=createServer(async(req,res)=>{
  const file=req.url==='/'?'index.html':req.url.slice(1);
  if(!['index.html','p/42.html','.well-known/apple-app-site-association','.well-known/assetlinks.json'].includes(file)){res.writeHead(404).end();return;}
  res.setHeader('content-type',file.startsWith('.well-known/')?'application/json':'text/html');
  res.end(await readFile(join(out,file)));
 });
 try{
  assert.match(execFileSync(process.execPath,['static.mjs','static.example.json',out],{encoding:'utf8'}),/No network resource/);
  await assert.rejects(generateStatic(cfg,out),/EEXIST/);
  await assert.rejects(generateStatic({...cfg,linkHost:'https://a.example.com/path'},join(dir,'bad')),/Invalid linkHost/);
  await assert.rejects(generateStatic({...cfg,productIds:['../secret']},join(dir,'bad-id')),/Invalid productId/);
  s.listen(0,'127.0.0.1');await once(s,'listening');
  const origin='http://127.0.0.1:'+s.address().port;
  const home=await (await fetch(origin)).text();
  const href=home.match(/href="(\/p\/42\.html)"/)[1];
  const fallback=await (await fetch(origin+href)).text();
  assert.doesNotMatch(home+fallback,/<script|<img|bridgeeme|amazonaws|telemetry/i);
  assert.match(fallback,/Original link: reopen manually/);
  const play=new URL(fallback.match(/href="(https:\/\/play.google.com[^"]+)"/)[1].replaceAll('&amp;','&'));
  assert.deepEqual(deferredRoute(play.searchParams.get('referrer'),cfg.linkHost),{screen:'product',id:'42'});
  assert.equal(deferredRoute(play.searchParams.get('referrer'),'https://another.example.com'),null);
  const aasa=await (await fetch(origin+'/.well-known/apple-app-site-association')).json();
  const appLinks=await (await fetch(origin+'/.well-known/assetlinks.json')).json();
  assert.equal(aasa.applinks.details[0].appID,cfg.iosTeam+'.'+cfg.iosBundle);
  assert.equal(appLinks[0].target.sha256_cert_fingerprints[0],cfg.androidSigningSHA256);
 }finally{
  if(s.listening)await new Promise(r=>s.close(r));
  await rm(dir,{recursive:true,force:true});
 }
});
