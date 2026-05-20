/**
 * Core Evaluation Market Analytics Engine
 * Memetakan bias tren finansial pasar riil berdasarkan pembacaan indikator kuantitatif
 */

class VanguardAnalysisEngine {
    static evaluateMarketBias(rsiValue, priceChangePct) {
        if (rsiValue > 65 || priceChangePct > 0.5) {
            return { bias: "BULLISH", color: "text-emerald-500" };
        } else if (rsiValue < 35 || priceChangePct < -0.5) {
            return { bias: "BEARISH", color: "text-rose-500" };
        }
        return { bias: "NEUTRAL", color: "text-slate-400" };
    }

    static evaluateTrendStrength(changePct) {
        const absChange = Math.abs(changePct);
        if (absChange >= 1.0) return "STRONG OVEREXTENDED";
        if (absChange >= 0.4) return "TRENDING STABLE";
        if (absChange >= 0.1) return "MODERATE MOMENTUM";
        return "LOW VOLATILITY SIDEWAYS";
    }
}
// analysis-engine.js
// Simple analysis engine: top gainers and losers, average price by category

const analysisEngine = (function() {
  // konfigurasi selector output
  const selectors = {
    topGainers: '#top-gainers', // container untuk list gainers
    topLosers: '#top-losers',   // container untuk list losers
    summary: '#market-summary'  // ringkasan singkat
  };

  function compute(pool) {
    const items = Object.keys(pool).map(uid => {
      const d = pool[uid] || {};
      return {
        uid,
        price: Number(d.price || 0),
        changePct: Number(d.changePct || 0),
        source: d.source || "LOCAL"
      };
    });

    // sort by changePct
    const sorted = items.slice().sort((a,b) => b.changePct - a.changePct);
    const gainers = sorted.slice(0,5);
    const losers = sorted.slice().reverse().slice(0,5);

    // simple summary: counts by source
    const sourceCounts = items.reduce((acc, it) => {
      acc[it.source] = (acc[it.source] || 0) + 1;
      return acc;
    }, {});

    return { items, gainers, losers, sourceCounts };
  }

  function renderList(containerSelector, list) {
    const el = document.querySelector(containerSelector);
    if (!el) return;
    el.innerHTML = list.map(it => {
      return `<div class="ae-row"><strong>${it.uid}</strong> ${it.price ? Number(it.price).toFixed(4) : '-'} <span class="pct">${it.changePct.toFixed(2)}%</span> <small>${it.source}</small></div>`;
    }).join('');
  }

  function renderSummary(containerSelector, summary) {
    const el = document.querySelector(containerSelector);
    if (!el) return;
    const parts = Object.keys(summary.sourceCounts).map(k => `${k}: ${summary.sourceCounts[k]}`);
    el.innerHTML = `<div>Sources: ${parts.join(' • ')}</div>`;
  }

  // Public handler called by app.js
  function onPoolUpdate(pool) {
    const result = compute(pool);
    renderList(selectors.topGainers, result.gainers);
    renderList(selectors.topLosers, result.losers);
    renderSummary(selectors.summary, result);
    // optional: return result for programmatic use
    return result;
  }

  return { onPoolUpdate };
})();

// expose globally so app.js can call it
window.analysisEngine = analysisEngine;
