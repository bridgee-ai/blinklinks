import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {aasa,assetlinks,destinations} from './links.mjs';
const host='https://links.example.com';
export function fixtureServer(){
 return createServer((req,res)=>{
  const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'"};
  function send(status,mime,body){res.writeHead(status,{...headers,'Content-Type':mime});res.end(req.method==='HEAD'?undefined:body);}
  if(!['GET','HEAD'].includes(req.method)){send(405,'text/plain','Method not allowed');return;}
  if(req.url==='/'){send(200,'text/html; charset=utf-8','<!doctype html><html lang="en"><title>BlinkLinks</title><h1>BlinkLinks local example</h1><p>Mock store and web destinations; no account, JavaScript or tracking.</p><a href="/p/42">Try link /p/42</a></html>');return;}
  if(req.url==='/.well-known/apple-app-site-association'){send(200,'application/json',JSON.stringify(aasa));return;}
  if(req.url==='/.well-known/assetlinks.json'){send(200,'application/json',JSON.stringify(assetlinks));return;}
  const target=destinations(host+req.url);
  if(!target){send(404,'text/plain','Not found');return;}
  // All href values are generated from fixed origins and an allowlisted numeric route.
  send(200,'text/html; charset=utf-8','<!doctype html><html lang="en"><title>BlinkLinks fallback</title><h1>Choose where to continue</h1><ul>'+[['Web',target.web],['Google Play (fixture)',target.android],['App Store (fixture)',target.ios]].map(([label,url])=>'<li><a href="'+url.replaceAll('&','&amp;')+'">'+label+'</a></li>').join('')+'</ul><p>On iPhone, after installing, reopen the original link from the message or scan the original QR again.</p></html>');
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const server=fixtureServer();
 server.listen(8789,'127.0.0.1',()=>console.log('http://127.0.0.1:8789/'));
}
