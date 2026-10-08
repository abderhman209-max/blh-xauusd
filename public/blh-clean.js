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
    const result = { ema: [], signals: [], plans: [], structure: null, zone: null, plan: null };
    if (!PIPVORIA_CORE.validTargets(rr)) return {...result,error:'invalid_targets'};
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
      result.plans.push(result.plan);
      result.signals.push({ index: i, direction, price: direction === 1 ? bar.low - atr * .3 : bar.high + atr * .3, entry, time: bar.time });
    }
    return result;
  }
};

if(typeof module!=='undefined')module.exports={BlhClean};
