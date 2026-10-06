/* Historical indicator results. Pure OHLC calculations; no trades are placed. */
(function (root) {
  'use strict';
  function summary(outcomes, {signals = 0, active = 0, excluded = 0} = {}) {
    const trades = outcomes.filter(row => Number.isFinite(row.resultR)).sort((a,b) => (a.closedAt || 0) - (b.closedAt || 0));
    let netR = 0, peak = 0, drawdown = 0;
    for (const trade of trades) { netR += trade.resultR; peak = Math.max(peak,netR); drawdown = Math.max(drawdown,peak-netR); }
    const wins = trades.filter(row => row.resultR > 1e-9).length;
    const losses = trades.filter(row => row.resultR < -1e-9).length;
    return {signals,active,excluded,closed:trades.length,wins,losses,breakeven:trades.length-wins-losses,netR,drawdown,winRate:trades.length ? wins/trades.length*100 : null};
  }
  function plansSummary(plans, bars) {
    const outcomes = [], seen = new Set();
    let active = 0, excluded = 0;
    for (const plan of plans || []) {
      const key = [plan.index,plan.direction,plan.entry].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const {index,direction,entry,stop} = plan, target = plan.tps?.at(-1) ?? plan.target;
      const risk = direction*(entry-stop), reward = direction*(target-entry);
      if (!Number.isInteger(index) || index < 0 || !bars[index] || ![entry,stop,target,risk,reward].every(Number.isFinite) || risk <= 0 || reward <= 0 || ![1,-1].includes(direction)) { excluded++; continue; }
      let resolved = false;
      // Entry is at the signal candle's close; earlier wicks cannot fill an exit.
      for (let i = index+1; i < bars.length; i++) {
        const bar = bars[i], stopped = direction === 1 ? bar.low <= stop : bar.high >= stop;
        const hit = direction === 1 ? bar.high >= target : bar.low <= target;
        if (!stopped && !hit) continue;
        if (stopped && hit) excluded++;
        else outcomes.push({resultR:stopped ? -1 : reward/risk,closedAt:bar.time});
        resolved = true; break;
      }
      if (!resolved) active++;
    }
    return summary(outcomes,{signals:seen.size,active,excluded});
  }
  function structureSummary(model, bars) {
    const outcomes = []; let active = 0, excluded = 0;
    for (const setup of model?.setups || []) {
      const trade = setup.trade;
      if (!trade) continue;
      const risk = setup.direction*(trade.entry-trade.sl);
      if (!(risk > 0)) { excluded++; continue; }
      // The signal is confirmed at close; a wick on its entry candle predates it.
      if (trade.status !== 'active' && trade.end <= trade.index) { excluded++; continue; }
      if (trade.status === 'TP touché') outcomes.push({resultR:setup.direction*(trade.tp-trade.entry)/risk,closedAt:bars[trade.end]?.time});
      else if (trade.status === 'SL touché') outcomes.push({resultR:-1,closedAt:bars[trade.end]?.time});
      else if (trade.status === 'active') active++;
      else excluded++;
    }
    return summary(outcomes,{signals:model?.setups?.length || 0,active,excluded});
  }
  function build({models = {}, bars = [], enabled = {}, symbol, interval}) {
    const results = {};
    for (const key of ['structure','planner','blh','pa']) {
      const supported = key !== 'blh' || symbol === 'XAU/USD' && interval === '5min';
      const status = !supported ? 'unsupported' : !enabled[key] ? 'disabled' : bars.length < 41 ? 'unavailable' : models[key]?.error ? 'invalid' : 'ready';
      results[key] = {status,barCount:bars.length,from:bars[0]?.time || null,to:bars.at(-1)?.time || null};
      if (status !== 'ready') continue;
      const model = models[key];
      const stats = key === 'structure' ? structureSummary(model,bars) : key === 'planner' ? summary(model?.trades || [],{signals:model?.signals?.length || 0,active:model?.active ? 1 : 0}) : plansSummary(model?.plans || [],bars);
      Object.assign(results[key],stats);
    }
    return results;
  }
  root.PIPVORIA_INDICATOR_PERFORMANCE = Object.freeze({summary,plansSummary,structureSummary,build});
})(typeof window !== 'undefined' ? window : globalThis);
