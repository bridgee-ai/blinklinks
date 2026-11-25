import {mkdir,readFile,realpath,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

function validate(c){
 const need=(re,value,name)=>{if(typeof value!=='string'||!re.test(value))throw Error('Invalid '+name);return value;};
 const origin=name=>{
  let u;try{u=new URL(c[name]);}catch{throw Error('Invalid '+name);}
  need(/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+$/,c[name],name);
  if(u.origin!==c[name]||u.hostname.endsWith('.localhost')||/^\d+(?:\.\d+){3}$/.test(u.hostname))throw Error('Invalid '+name);
  return u.origin;
 };
 const bundle=/^[A-Za-z][0-9A-Za-z_]*(?:\.[A-Za-z][0-9A-Za-z_]*)+$/;
 if(!Array.isArray(c.productIds)||!c.productIds.length||c.productIds.length>10000||new Set(c.productIds).size!==c.productIds.length)throw Error('Invalid productIds');
 return {linkHost:origin('linkHost'),webHost:origin('webHost'),
  iosTeam:need(/^[A-Z0-9]{10}$/,c.iosTeam,'iosTeam'),iosBundle:need(bundle,c.iosBundle,'iosBundle'),
  iosStoreId:need(/^[1-9][0-9]{4,14}$/,c.iosStoreId,'iosStoreId'),
  androidPackage:need(bundle,c.androidPackage,'androidPackage'),
  androidSigningSHA256:need(/^(?:[A-Fa-f0-9]{2}:){31}[A-Fa-f0-9]{2}$/,c.androidSigningSHA256,'androidSigningSHA256').toUpperCase(),
  productIds:c.productIds.map(id=>need(/^[1-9][0-9]{0,9}$/,id,'productId'))};
}
const esc=x=>x.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
function html(title,body){return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; base-uri \'none\'"><title>'+title+'</title><h1>'+title+'</h1>'+body+'</html>\n';}

export async function generateStatic(config,destination){
 const c=validate(config),path=resolve(destination);
 // Fresh output only: no chance to keep obsolete routes or overwrite a customer checkout.
 const root=join(await realpath(resolve(path,'..')),path.split('/').at(-1));
 await mkdir(root,{recursive:false});
 await mkdir(join(root,'.well-known'));
 await mkdir(join(root,'p'));
 await writeFile(join(root,'.well-known/apple-app-site-association'),JSON.stringify({
  applinks:{apps:[],details:[{appID:c.iosTeam+'.'+c.iosBundle,paths:['/p/*']}]}
 })+'\n');
 await writeFile(join(root,'.well-known/assetlinks.json'),JSON.stringify([{
  relation:['delegate_permission/common.handle_all_urls'],
  target:{namespace:'android_app',package_name:c.androidPackage,sha256_cert_fingerprints:[c.androidSigningSHA256]}
 }])+'\n');
 // Explicit .html URLs avoid host-dependent directory slash rewrites breaking app association.
 const routes=[];
 for(const id of c.productIds){
  const file='/p/'+id+'.html',canonical=c.linkHost+file;
  const web=c.webHost+'/products/'+id,ios='https://apps.apple.com/app/id'+c.iosStoreId;
  const android='https://play.google.com/store/apps/details?'+new URLSearchParams({
   id:c.androidPackage,referrer:new URLSearchParams({blink_link:canonical}).toString()
  });
  const anchors=[[web,'Continue on the web'],[android,'Install from Google Play'],[ios,'Open App Store'],[canonical,'Original link: reopen manually after iOS install']];
  await writeFile(join(root,file),html('Continue to product '+id,
   '<ul>'+anchors.map(([href,label])=>'<li><a href="'+esc(href)+'" rel="noreferrer">'+label+'</a></li>').join('')+'</ul>'));
  routes.push(file);
 }
 await writeFile(join(root,'index.html'),html('BlinkLinks navigation',
  '<ul>'+routes.map(r=>'<li><a href="'+r+'">'+r+'</a></li>').join('')+'</ul>'));
 // Optional host metadata, understood by compatible static platforms only.
 await writeFile(join(root,'_headers'),'/.well-known/apple-app-site-association\n  Content-Type: application/json\n/.well-known/assetlinks.json\n  Content-Type: application/json\n');
 return routes;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==4)throw Error('Usage: node static.mjs CONFIG.json NEW_OUTPUT_DIRECTORY');
 const cfg=JSON.parse(await readFile(process.argv[2],'utf8'));
 const routes=await generateStatic(cfg,process.argv[3]);
 console.log('Generated '+routes.length+' static link(s). No network resource was created.');
}
