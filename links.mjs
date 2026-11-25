const host='https://links.example.com';
const content='https://www.example.com';
const route=/^\/p\/([1-9][0-9]{0,9})(?:\.html)?$/;
const android='com.example.links';
const ios='com.example.links';
const iosAppId='1234567890';
export function publicRoute(value,origin=host){
 if(typeof value!=='string'||value.length>128||!value.startsWith(origin+'/p/'))return null;
 const match=route.exec(value.slice(origin.length));
 return match?{screen:'product',id:match[1]}:null;
}
export function deferredRoute(referrer,origin=host){
 if(typeof referrer!=='string'||referrer.length>1024)return null;
 const values=new URLSearchParams(referrer).getAll('blink_link');
 return values.length===1?publicRoute(values[0],origin):null;
}
export function destinations(link){
 const parsed=publicRoute(link);
 if(!parsed)return null;
 const referrer=new URLSearchParams({blink_link:link}).toString();
 return {web:content+'/products/'+parsed.id,
  android:'https://play.google.com/store/apps/details?'+new URLSearchParams({id:android,referrer}),
  ios:'https://apps.apple.com/app/id'+iosAppId,
  iosManualContinuation:link};
}
export const aasa={applinks:{apps:[],details:[{appID:'EXAMPLETEAM.'+ios,paths:['/p/*']}]}};
export const assetlinks=[{relation:['delegate_permission/common.handle_all_urls'],target:{namespace:'android_app',package_name:android,sha256_cert_fingerprints:[Array(32).fill('00').join(':')]}}];
