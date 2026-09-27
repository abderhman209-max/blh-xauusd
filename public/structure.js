/* Port of the supplied Pine indicator. Closed candles only; synthetic demo feed. */
(function(root){
function analyzeStructure(bars,{term='Mid',rr=2,onlyValid=false}={}){
 const len={Short:5,Mid:10,Long:20}[term];if(!len||!Number.isFinite(rr)||rr<=0)throw Error('Ungültige Parameter');
 let ph=null,pl=null,trend=0,lo=null,hi=null,active=null;const setups=[],pivots=[];
 bars.forEach((b,i)=>{
  if(![b.open,b.high,b.low,b.close].every(Number.isFinite)||b.high<Math.max(b.open,b.close)||b.low>Math.min(b.open,b.close))throw Error('Ungültige Kerze');
  const p=i-len;
  if(p>=len){const win=bars.slice(p-len,i+1),c=bars[p];
   if(win.every((v,j)=>j===len||v.high<c.high)){ph={price:c.high,index:p};lo={price:c.low,index:p};pivots.push({index:p,confirmed:i,price:c.high,type:'high'});}
   if(win.every((v,j)=>j===len||v.low>c.low)){pl={price:c.low,index:p};hi={price:c.high,index:p};pivots.push({index:p,confirmed:i,price:c.low,type:'low'});}
  }
  if(ph&&b.low<lo.price)lo={price:b.low,index:i};if(pl&&b.high>hi.price)hi={price:b.high,index:i};
  let direction=0,broken=null,origin=null;
  if(ph&&b.close>ph.price&&trend<=0){direction=1;trend=1;broken=ph;origin=lo;ph=null;}
  if(pl&&b.close<pl.price&&trend>=0){direction=-1;trend=-1;broken=pl;origin=hi;pl=null;}
  if(direction){
   if(active){if(!active.trade)active.superseded=true;else if(active.trade.status==='active')active.trade.status='remplacé';}
   const f50=origin.price+(b.close-origin.price)*.5,f618=origin.price+(b.close-origin.price)*.618;
   active={direction,index:i,broken:{...broken},origin:{...origin},top:Math.max(f50,f618),bottom:Math.min(f50,f618),end:i+5,mitigated:false,trade:null};setups.push(active);
  }
  if(active&&!active.trade){const a=active;
   if(!a.mitigated){a.end=i+5;if(b.high>=a.bottom&&b.low<=a.top&&i>a.origin.index){a.mitigated=true;a.touch=i;}}
   else if(a.direction===1?b.low<=a.top&&b.close>b.open:b.high>=a.bottom&&b.close<b.open){
    const risk=(b.close-a.origin.price)*a.direction;
    if(risk>0)a.trade={index:i,entry:b.close,sl:a.origin.price,tp:b.close+a.direction*risk*rr,end:i,status:'active'};
   }
  }
  if(active?.trade?.status==='active'){const t=active.trade;t.end=i;const stop=active.direction===1?b.low<=t.sl:b.high>=t.sl,target=active.direction===1?b.high>=t.tp:b.low<=t.tp;if(stop||target)t.status=stop&&target?'SL et TP touchés · ordre inconnu':stop?'SL touché':'TP touché';}
 });
 return {setups:setups.filter(s=>!onlyValid||!s.superseded),pivots:onlyValid?[]:pivots,len};
}
function demoBars(){let previous=2335;return Array.from({length:240},(_,i)=>{const close=2340+Math.sin(i/13)*31+Math.sin(i/29)*26+i*.035;const open=previous;previous=close;return {open,close,high:Math.max(open,close)+2+Math.abs(Math.sin(i*1.17))*3,low:Math.min(open,close)-2-Math.abs(Math.cos(i*.93))*3};});}
root.StructureEngine={analyze:analyzeStructure,demoBars};if(typeof module!=='undefined')module.exports=root.StructureEngine;
})(typeof window!=='undefined'?window:globalThis);
