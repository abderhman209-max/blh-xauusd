// Browser adaptation of the supplied Pine v6 indicator “BLH XAUUSD M5 CLEAN”.
// Pine scripts cannot execute in a web browser; this engine uses closed OHLC bars.
const BlhClean = {
  analyze(bars, options = {}) {
    const swing = Math.max(2, Math.floor(options.swing ?? 4));
    const atrLength = Math.max(1, Math.floor(options.atrLength ?? 14));
    const emaLength = Math.max(1, Math.floor(options.emaLength ?? 50));
    const sweepWindow = Math.max(1, Math.floor(options.sweepWindow ?? 5));
    const zoneBars = Math.max(1, Math.floor(options.zoneBars ?? 30));
    const rr = options.rr ?? [1, 2, 3];
    const result = { ema: [], signals: [], structure: null, zone: null, plan: null };
    if (!bars.length) return result;
    let ema = bars[0].close, atr = 0, lastHigh = null, lastLow = null;
    let bias = 0, lastSsl = -Infinity, lastBsl = -Infinity, previousBuy = false, previousSell = false;
    let previousClose = bars[0].close;
    const k = 2 / (emaLength + 1);
    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i];
      ema = i ? bar.close * k + ema * (1 - k) : bar.close;
      result.ema.push(ema);
      const tr = Math.max(bar.high - bar.low, Math.abs(bar.high - previousClose), Math.abs(bar.low - previousClose));
      atr = i ? (atr * (atrLength - 1) + tr) / atrLength : tr;
      previousClose = bar.close;

      // A pivot at i-swing is usable only now, after its right-hand bars close.
      const p = i - swing;
      if (p >= swing) {
        const left = bars.slice(p - swing, p), right = bars.slice(p + 1, i + 1);
        if (left.every(b => bars[p].high > b.high) && right.every(b => bars[p].high >= b.high)) lastHigh = bars[p].high;
        if (left.every(b => bars[p].low < b.low) && right.every(b => bars[p].low <= b.low)) lastLow = bars[p].low;
      }

      const sslSweep = lastLow !== null && bar.low < lastLow && bar.close > lastLow;
      const bslSweep = lastHigh !== null && bar.high > lastHigh && bar.close < lastHigh;
      if (sslSweep) lastSsl = i;
      if (bslSweep) lastBsl = i;
      if (sslSweep || bslSweep) {
        result.zone = sslSweep
          ? { index: i, end: i + zoneBars, top: bar.low + atr * .4, bottom: bar.low - atr * .15, direction: 1, price: bar.low }
          : { index: i, end: i + zoneBars, top: bar.high + atr * .15, bottom: bar.high - atr * .4, direction: -1, price: bar.high };
      }

      const prev = bars[i - 1];
      const bullBreak = lastHigh !== null && prev && bar.close > lastHigh && prev.close <= lastHigh;
      const bearBreak = lastLow !== null && prev && bar.close < lastLow && prev.close >= lastLow;
      if (bullBreak || bearBreak) {
        const direction = bullBreak ? 1 : -1;
        result.structure = { index: i, direction, price: direction === 1 ? bar.low : bar.high, name: direction === 1 ? (bias === -1 ? 'CHoCH' : 'BOS') : (bias === 1 ? 'CHoCH' : 'BOS') };
        bias = direction;
      }
      const buy = i - lastSsl <= sweepWindow && bullBreak && bar.close > ema && bar.close > bar.open;
      const sell = i - lastBsl <= sweepWindow && bearBreak && bar.close < ema && bar.close < bar.open;
      const newBuy = buy && !previousBuy, newSell = sell && !previousSell;
      previousBuy = buy; previousSell = sell;
      if (!newBuy && !newSell) continue;
      const direction = newBuy ? 1 : -1, entry = bar.close;
      const stopBase = direction === 1 ? Math.min(bar.low, lastLow ?? bar.low) : Math.max(bar.high, lastHigh ?? bar.high);
      const stop = stopBase - direction * atr * .25, risk = Math.abs(entry - stop);
      if (!Number.isFinite(risk) || risk <= 0) continue;
      result.plan = { index: i, end: i + 30, direction, entry, stop, tps: rr.map(r => entry + direction * risk * r), time: bar.time };
      result.signals.push({ index: i, direction, price: direction === 1 ? bar.low - atr * .3 : bar.high + atr * .3, entry, time: bar.time });
    }
    return result;
  }
};

function renderBlhClean(model, x, y, width, height, layer = 'shapes') {
  if (!model) return '';
  const fmt = p => Number(p).toFixed(2);
  let out = '<g data-indicator="blh-clean">';
  if (layer === 'shapes') {
    if (document.querySelector('#blh-ema')?.checked) {
      let d = '';
      model.ema.forEach((value, i) => { const xx = x(i); if (xx > -10 && xx < width + 10) d += (d ? ' L ' : 'M ') + xx + ' ' + y(value); });
      if (d) out += `<path d="${d}" fill="none" stroke="#68a9ff" stroke-opacity=".7" stroke-width="1.5"/>`;
    }
    const z = model.zone;
    if (z && x(z.end) >= 0 && x(z.index) <= width) {
      const color = z.direction === 1 ? '#18c7a1' : '#f23645';
      out += `<rect x="${x(z.index)}" y="${y(z.top)}" width="${Math.max(1,x(z.end)-x(z.index))}" height="${Math.max(0,y(z.bottom)-y(z.top))}" fill="${color}" fill-opacity=".12" stroke="${color}" stroke-opacity=".8"/>`;
    }
    const plan = model.plan;
    if (plan && x(plan.end) >= 0 && x(plan.index) <= width) {
      const levels = [[plan.entry,'#5eead4'],[plan.stop,'#f23645'],...plan.tps.map(p => [p,'#18c7a1'])];
      levels.forEach(([price,color],i) => { out += `<line x1="${x(plan.index)}" y1="${y(price)}" x2="${Math.min(width,x(plan.end))}" y2="${y(price)}" stroke="${color}" stroke-width="${i===0?2:1.5}" stroke-dasharray="${i===0?'':'5 3'}"/>`; });
    }
  } else {
    const z = model.zone;
    if (z && x(z.index) <= width && x(z.end) >= 0) out += `<text x="${Math.max(4,x(z.index+2))}" y="${y(z.price)+(z.direction===1?14:-8)}" fill="${z.direction===1?'#18c7a1':'#f23645'}" font-size="11" font-weight="700">${z.direction===1?'DEMAND':'SUPPLY'}</text>`;
    const structure = model.structure;
    if (structure && x(structure.index) >= 0 && x(structure.index) <= width) out += `<text x="${x(structure.index)}" y="${y(structure.price)+(structure.direction===1?18:-12)}" text-anchor="middle" fill="${structure.direction===1?'#18c7a1':'#f23645'}" font-size="12" font-weight="700">${structure.name} ${structure.direction===1?'↑':'↓'}</text>`;
    const plan = model.plan;
    if (plan && x(plan.end) >= 0 && x(plan.index) <= width) {
      const bx = Math.min(width-112, Math.max(2,x(plan.index+10)));
      [[plan.entry,'ENTRY','#5eead4'],[plan.stop,'STOP LOSS','#f23645'],...plan.tps.map((p,i)=>[p,'TP'+(i+1),'#18c7a1'])].forEach(([price,name,color]) => {
        out += `<rect x="${bx}" y="${y(price)-11}" width="108" height="17" rx="3" fill="${color}"/><text x="${bx+5}" y="${y(price)+1}" fill="#071a14" font-size="10" font-weight="700">${name} ${fmt(price)}</text>`;
      });
    }
    const signal = model.signals.at(-1);
    if (signal && x(signal.index) >= 0 && x(signal.index) <= width) out += `<text x="${x(signal.index)}" y="${y(signal.price)}" text-anchor="middle" fill="${signal.direction===1?'#18c7a1':'#f23645'}" font-size="14" font-weight="800">${signal.direction===1?'▲ BUY':'▼ SELL'}</text>`;
  }
  return out + '</g>';
}

function notifyBlhClean(model, bars) {
  const signal = model?.signals?.at(-1);
  if (!signal || signal.index < bars.length - 2) return;
  const key = `blh-clean|${selectedSymbol}|${selectedInterval}|${signal.time || signal.index}|${signal.direction}`;
  try { if (localStorage.getItem('blh-clean-last-alert') === key) return; localStorage.setItem('blh-clean-last-alert', key); } catch { return; }
  const plan = model.plan;
  if(plan) document.dispatchEvent(new CustomEvent('pipvoria-planner-signal',{detail:{key,engine:'blh',symbol:selectedSymbol,interval:selectedInterval,time:signal.time||Date.now(),direction:signal.direction===1?'buy':'sell',price:signal.entry,entry:plan.entry,stopLoss:plan.stop,takeProfits:plan.tps.slice(0,3)}}));
  const toast = document.createElement('div');
  const buy = signal.direction === 1;
  toast.setAttribute('role','status');
  toast.style.cssText = `position:fixed;z-index:9999;top:18px;right:18px;max-width:min(340px,calc(100vw - 36px));padding:15px 40px 15px 18px;border-radius:10px;background:#09221f;color:#fff;border:1px solid ${buy?'#18c7a1':'#f23645'};box-shadow:0 12px 36px #0009;font:600 15px system-ui`;
  const title = document.createElement('div'); title.textContent = `${buy?'▲ BUY':'▼ SELL'} · BLH XAUUSD M5 CLEAN`;
  const detail = document.createElement('div'); detail.style.cssText='font-size:13px;font-weight:400;margin-top:5px'; detail.textContent = `XAU/USD · 5 min · ENTRY ${signal.entry.toFixed(2)}`;
  const close = document.createElement('button'); close.type='button'; close.textContent='×'; close.setAttribute('aria-label','Fermer'); close.style.cssText='position:absolute;right:10px;top:8px;background:none;border:0;color:#fff;font-size:22px;cursor:pointer'; close.onclick=()=>toast.remove();
  toast.append(title,detail,close); document.body.append(toast); setTimeout(()=>toast.remove(),9000);
}

if (typeof module !== 'undefined') module.exports = { BlhClean, renderBlhClean };
