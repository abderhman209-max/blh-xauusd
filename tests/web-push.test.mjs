import {test} from 'node:test';import assert from 'node:assert/strict';import nodeCrypto from 'node:crypto';
import {b64url,encryptPayload,vapidHeader,sendPush,validSubscription} from '../lib/web-push.js';
// A browser-side subscription, built with node:crypto so the check is independent of the WebCrypto sender.
function browser(){
  const ecdh=nodeCrypto.createECDH('prime256v1');ecdh.generateKeys();const auth=nodeCrypto.randomBytes(16);
  return {ecdh,auth,subscription:{endpoint:'https://fcm.googleapis.com/fcm/send/abc',keys:{p256dh:b64url.encode(ecdh.getPublicKey()),auth:b64url.encode(auth)}}};
}
// RFC 8291 receiver.
function decrypt({ecdh,auth},body){
  const salt=body.subarray(0,16),rs=body.readUInt32BE(16),idlen=body[20],asPublic=body.subarray(21,21+idlen),cipher=body.subarray(21+idlen);
  const shared=ecdh.computeSecret(asPublic),info=Buffer.concat([Buffer.from('WebPush: info\0'),ecdh.getPublicKey(),asPublic]);
  const ikm=Buffer.from(nodeCrypto.hkdfSync('sha256',shared,auth,info,32));
  const cek=Buffer.from(nodeCrypto.hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: aes128gcm\0'),16)),nonce=Buffer.from(nodeCrypto.hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: nonce\0'),12));
  const d=nodeCrypto.createDecipheriv('aes-128-gcm',cek,nonce);d.setAuthTag(cipher.subarray(-16));
  const plain=Buffer.concat([d.update(cipher.subarray(0,-16)),d.final()]);
  assert.equal(rs,4096);assert.equal(plain.at(-1),2);return plain.subarray(0,-1).toString();
}
function vapidKeys(){const {publicKey,privateKey}=nodeCrypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'});const jwk=privateKey.export({format:'jwk'});
  return {publicKey:b64url.encode(Buffer.concat([Buffer.from([4]),Buffer.from(b64url.decode(jwk.x)),Buffer.from(b64url.decode(jwk.y))])),privateKey:jwk.d,subject:'mailto:test@example.invalid',node:publicKey};}
test('payloads are encrypted per RFC 8291 and only the subscribed browser can read them',async()=>{
  const b=browser(),body=Buffer.from(await encryptPayload(b.subscription,'{"title":"Scénario IA activé"}'));
  assert.equal(decrypt(b,body),'{"title":"Scénario IA activé"}');
  assert.throws(()=>decrypt(browser(),body));
});
test('the VAPID header is an ES256 JWT for the push service origin',async()=>{
  const keys=vapidKeys(),header=await vapidHeader('https://fcm.googleapis.com/fcm/send/abc',keys,Date.UTC(2026,10,1));
  const [,jwt,k]=/^vapid t=([^,]+), k=(.+)$/.exec(header);assert.equal(k,keys.publicKey);
  const [h,p,sig]=jwt.split('.'),claims=JSON.parse(Buffer.from(b64url.decode(p)).toString());
  assert.deepEqual(JSON.parse(Buffer.from(b64url.decode(h)).toString()),{typ:'JWT',alg:'ES256'});
  assert.equal(claims.aud,'https://fcm.googleapis.com');assert.equal(claims.exp,Date.UTC(2026,10,1)/1000+43200);
  assert.ok(nodeCrypto.verify('sha256',Buffer.from(h+'.'+p),{key:keys.node,dsaEncoding:'ieee-p1363'},Buffer.from(b64url.decode(sig))));
});
test('only browser push services with well-formed keys are accepted, and gone subscriptions are reported',async()=>{
  const {subscription}=browser();assert.equal(validSubscription(subscription),true);
  for(const endpoint of ['http://fcm.googleapis.com/x','https://evil.example/x','https://fcm.googleapis.com:8443/x','https://169.254.169.254/'])assert.equal(validSubscription({...subscription,endpoint}),false,endpoint);
  assert.equal(validSubscription({...subscription,keys:{...subscription.keys,auth:'AAAA'}}),false);
  const keys=vapidKeys(),calls=[];
  const fetcher=status=>async(url,init)=>{calls.push({url,init});return new Response(null,{status});};
  assert.equal(await sendPush(subscription,{title:'x'},keys,{fetcher:fetcher(201)}),'sent');
  assert.equal(calls[0].init.headers['content-encoding'],'aes128gcm');assert.match(calls[0].init.headers.authorization,/^vapid t=/);assert.equal(calls[0].init.redirect,'manual');
  assert.equal(await sendPush(subscription,{title:'x'},keys,{fetcher:fetcher(410)}),'gone');
  assert.equal(await sendPush(subscription,{title:'x'},keys,{fetcher:fetcher(500)}),'failed');
});
