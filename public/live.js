// Aggregate only observed provider ticks. REST supplies authoritative history.
const GoldLive={
 buckets:new Map(),last:null,
 add(tick){
  if(!Number.isFinite(tick.price)||tick.price<=0||!Number.isFinite(tick.time)||!Number.isFinite(tick.receivedAt)||this.last&&(tick.time<this.last.time||tick.time===this.last.time&&tick.receivedAt===this.last.receivedAt&&tick.price===this.last.price))return false;
  this.last=tick;
  for(const [interval,duration] of Object.entries({'1min':60000,'5min':300000,'15min':900000,'30min':1800000,'1h':3600000})){
   const time=Math.floor(tick.time/duration)*duration,map=this.buckets.get(interval)||new Map();this.buckets.set(interval,map);
   const bar=map.get(time)||{time,open:tick.price,high:tick.price,low:tick.price,volume:0};
   Object.assign(bar,{high:Math.max(bar.high,tick.price),low:Math.min(bar.low,tick.price),close:tick.price,volume:(bar.volume||0)+(tick.volume??1),receivedAt:tick.receivedAt});map.set(time,bar);
   if(map.size>240)map.delete(map.keys().next().value);
  }return true;
 },
 merge(bars,interval,fetchedAt){
  if(!bars.length)return bars;
  const result=new Map(bars.map(b=>[b.time,{...b}])),lastTime=bars.at(-1).time;
  for(const [time,tick] of this.buckets.get(interval)||[]){
   if(time<lastTime)continue;
   const base=result.get(time);
   if(base){if(tick.receivedAt>fetchedAt)Object.assign(base,{high:Math.max(base.high,tick.high),low:Math.min(base.low,tick.low),close:tick.close,volume:Math.max(base.volume||0,tick.volume||0),closed:false})}
   else result.set(time,{...tick,closed:false,partial:true});
  }
  return [...result.values()].sort((a,b)=>a.time-b.time).slice(-1000);
 }
};
if(typeof module!=='undefined')module.exports=GoldLive;


// Each product has its own observed ticks; closed history always comes from REST.
const CryptoLive={feeds:new Map(),for(product){if(!this.feeds.has(product))this.feeds.set(product,{buckets:new Map(),last:null,add(tick){return GoldLive.add.call(this,{...tick,volume:0});},merge:GoldLive.merge});return this.feeds.get(product);}};
const CoinbaseMarket={socket:null,product:null,onTick:null,onStatus:null,active:false,retry:0,reconnectTimer:null,watchdog:null,lastMessage:0,
 start(callback,product='BTC-USD',onStatus=()=>{}){
  if(!['BTC-USD','ETH-USD','SOL-USD'].includes(product))throw Error('invalid_market');
  if(this.active&&this.product===product){this.onTick=callback;this.onStatus=onStatus;return;}
  this.stop();this.active=true;this.product=product;this.onTick=callback;this.onStatus=onStatus;this.connect();
 },
 connect(){
  if(!this.active)return;if(typeof WebSocket==='undefined'){this.onStatus?.('unavailable');return;}
  this.onStatus?.(this.retry?'reconnecting':'connecting');let ws;
  try{ws=this.socket=new WebSocket('wss://ws-feed.exchange.coinbase.com');}catch{this.scheduleReconnect();return;}
  this.lastMessage=Date.now();
  ws.onopen=()=>{if(this.socket!==ws||!this.active)return;ws.send(JSON.stringify({type:'subscribe',product_ids:[this.product],channels:['ticker','heartbeat']}));};
  ws.onmessage=event=>{if(this.socket!==ws||!this.active)return;let data;try{data=JSON.parse(event.data);}catch{return;}
   this.lastMessage=Date.now();if(data.type==='error'){ws.close();return;}
   if(data.type!=='ticker'||data.product_id!==this.product)return;
   const price=Number(data.price),time=Date.parse(data.time),receivedAt=Date.now();
   if(!Number.isFinite(price)||price<=0||!Number.isFinite(time)||time>receivedAt+5000||receivedAt-time>30000)return;
   this.retry=0;this.onStatus?.('live');this.onTick?.({symbol:this.product.replace('-','/'),price,time,receivedAt});
  };
  ws.onclose=()=>{if(this.socket!==ws)return;this.socket=null;clearInterval(this.watchdog);this.watchdog=null;if(this.active)this.scheduleReconnect();};
  ws.onerror=()=>ws.close();
  clearInterval(this.watchdog);this.watchdog=setInterval(()=>{if(this.socket===ws&&Date.now()-this.lastMessage>20000)ws.close();},5000);
 },
 scheduleReconnect(){if(!this.active)return;this.onStatus?.('reconnecting');clearTimeout(this.reconnectTimer);const delay=Math.min(30000,1000*2**Math.min(this.retry++,5));this.reconnectTimer=setTimeout(()=>{this.reconnectTimer=null;this.connect();},delay);},
 stop(){this.active=false;clearTimeout(this.reconnectTimer);clearInterval(this.watchdog);this.reconnectTimer=this.watchdog=null;const ws=this.socket;this.socket=null;this.onTick=this.onStatus=null;this.product=null;this.retry=0;ws?.close();}
};
if(typeof module!=='undefined'){module.exports.CoinbaseMarket=CoinbaseMarket;module.exports.CryptoLive=CryptoLive;}
