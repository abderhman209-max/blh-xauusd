// Browser adaptation of the supplied Pine v6 “Price Action & Liquidity Map”.
// Original Pine Script supplied under the Mozilla Public License 2.0:
// https://mozilla.org/MPL/2.0/
// Only closed OHLC bars are passed in; a pivot is usable after its right bars close.
const PALiquidity = {
  analyze(bars, options = {}) {
    const pivotLength = Math.max(2, Math.min(50, Math.floor(options.pivotLength ?? 5)));
    const atrLength = Math.max(1, Math.floor(options.atrLength ?? 14));
    const tolerance = Math.max(.01, Math.min(1, Number(options.tolerance ?? .10)));
    const rr = Math.max(.25, Math.min(10, Number(options.rr ?? 2)));
    const result = { events: [], equalHigh: null, equalLow: null, plan: null, bias: 0 };
    let lastHigh = null, lastLow = null, priorHigh = null, priorLow = null;
    let highBroken = false, lowBroken = false, highSwept = false, lowSwept = false;
    let atr = null, trSum = 0;
    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i], prev = bars[i - 1];
      const tr = prev ? Math.max(bar.high - bar.low, Math.abs(bar.high - prev.close), Math.abs(bar.low - prev.close)) : bar.high - bar.low;
      if (i < atrLength) {
        trSum += tr;
        if (i === atrLength - 1) atr = trSum / atrLength;
      } else atr = (atr * (atrLength - 1) + tr) / atrLength;

      const p = i - pivotLength;
      if (p >= pivotLength) {
        const candidate = bars[p];
        const left = bars.slice(p - pivotLength, p), right = bars.slice(p + 1, i + 1);
        if (left.every(b => candidate.high > b.high) && right.every(b => candidate.high >= b.high)) {
          if (options.equalLevels !== false && priorHigh && atr !== null && Math.abs(candidate.high - priorHigh.price) <= atr * tolerance) {
            result.equalHigh = { from: priorHigh.index, index: p, price: candidate.high, fromPrice: priorHigh.price, confirmedAt: i };
            result.events.push({ type: 'EQH', index: p, price: candidate.high, confirmedAt: i });
          }
          priorHigh = lastHigh = { index: p, price: candidate.high };
          highBroken = highSwept = false;
        }
        if (left.every(b => candidate.low < b.low) && right.every(b => candidate.low <= b.low)) {
          if (options.equalLevels !== false && priorLow && atr !== null && Math.abs(candidate.low - priorLow.price) <= atr * tolerance) {
            result.equalLow = { from: priorLow.index, index: p, price: candidate.low, fromPrice: priorLow.price, confirmedAt: i };
            result.events.push({ type: 'EQL', index: p, price: candidate.low, confirmedAt: i });
          }
          priorLow = lastLow = { index: p, price: candidate.low };
          lowBroken = lowSwept = false;
        }
      }

      const bullBreak = !!(prev && lastHigh && !highBroken && i > lastHigh.index && bar.close > lastHigh.price && prev.close <= lastHigh.price);
      const bearBreak = !!(prev && lastLow && !lowBroken && i > lastLow.index && bar.close < lastLow.price && prev.close >= lastLow.price);
      const bullSweep = !!(options.sweeps !== false && lastLow && !lowSwept && !lowBroken && i > lastLow.index && bar.low < lastLow.price && bar.close > lastLow.price);
      const bearSweep = !!(options.sweeps !== false && lastHigh && !highSwept && !highBroken && i > lastHigh.index && bar.high > lastHigh.price && bar.close < lastHigh.price);
      if (bullBreak) {
        if (options.structure !== false) result.events.push({ type: result.bias === -1 ? 'CHoCH' : 'BOS', direction: 1, from: lastHigh.index, index: i, price: lastHigh.price });
        highBroken = true;
        result.bias = 1;
      }
      if (bearBreak) {
        if (options.structure !== false) result.events.push({ type: result.bias === 1 ? 'CHoCH' : 'BOS', direction: -1, from: lastLow.index, index: i, price: lastLow.price });
        lowBroken = true;
        result.bias = -1;
      }
      if (bullSweep) {
        result.events.push({ type: 'Sweep', direction: 1, index: i, price: bar.low });
        lowSwept = true;
      }
      if (bearSweep) {
        result.events.push({ type: 'Sweep', direction: -1, index: i, price: bar.high });
        highSwept = true;
      }
      if (options.tradeLevels !== false && ((bullBreak && lastLow && bar.close > lastLow.price) || (bearBreak && lastHigh && bar.close < lastHigh.price))) {
        const direction = bullBreak ? 1 : -1;
        const entry = bar.close, stop = direction === 1 ? lastLow.price : lastHigh.price;
        const risk = Math.abs(entry - stop);
        if (Number.isFinite(risk) && risk > 0) result.plan = { index: i, direction, entry, stop, target: entry + direction * risk * rr, rr, time: bar.time };
      }
    }
    return result;
  }
};

function renderPALiquidity(model, x, y, width, layer = 'shapes', colors = {}) {
  if (!model) return '';
  const bull = colors.bull || '#089981', bear = colors.bear || '#f23645', equal = colors.equal || '#5b9cf6';
  const fmt = price => Number(price).toFixed(2);
  let out = '<g data-indicator="pa-liquidity" pointer-events="none">';
  if (layer === 'shapes') {
    for (const level of [model.equalHigh, model.equalLow]) if (level && x(level.index) >= 0 && x(level.from) <= width) {
      out += `<line x1="${x(level.from)}" y1="${y(level.fromPrice)}" x2="${width}" y2="${y(level.price)}" stroke="${equal}" stroke-width="1" stroke-dasharray="3 4" opacity=".7"/>`;
    }
    for (const event of model.events) if ((event.type === 'BOS' || event.type === 'CHoCH') && x(event.index) >= 0 && x(event.from) <= width) {
      const color = event.direction === 1 ? bull : bear;
      out += `<line x1="${x(event.from)}" y1="${y(event.price)}" x2="${x(event.index)}" y2="${y(event.price)}" stroke="${color}" stroke-width="1.4" opacity=".85"/>`;
    }
    const p = model.plan;
    if (p && x(p.index) <= width) {
      for (const [price,color,dashed] of [[p.entry,equal,false],[p.stop,bear,true],[p.target,bull,true]]) {
        out += `<line x1="${Math.max(0,x(p.index))}" y1="${y(price)}" x2="${width}" y2="${y(price)}" stroke="${color}" stroke-width="${dashed?1.5:2}" ${dashed?'stroke-dasharray="5 4"':''}/>`;
      }
    }
  } else {
    for (const event of model.events) if (x(event.index) >= 0 && x(event.index) <= width) {
      const color = event.type === 'EQH' || event.type === 'EQL' ? equal : event.direction === 1 ? bull : bear;
      const anchor = event.direction === -1 || event.type === 'EQH' ? -9 : 17;
      out += `<text x="${x(event.index)}" y="${y(event.price)+anchor}" text-anchor="middle" fill="${color}" font-size="10" font-weight="700">${event.type}</text>`;
    }
    const p = model.plan;
    if (p && x(p.index) <= width) {
      const bx = Math.max(2, width - 101);
      for (const [price,name,color] of [[p.entry,'ENTRY',equal],[p.stop,'SL',bear],[p.target,'TP',bull]]) {
        out += `<rect x="${bx}" y="${y(price)-10}" width="98" height="17" rx="3" fill="${color}"/><text x="${bx+4}" y="${y(price)+2}" fill="#071a14" font-size="10" font-weight="700">${name} ${fmt(price)}</text>`;
      }
    }
  }
  return out + '</g>';
}

if (typeof module !== 'undefined') module.exports = { PALiquidity, renderPALiquidity };
