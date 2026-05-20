/**
 * Vanguard API Engine V7 - Toobit / MEXC / Gate.io - MAX Edition
 * Features:
 * - Parallel fetch with Promise.allSettled
 * - Retries with exponential backoff
 * - Per-pair provider ranking and normalization
 * - In-memory caching with TTL
 * - Diagnostics and health checks
 * - Optional WebSocket hook points (no external libs)
 *
 * Usage:
 * - Save as public/api.js (or appropriate path)
 * - Include <script src="/api.js"></script> before app.js
 */

const V7_CONFIG = {
  POOL_INTERVAL: 3000,
  CACHE_TTL_MS: 2500,
  RETRY_ATTEMPTS: 3,
  RETRY_BASE_MS: 300,
  TOOBIT_BASE: 'https://api.toobit.com',
  MEXC_BASE: 'https://api.mexc.com',
  GATEIO_BASE: 'https://api.gateio.ws/api/v4',
  ENABLE_WEBSOCKETS: false // set true to enable user-provided ws handlers
};

// Registry: extend to match your UI rows (uid must match data-ticker)
const V7_TICKER_REGISTRY = [
  { uid: "BTCUSDT", category: "crypto", symbols: { toobit: "BTCUSDT", mexc: "BTCUSDT", gateio: "BTC_USDT" }, decimals: 2 },
  { uid: "ETHUSDT", category: "crypto", symbols: { toobit: "ETHUSDT", mexc: "ETHUSDT", gateio: "ETH_USDT" }, decimals: 2 },
  { uid: "BNBUSDT", category: "crypto", symbols: { toobit: "BNBUSDT", mexc: "BNBUSDT", gateio: "BNB_USDT" }, decimals: 3 },
  { uid: "EURUSD", category: "forex", symbols: { toobit: "EURUSDT", mexc: "EURUSDT", gateio: "EUR_USDT" }, decimals: 5 },
  { uid: "USDJPY", category: "forex", symbols: { toobit: "JPYUSDT", mexc: "JPYUSDT", gateio: "JPY_USDT" }, decimals: 3, convertFrom: "JPYUSDT" }
];

// --- Utilities ---
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithRetries(url, opts = {}, attempts = V7_CONFIG.RETRY_ATTEMPTS) {
  let attempt = 0;
  let lastErr = null;
  while (attempt < attempts) {
    try {
      const res = await fetch(url, opts);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) return await res.json();
      // try text fallback
      const text = await res.text();
      try { return JSON.parse(text); } catch { return text; }
    } catch (err) {
      lastErr = err;
      attempt++;
      const backoff = V7_CONFIG.RETRY_BASE_MS * Math.pow(2, attempt - 1);
      await sleep(backoff + Math.random() * 100);
    }
  }
  throw lastErr;
}

// Simple in-memory cache
const V7_CACHE = new Map();
function cacheSet(key, value, ttl = V7_CONFIG.CACHE_TTL_MS) {
  const expires = Date.now() + ttl;
  V7_CACHE.set(key, { value, expires });
}
function cacheGet(key) {
  const entry = V7_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) { V7_CACHE.delete(key); return null; }
  return entry.value;
}

// Normalize symbol keys for provider responses
function normalizeSymbolKey(provider, rawSymbol) {
  if (!rawSymbol) return rawSymbol;
  // Gate.io returns "BTC_USDT" or "BTC/USDT" etc.
  return rawSymbol.replace(/[-\/_]/g, '').toUpperCase();
}

// --- Provider fetchers (public endpoints) ---
// Each returns a map: { SYMBOL: rawItem, ... } or null on failure

async function fetchToobitAll() {
  const cacheKey = 'toobit_all_v7';
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  // Example path; adjust if Toobit docs differ
  const url = `${V7_CONFIG.TOOBIT_BASE}/market/ticker/24hr`;
  const raw = await fetchWithRetries(url);
  if (!raw) return null;
  const map = {};
  (Array.isArray(raw) ? raw : (raw.data || [])).forEach(it => {
    const sym = normalizeSymbolKey('toobit', it.symbol || it.s);
    if (sym) map[sym] = it;
  });
  cacheSet(cacheKey, map);
  return map;
}

async function fetchMexcAll() {
  const cacheKey = 'mexc_all_v7';
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  const url = `${V7_CONFIG.MEXC_BASE}/api/v3/ticker/24hr`;
  const raw = await fetchWithRetries(url);
  if (!raw) return null;
  const map = {};
  (Array.isArray(raw) ? raw : (raw.data || [])).forEach(it => {
    const sym = normalizeSymbolKey('mexc', it.symbol || it.s);
    if (sym) map[sym] = it;
  });
  cacheSet(cacheKey, map);
  return map;
}

async function fetchGateioAll() {
  const cacheKey = 'gateio_all_v7';
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  const url = `${V7_CONFIG.GATEIO_BASE}/spot/tickers`;
  const raw = await fetchWithRetries(url);
  if (!raw) return null;
  const map = {};
  (Array.isArray(raw) ? raw : (raw.data || [])).forEach(it => {
    // gate returns currency_pair like "BTC_USDT" or "BTC/USDT"
    const rawSym = it.currency_pair || it.symbol || it.ticker;
    const sym = normalizeSymbolKey('gateio', rawSym);
    if (sym) map[sym] = it;
  });
  cacheSet(cacheKey, map);
  return map;
}

// --- Normalizers per provider to unified { price, changePct, high, low, raw, source } ---
function normalizeToUnified(provider, rawItem, providerName) {
  if (!rawItem) return null;
  // Try common fields with safe parsing
  const last = parseFloat(rawItem.last || rawItem.lastPrice || rawItem.price || rawItem.close || rawItem.last_price || rawItem.last_trade_price);
  const high = parseFloat(rawItem.high || rawItem.highPrice || rawItem.high_price || rawItem.h) || last;
  const low = parseFloat(rawItem.low || rawItem.lowPrice || rawItem.low_price || rawItem.l) || last;
  const changePct = parseFloat(rawItem.priceChangePercent || rawItem.change_percentage || rawItem.percent || rawItem.priceChange || 0);
  return { price: Number.isFinite(last) ? last : null, changePct: Number.isFinite(changePct) ? changePct : 0, high, low, raw: rawItem, source: providerName };
}

// --- Merge logic with per-pair provider ranking and conversion support ---
function mergeProviderMaps({ toobitMap, mexcMap, gateioMap }) {
  const out = {};
  for (const node of V7_TICKER_REGISTRY) {
    const uid = node.uid;
    const symbols = node.symbols || {};
    // Build candidate raw items in priority order: Toobit -> MEXC -> Gate.io
    const candidates = [];
    const symToobit = normalizeSymbolKey('toobit', symbols.toobit);
    const symMexc = normalizeSymbolKey('mexc', symbols.mexc);
    const symGate = normalizeSymbolKey('gateio', symbols.gateio || symbols.gateio || symbols.gateio);

    if (toobitMap && symToobit && toobitMap[symToobit]) candidates.push({ raw: toobitMap[symToobit], provider: 'TOOBIT' });
    if (mexcMap && symMexc && mexcMap[symMexc]) candidates.push({ raw: mexcMap[symMexc], provider: 'MEXC' });
    if (gateioMap && symGate && gateioMap[symGate]) candidates.push({ raw: gateioMap[symGate], provider: 'GATEIO' });

    // If forex conversion required (e.g., USDJPY from JPYUSDT), handle later
    let unified = null;
    for (const c of candidates) {
      const u = normalizeToUnified(c.provider, c.raw, c.provider);
      if (u && u.price !== null) { unified = u; break; }
    }

    // Special conversion: if node.convertFrom exists (e.g., USDJPY from JPYUSDT)
    if ((!unified || unified.price === null) && node.convertFrom) {
      // try to find convertFrom symbol across providers
      const convSym = normalizeSymbolKey('any', node.convertFrom);
      const convRaw = (toobitMap && toobitMap[convSym]) || (mexcMap && mexcMap[convSym]) || (gateioMap && gateioMap[convSym]);
      if (convRaw) {
        const convUnified = normalizeToUnified('CONV', convRaw, 'CONVERSION');
        if (convUnified && convUnified.price && convUnified.price > 0) {
          // e.g., USDJPY = 1 / JPYUSDT
          unified = { ...convUnified, price: 1 / convUnified.price, source: (convUnified.source || 'CONVERSION') + '-INVERT' };
        }
      }
    }

    // If still null, fallback to local baseline
    if (!unified || unified.price === null) {
      unified = generateFallbackPlaceholderData(uid);
      unified.source = 'LOCAL';
    }

    // Attach decimals if available
    unified.decimals = node.decimals ?? node.decimals ?? 4;
    out[uid] = unified;
  }
  return out;
}

// --- Baseline local fallback values ---
function generateFallbackPlaceholderData(uid) {
  const baselines = {
    BTCUSDT: 60000,
    ETHUSDT: 3500,
    BNBUSDT: 300,
    EURUSD: 1.08,
    USDJPY: 155.6
  };
  const val = baselines[uid] ?? 1.0;
  return { price: val, changePct: 0, high: val * 1.002, low: val * 0.998, raw: null, source: 'LOCAL' };
}

// --- Diagnostics helper ---
async function healthCheck() {
  const results = { timestamp: Date.now(), providers: {} };
  try {
    const [t, m, g] = await Promise.allSettled([fetchToobitAll(), fetchMexcAll(), fetchGateioAll()]);
    results.providers.toobit = t.status === 'fulfilled' ? 'ok' : `err:${t.reason?.message || 'fail'}`;
    results.providers.mexc = m.status === 'fulfilled' ? 'ok' : `err:${m.reason?.message || 'fail'}`;
    results.providers.gateio = g.status === 'fulfilled' ? 'ok' : `err:${g.reason?.message || 'fail'}`;
  } catch (e) {
    results.error = e.message;
  }
  return results;
}

// --- Public Engine Class ---
class VanguardApiEngineV7 {
  constructor() {
    this.poolTimer = null;
    this.lastSnapshot = null;
  }

  async fetchMarketPricePool() {
    // Use cached snapshot if fresh
    const cacheKey = 'v7_snapshot';
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    // Parallel provider fetch
    const [toobitRes, mexcRes, gateioRes] = await Promise.allSettled([fetchToobitAll(), fetchMexcAll(), fetchGateioAll()]);
    const toobitMap = toobitRes.status === 'fulfilled' ? toobitRes.value : null;
    const mexcMap = mexcRes.status === 'fulfilled' ? mexcRes.value : null;
    const gateioMap = gateioRes.status === 'fulfilled' ? gateioRes.value : null;

    const merged = mergeProviderMaps({ toobitMap, mexcMap, gateioMap });
    cacheSet(cacheKey, merged, V7_CONFIG.CACHE_TTL_MS);
    this.lastSnapshot = { ts: Date.now(), data: merged, providers: { toobit: !!toobitMap, mexc: !!mexcMap, gateio: !!gateioMap } };
    return merged;
  }

  startAutoPool(onUpdate) {
    if (this.poolTimer) clearInterval(this.poolTimer);
    // immediate run
    (async () => {
      try {
        const snap = await this.fetchMarketPricePool();
        if (typeof onUpdate === 'function') onUpdate(snap);
      } catch (e) { console.error('initial pool error', e); }
    })();

    this.poolTimer = setInterval(async () => {
      try {
        const snap = await this.fetchMarketPricePool();
        if (typeof onUpdate === 'function') onUpdate(snap);
      } catch (e) { console.error('auto pool error', e); }
    }, V7_CONFIG.POOL_INTERVAL);
  }

  stopAutoPool() {
    if (this.poolTimer) clearInterval(this.poolTimer);
    this.poolTimer = null;
  }

  async getDiagnostics() {
    return { lastSnapshot: this.lastSnapshot, health: await healthCheck() };
  }

  // Optional WebSocket hook points (no implementation; user can attach)
  onWebSocketMessage(provider, msg) {
    // user can override: window.apiEngineV7.onWebSocketMessage = (p,m)=>{...}
    if (typeof window?.apiEngineV7?.onWebSocketMessage === 'function') {
      try { window.apiEngineV7.onWebSocketMessage(provider, msg); } catch {}
    }
  }
}

const apiEngineV7 = new VanguardApiEngineV7();

// Expose for console debugging
window.apiEngineV7 = apiEngineV7;
