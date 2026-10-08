// Fixed allowlist: the browser cannot choose an arbitrary provider URL.
export async function additionalMarket(symbol,interval,{fetcher=fetch,now=Date.now()}={}){
  const symbols={EUR:'EURUSD=X',NAS:'^NDX'};
  const frames={'1min':'1m','5min':'5m','15min':'15m','30min':'30m','1h':'60m'};
  if(!Object.hasOwn(symbols,symbol)||!Object.hasOwn(frames,interval))throw Error('invalid_market');
  const r=await fetcher('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbols[symbol])+'?interval='+frames[interval]+'&range='+(interval==='1h'?'1mo':'5d'),{signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw Error('market_data_unavailable');
  const data=await r.json(),result=data.chart?.result?.[0],q=result?.indicators?.quote?.[0];
  if(!q||!Array.isArray(result.timestamp))throw Error('market_data_unavailable');
  const ms={'1min':60000,'5min':300000,'15min':900000,'30min':1800000,'1h':3600000}[interval];
  const bars=result.timestamp.map((t,i)=>({time:t*1000,open:q.open?.[i],high:q.high?.[i],low:q.low?.[i],close:q.close?.[i],volume:q.volume?.[i]??null,closed:t*1000+ms<=now}))
    .filter(b=>[b.time,b.open,b.high,b.low,b.close].every(Number.isFinite)&&b.low<=Math.min(b.open,b.close)&&b.high>=Math.max(b.open,b.close)).slice(-1000);
  if(!bars.length)throw Error('market_data_unavailable');
  return{symbol,interval,bars,source:'Yahoo Finance · '+(symbol==='NAS'?'Nasdaq 100':'EUR/USD')+' · cotation susceptible d’être différée',fetchedAt:now};
}
