// PayerURL wire format: official Node integration; Web Crypto keeps this Edge-compatible.
export const PLAN = Object.freeze({id:'monthly', name:'Pipvoria — 30 jours', amountMinor:4900, currency:'USD', days:30});
const WEBHOOK_FIELDS = ['order_id','ext_transaction_id','transaction_id','status_code','note','confirm_rcv_amnt','confirm_rcv_amnt_curr','coin_rcv_amnt','coin_rcv_amnt_curr','txn_time'];
const encode = value => encodeURIComponent(String(value)).replace(/[!'()~*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase()).replace(/%20/g,'+');
export function signedQuery(values) {
  return Object.keys(values).sort().filter(k=>values[k]!==undefined&&values[k]!==null).map(k=>encode(k)+'='+encode(values[k])).join('&');
}
async function hmacKey(secret) { return crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']); }
export async function authorization(values, publicKey, secret) {
  const bytes=await crypto.subtle.sign('HMAC',await hmacKey(secret),new TextEncoder().encode(signedQuery(values)));
  const hex=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
  return 'Bearer '+btoa(publicKey+':'+hex);
}
export function checkoutUrl(value) {
  try {const url=new URL(value);return url.protocol==='https:'&&url.hostname==='dash.payerurl.com'&&!url.username&&!url.password?url.href:null;}catch{return null;}
}
export function billingConfig() {
  let origin;try {const url=new URL(process.env.PIPVORIA_PUBLIC_URL);if(url.protocol==='https:'&&!url.username&&!url.password)origin=url.origin;}catch{}
  const configured=process.env.PAYERURL_ENABLED==='true'&&!!origin&&!!process.env.PAYERURL_PUBLIC_KEY&&!!process.env.PAYERURL_SECRET_KEY&&!!(process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY);
  return {configured,origin,plan:PLAN};
}
export async function verifyNotification(request, data) {
  const header=request.headers.get('authorization')||data.authStr;
  if(typeof header!=='string')return false;
  const encoded=header.replace(/^Bearer\s+/i,'').trim();
  if(!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)||encoded.length>2048)return false;
  let token;try{token=atob(encoded);}catch{return false;}
  const pos=token.indexOf(':'),key=token.slice(0,pos),signature=token.slice(pos+1);
  if(pos<0||key!==process.env.PAYERURL_PUBLIC_KEY||!/^[a-f0-9]{64}$/.test(signature))return false;
  const values=Object.fromEntries(WEBHOOK_FIELDS.filter(k=>data[k]!==undefined&&data[k]!==null).map(k=>[k,data[k]]));
  if(Object.values(values).some(v=>!['string','number'].includes(typeof v)))return false;
  const bytes=Uint8Array.from(signature.match(/../g),v=>parseInt(v,16));
  return crypto.subtle.verify('HMAC',await hmacKey(process.env.PAYERURL_SECRET_KEY),bytes,new TextEncoder().encode(signedQuery(values)));
}
export function decimalMinor(value) {
  const text=String(value??'');if(!/^\d{1,9}(\.\d{1,2})?$/.test(text))return null;
  const [whole,fraction='']=text.split('.');return Number(whole)*100+Number(fraction.padEnd(2,'0'));
}
export function billingApi({currentSession,supabaseAdminData,sessionJson,json,body,requestBytes,uuid}) {
  async function db(path,init={}) {const r=await supabaseAdminData(path,init);if(!r.ok)throw Error('billing_storage_unavailable');return r.status===204?null:r.json();}
  return async function billing(request,url,action) {
    const config=billingConfig();
    if(action==='notify') {
      if(!config.configured)return json({error:'billing_not_configured'},503);
      const bytes=await requestBytes(request,16384),text=new TextDecoder().decode(bytes);
      let data;try {const type=request.headers.get('content-type')?.split(';')[0].trim();
        if(type==='application/json')data=JSON.parse(text);
        else if(type==='application/x-www-form-urlencoded'){const pairs=[...new URLSearchParams(text)];if(new Set(pairs.map(p=>p[0])).size!==pairs.length)return json({error:'invalid_notification'},400);data=Object.fromEntries(pairs);}
        else return json({error:'invalid_content_type'},415);
      }catch{return json({error:'invalid_notification'},400);}
      if(!data||Array.isArray(data)||!await verifyNotification(request,data))return json({status:2030,error:'invalid_signature'},401);
      if(Number(data.status_code)!==200)return json({status:2040,message:'Notification received; no subscription granted.'});
      const amount=decimalMinor(data.confirm_rcv_amnt);
      if(!uuid(String(data.order_id))||typeof data.transaction_id!=='string'||!data.transaction_id.trim()||data.transaction_id.length>200||amount===null||String(data.confirm_rcv_amnt_curr).toUpperCase()!=='USD')return json({error:'invalid_payment'},400);
      // Atomic and idempotent in Postgres: no entitlement from a browser redirect.
      const result=await db('rpc/pipvoria_confirm_payment',{method:'POST',body:JSON.stringify({p_order_id:data.order_id,p_transaction_id:data.transaction_id,p_amount_minor:amount,p_currency:'USD'})});
      if(!result?.confirmed)return json({error:'payment_mismatch'},409);
      return json({status:2040,message:'Payment confirmed'});
    }
    const session=await currentSession(request);if(!session)return json({error:'authentication_required'},401);
    const user=session.user;
    if(action==='config') {
      let available=config.configured;
      if(available){try{await db('payment_orders?select=id&limit=0');}catch{available=false;}}
      return sessionJson({configured:available,plan:PLAN,methods:[{id:'payerurl',name:'PayerURL',description:'USDT · BEP20 / TRC20 / ERC20, BTC, ETH, USDC',available},{id:'nowpayments',name:'NOWPayments',description:'BTC, ETH, USDT et autres cryptos',available:false},{id:'binance',name:'Binance Pay',description:'Paiement via l’application Binance',available:false}]},200,session);
    }
    if(!config.configured)return json({error:'billing_not_configured'},503);
    if(action==='summary') {
      const [orders,subscriptions]=await Promise.all([db('payment_orders?user_id=eq.'+user.id+'&select=id,status,amount_minor,currency,created_at,paid_at&order=created_at.desc&limit=20'),db('payment_subscriptions?user_id=eq.'+user.id+'&select=paid_until&limit=1')]);
      return sessionJson({orders,paidUntil:subscriptions[0]?.paid_until||null},200,session);
    }
    if(action==='status') {
      const id=url.searchParams.get('id');if(!uuid(id))return json({error:'invalid_order'},400);
      const orders=await db('payment_orders?id=eq.'+id+'&user_id=eq.'+user.id+'&select=id,status,amount_minor,currency,paid_at&limit=1');
      return orders[0]?sessionJson({order:orders[0]},200,session):json({error:'order_not_found'},404);
    }
    const input=await body(request);
    if(input.method!=='payerurl'||input.plan!==PLAN.id||input.accepted!==true||!uuid(input.orderId))return json({error:'invalid_checkout'},400);
    const id=input.orderId;
    const prior=await db('payment_orders?id=eq.'+id+'&select=id,user_id,status,checkout_url&limit=1');
    if(prior.length){const row=prior[0];if(row.user_id!==user.id)return json({error:'order_not_found'},404);
      if(row.status==='pending'&&checkoutUrl(row.checkout_url))return sessionJson({orderId:id,redirectUrl:row.checkout_url},200,session);
      return json({error:row.status==='paid'?'order_already_paid':'order_in_progress'},409);}
    const recent=await db('payment_orders?user_id=eq.'+user.id+'&created_at=gte.'+encodeURIComponent(new Date(Date.now()-3600000).toISOString())+'&select=id&limit=10');
    if(recent.length>=10)return json({error:'checkout_rate_limit'},429);
    const inserted=await db('payment_orders?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify({id,user_id:user.id,amount_minor:PLAN.amountMinor,currency:PLAN.currency,duration_days:PLAN.days,status:'creating'})});
    if(!inserted.length)return json({error:'order_in_progress'},409);
    const args={order_id:id,amount:PLAN.amountMinor,currency:'usd',billing_fname:'Pipvoria',billing_lname:'Customer',billing_email:user.email,redirect_to:config.origin+'/?payment='+id+'#profile',cancel_url:config.origin+'/?payment='+id+'&cancelled=1#profile',notify_url:config.origin+'/api?route=billing/notify',type:'nodejs'};
    let target;
    try {const response=await fetch('https://api-v2.payerurl.com/api/payment',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'content-type':'application/x-www-form-urlencoded;charset=UTF-8',authorization:await authorization(args,process.env.PAYERURL_PUBLIC_KEY,process.env.PAYERURL_SECRET_KEY)},body:signedQuery(args)});
      const result=await response.json();target=response.ok&&checkoutUrl(result.redirectTO);if(!target)throw Error('invalid_checkout');
    }catch{return json({error:'payment_provider_unavailable'},502);}
    await db('payment_orders?id=eq.'+id+'&status=eq.creating',{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({checkout_url:target,status:'pending'})});
    return sessionJson({orderId:id,redirectUrl:target},201,session);
  };
}
