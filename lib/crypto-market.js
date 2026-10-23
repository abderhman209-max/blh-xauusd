const products={BTC:'BTC-USD',ETH:'ETH-USD',SOL:'SOL-USD'};
const durations={'1min':60000,'5min':300000,'15min':900000,'30min':1800000,'1h':3600000};
export async function cryptoHistory(symbol,interval,{fetcher=(url,init)=>globalThis.fetch(url,init),now=Date.now()}={}){
  if(!Object.hasOwn(products,symbol)||!Object.hasOwn(durations,interval))throw Error('invalid_market');
  const duration=durations[interval],seconds=(interval==='30min'?900:duration/1000),end=Math.floor(now/1000),start=end-seconds*299;
  const url=new URL('https://api.exchange.coinbase.com/products/'+products[symbol]+'/candles');
  url.search=new URLSearchParams({granularity:String(seconds),start:new Date(start*1000).toISOString(),end:new Date(end*1000).toISOString()});
  const response=await fetcher(url.href,{signal:AbortSignal.timeout(10000),headers:{accept:'application/json'}});
  if(!response.ok)throw Error('market_data_unavailable');const rows=await response.json();
  if(!Array.isArray(rows))throw Error('market_data_unavailable');
  let bars=[...new Map(rows.filter(r=>Array.isArray(r)&&r.length>=6).map(r=>{
    const [secondsAt,low,high,open,close,volume]=r.map(Number);return [secondsAt,{time:secondsAt*1000,open,high,low,close,volume,closed:secondsAt*1000+seconds*1000<=now}];
  })).values()].filter(b=>[b.time,b.open,b.high,b.low,b.close,b.volume].every(Number.isFinite)&&b.time>=start*1000&&b.time<=now&&b.time%(seconds*1000)===0&&Math.min(b.open,b.high,b.low,b.close)>0&&b.volume>=0&&b.low<=Math.min(b.open,b.close)&&b.high>=Math.max(b.open,b.close)).sort((a,b)=>a.time-b.time);
  if(interval==='30min'){
    const groups=new Map();for(const bar of bars){const time=Math.floor(bar.time/duration)*duration;if(!groups.has(time))groups.set(time,[]);groups.get(time).push(bar);}
    bars=[...groups].flatMap(([time,group])=>{
      const complete=group.length===2&&group[0].time===time&&group[1].time===time+900000;
      if(time+duration<=now&&!complete)return [];
      return [{time,open:group[0].open,high:Math.max(...group.map(b=>b.high)),low:Math.min(...group.map(b=>b.low)),close:group.at(-1).close,volume:group.reduce((n,b)=>n+b.volume,0),closed:complete&&time+duration<=now}];
    });
  }
  if(!bars.length)throw Error('market_data_unavailable');
  return{symbol,interval,bars,source:'Coinbase · '+products[symbol].replace('-','/'),fetchedAt:now};
}
export function createCryptoMarket(options={}){
  const cache=new Map(),pending=new Map(),clock=options.clock||(()=>Date.now());
  return async(symbol,interval)=>{
    const key=symbol+'|'+interval,now=clock(),cached=cache.get(key);
    if(cached&&now-cached.fetchedAt<5000&&Math.floor(now/durations[interval])===Math.floor(cached.fetchedAt/durations[interval]))return cached;
    if(pending.has(key))return pending.get(key);
    const request=cryptoHistory(symbol,interval,{fetcher:options.fetcher,now}).then(result=>{cache.set(key,result);return result;}).finally(()=>pending.delete(key));
    pending.set(key,request);return request;
  };
}
export const cryptoMarket=createCryptoMarket();
