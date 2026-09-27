// Aggregate only observed provider ticks. REST supplies authoritative history.
const GoldLive={
 buckets:new Map(),last:null,
 add(tick){
  if(!Number.isFinite(tick.price)||tick.price<=0||!Number.isFinite(tick.time)||!Number.isFinite(tick.receivedAt)||this.last&&tick.time<this.last.time)return false;
  this.last=tick;
  for(const [interval,duration] of Object.entries({'1min':60000,'5min':300000,'15min':900000,'30min':1800000,'1h':3600000})){
   const time=Math.floor(tick.time/duration)*duration,map=this.buckets.get(interval)||new Map();this.buckets.set(interval,map);
   const bar=map.get(time)||{time,open:tick.price,high:tick.price,low:tick.price,volume:0};
   Object.assign(bar,{high:Math.max(bar.high,tick.price),low:Math.min(bar.low,tick.price),close:tick.price,volume:(bar.volume||0)+1,receivedAt:tick.receivedAt});map.set(time,bar);
   if(map.size>240)map.delete(map.keys().next().value);
  }return true;
 },
 merge(bars,interval,fetchedAt){
  if(!bars.length)return bars;
  const result=new Map(bars.map(b=>[b.time,{...b}])),lastTime=bars.at(-1).time;
  for(const [time,tick] of this.buckets.get(interval)||[]){
   if(time<lastTime)continue;
   const base=result.get(time);
   if(base){if(tick.receivedAt>fetchedAt)Object.assign(base,{high:Math.max(base.high,tick.high),low:Math.min(base.low,tick.low),close:tick.close,volume:Math.max(1,(base.volume||0)+(tick.volume||0)),closed:false})}
   else result.set(time,{...tick,closed:false,partial:true});
  }
  return [...result.values()].sort((a,b)=>a.time-b.time).slice(-1000);
 }
};
if(typeof module!=='undefined')module.exports=GoldLive;

const CoinbaseMarket={socket:null,onTick:null,
 async history(interval,signal){
  const seconds={'1min':60,'5min':300,'15min':900,'30min':900,'1h':3600}[interval];if(!seconds)throw Error('Unsupported interval');const rows=[];let end=Math.floor(Date.now()/1000);
  for(let page=0;page<4;page++){const start=end-seconds*299,url=`https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=${seconds}&start=${new Date(start*1000).toISOString()}&end=${new Date(end*1000).toISOString()}`;const response=await fetch(url,{signal,headers:{Accept:'application/json'}});if(!response.ok)throw Error('Coinbase unavailable');const data=await response.json();if(!Array.isArray(data))throw Error('Invalid Coinbase data');rows.push(...data);end=start-seconds}
  let bars=[...new Map(rows.map(r=>[Number(r[0]),{time:Number(r[0])*1000,low:Number(r[1]),high:Number(r[2]),open:Number(r[3]),close:Number(r[4]),volume:Number(r[5]),closed:Number(r[0])*1000+seconds*1000<=Date.now()}])).values()].sort((a,b)=>a.time-b.time);
  if(interval==='30min'){const grouped=new Map();for(const b of bars){const time=Math.floor(b.time/1800000)*1800000,g=grouped.get(time)||{time,open:b.open,high:b.high,low:b.low,close:b.close,volume:0,closed:b.closed};g.high=Math.max(g.high,b.high);g.low=Math.min(g.low,b.low);g.close=b.close;g.volume+=b.volume;g.closed=g.closed&&b.closed;grouped.set(time,g)}bars=[...grouped.values()].sort((a,b)=>a.time-b.time)}
  return bars.slice(-1000)
 },
 start(callback){this.onTick=callback;if(this.socket&&this.socket.readyState<2)return;const ws=this.socket=new WebSocket('wss://ws-feed.exchange.coinbase.com');ws.onopen=()=>ws.send(JSON.stringify({type:'subscribe',product_ids:['BTC-USD'],channels:['ticker']}));ws.onmessage=event=>{let data;try{data=JSON.parse(event.data)}catch{return}if(data.type==='ticker'&&data.product_id==='BTC-USD'){const tick={symbol:'BTC/USD',price:Number(data.price),time:Date.parse(data.time),receivedAt:Date.now()};if(Number.isFinite(tick.price)&&Number.isFinite(tick.time))this.onTick?.(tick)}};ws.onclose=()=>{this.socket=null};ws.onerror=()=>ws.close()},
 stop(){this.onTick=null;if(this.socket){this.socket.close();this.socket=null}}
};
if(typeof module!=='undefined')module.exports.CoinbaseMarket=CoinbaseMarket;
