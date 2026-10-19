// Accepted customers require server-owned paid_until; only the verified super_admin role is exempt.
export const PAID_ROUTES = new Set(['gold','gold/price','market','terminal/capabilities','workspace','journal/create','journal/update','notifications/create','notifications/read','analysis/run']);
export async function paidAccess(user, supabaseAdminData, now=Date.now()) {
  // Callers pass the identity returned by Supabase Auth after session validation.
  if(user?.app_metadata?.role==='super_admin')return {active:true,exempt:true,paidUntil:null,checkedAt:new Date(now).toISOString()};
  try {
    const response=await supabaseAdminData('payment_subscriptions?user_id=eq.'+encodeURIComponent(user.id)+'&select=paid_until&limit=1');
    if(!response.ok)throw Error('subscription_access_unavailable');
    const rows=await response.json();if(!Array.isArray(rows))throw Error('subscription_access_unavailable');
    const until=Date.parse(rows[0]?.paid_until),paidUntil=Number.isFinite(until)?new Date(until).toISOString():null;
    return {active:paidUntil!==null&&until>now,paidUntil,checkedAt:new Date(now).toISOString()};
  }catch{throw Error('subscription_access_unavailable');}
}

