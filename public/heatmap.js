const HeatmapEngine={analyze(bars,o={}){
 const base=o.base??400,bins=o.bins??40,smoothing=o.smoothing??4,extension=o.extension??30;
 let fast=null,slow=null,sum=0;
 bars.forEach((b,i)=>{const p=bars[i-1],tr=p?Math.max(b.high-b.low,Math.abs(b.high-p.close),Math.abs(b.low-p.close)):b.high-b.low;sum+=tr;if(i===19)fast=sum/20;else if(i>19)fast=(fast*19+tr)/20;if(i===199)slow=sum/200;else if(i>199)slow=(slow*199+tr)/200});
 const length=o.dynamic!==false&&fast>0&&slow>0?Math.max(50,Math.min(1000,Math.round(base*slow/fast))):base;
 if(bars.length<length)return{error:`Nicht genügend Historie: ${bars.length} / ${length} Kerzen`,length};
 const window=bars.slice(-length),offset=bars.length-length,source=b=>o.source==='close'?b.close:(b.high+b.low)/2,values=window.map(source),mean=values.reduce((a,b)=>a+b,0)/length;
 const sx=length*(length-1)/2,sxx=length*(length-1)*(2*length-1)/6,sxy=values.reduce((s,v,i)=>s+i*v,0),slope=(length*sxy-sx*mean*length)/(length*sxx-sx*sx),start=mean-slope*sx/length,sd=Math.sqrt(values.reduce((s,v)=>s+(v-mean)**2,0)/length),end=start+slope*(length-1),contraction=Math.abs(end-start)<sd*(o.threshold??2.5),dev=sd*3/bins;
 const hasVolume=window.every(b=>Number.isFinite(b.volume)&&b.volume>=0),volumes=Array(bins*2).fill(0),deltas=[],signals=[];
 window.forEach((b,i)=>{const pred=start+slope*i;if(hasVolume&&dev>0){const k=Math.floor((values[i]-pred)/dev)+bins;if(k>=0&&k<volumes.length)volumes[k]+=b.volume;const range=b.high-b.low;deltas.push({buy:range?b.volume*(b.close-b.low)/range:b.volume/2,sell:range?b.volume*(b.high-b.close)/range:b.volume/2})}
  if(i&&contraction){const prev=window[i-1].close,pp=start+slope*(i-1),band=sd*(o.band??2);if(prev>=pp-band&&b.close<pred-band)signals.push({index:offset+i,price:b.low,buy:true});if(prev<=pp+band&&b.close>pred+band)signals.push({index:offset+i,price:b.high,buy:false})}
 });
 for(let s=0;s<smoothing;s++){const copy=volumes.slice(),at=i=>copy[Math.max(0,Math.min(copy.length-1,i))];for(let i=0;i<copy.length;i++)volumes[i]=(at(i-2)+4*at(i-1)+6*at(i)+4*at(i+1)+at(i+2))/16}
 return{length,offset,start,end,slope,sd,dev,bins,extension,contraction,hasVolume,volumes,maxVolume:Math.max(...volumes),deltas,maxDelta:Math.max(0,...deltas.flatMap(d=>[d.buy,d.sell])),signals};
}};
if(typeof module!=='undefined')module.exports=HeatmapEngine;
