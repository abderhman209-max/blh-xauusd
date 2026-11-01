// Web Push without dependencies: VAPID (RFC 8292) authentication and aes128gcm payload encryption (RFC 8291),
// using only WebCrypto so it runs on the Edge runtime.
const enc=new TextEncoder();
export const b64url={
  encode:bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''),
  decode:text=>Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-text.length%4)%4)),c=>c.charCodeAt(0))
};
const concat=(...parts)=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let i=0;for(const p of parts){out.set(p,i);i+=p.length;}return out;};
async function hkdf(salt,ikm,info,length){
  const key=await crypto.subtle.importKey('raw',ikm,'HKDF',false,['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},key,length*8));
}
// Only the browsers' own push services: the server never posts to an address a user typed.
const PUSH_HOSTS=[/^fcm\.googleapis\.com$/,/^updates\.push\.services\.mozilla\.com$/,/^web\.push\.apple\.com$/,/\.notify\.windows\.com$/,/^push\.services\.mozilla\.com$/];
export function validSubscription(value){
  try{
    const url=new URL(value?.endpoint);
    const p256dh=b64url.decode(value.keys.p256dh),auth=b64url.decode(value.keys.auth);
    return url.protocol==='https:'&&!url.port&&PUSH_HOSTS.some(r=>r.test(url.hostname))&&value.endpoint.length<=1024&&p256dh.length===65&&p256dh[0]===4&&auth.length===16;
  }catch{return false;}
}
export async function vapidHeader(endpoint,{publicKey,privateKey,subject},now=Date.now()){
  const pub=b64url.decode(publicKey);
  const key=await crypto.subtle.importKey('jwk',{kty:'EC',crv:'P-256',d:privateKey,x:b64url.encode(pub.slice(1,33)),y:b64url.encode(pub.slice(33,65)),ext:true},{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
  const part=value=>b64url.encode(enc.encode(JSON.stringify(value)));
  const unsigned=part({typ:'JWT',alg:'ES256'})+'.'+part({aud:new URL(endpoint).origin,exp:Math.floor(now/1000)+12*3600,sub:subject});
  const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,enc.encode(unsigned));
  return 'vapid t='+unsigned+'.'+b64url.encode(signature)+', k='+publicKey;
}
export async function encryptPayload(subscription,payload,{salt=crypto.getRandomValues(new Uint8Array(16)),ephemeral}={}){
  const uaPublic=b64url.decode(subscription.keys.p256dh),authSecret=b64url.decode(subscription.keys.auth);
  const pair=ephemeral||await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  const asPublic=new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey));
  const peer=await crypto.subtle.importKey('raw',uaPublic,{name:'ECDH',namedCurve:'P-256'},false,[]);
  const shared=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:peer},pair.privateKey,256));
  const ikm=await hkdf(authSecret,shared,concat(enc.encode('WebPush: info\0'),uaPublic,asPublic),32);
  const cek=await hkdf(salt,ikm,enc.encode('Content-Encoding: aes128gcm\0'),16),nonce=await hkdf(salt,ikm,enc.encode('Content-Encoding: nonce\0'),12);
  const key=await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['encrypt']);
  const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},key,concat(enc.encode(payload),new Uint8Array([2]))));
  const header=new Uint8Array(21);header.set(salt,0);new DataView(header.buffer).setUint32(16,4096);header[20]=asPublic.length;
  return concat(header,asPublic,cipher);
}
// Resolves to 'sent', 'gone' (the subscription must be deleted) or 'failed'.
export async function sendPush(subscription,payload,vapid,{fetcher=(url,init)=>globalThis.fetch(url,init)}={}){
  if(!validSubscription(subscription))return 'gone';
  const body=await encryptPayload(subscription,JSON.stringify(payload));
  const response=await fetcher(subscription.endpoint,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(10000),
    headers:{authorization:await vapidHeader(subscription.endpoint,vapid),'content-encoding':'aes128gcm','content-type':'application/octet-stream',ttl:'3600',urgency:'high'},body});
  return response.status===404||response.status===410?'gone':response.ok?'sent':'failed';
}
