/**
 * Vanguard FX API Integration Service Layer V5
 * Multi-Source, Multi-Fallback, Auto-Merge:
 * - Forex: Finnhub (primary) + Binance (via USDT conversion) + Local
 * - Crypto: Binance (primary) + CoinGecko (fallback) + Local
 */

const VANGUARD_API_CONFIG = {
    FINNHUB_KEY: 'sandbox_c8m910iad3ief4be9g0g', // Ganti ke real key kalau sudah siap live
    POOL_INTERVAL: 4000 // ms
};

// Registry instrumen yang dipakai UI kamu
const VANGUARD_TICKER_REGISTRY = [
    // ===== FOREX =====
    { uid: "EURUSD", name: "EUR / USD", category: "forex", symbolFinnhub: "OANDA:EUR_USD", symbolBinanceFx: "EURUSDT", baseSpread: 0.00012, decimals: 5 },
    { uid: "GBPUSD", name: "GBP / USD", category: "forex", symbolFinnhub: "OANDA:GBP_USD", symbolBinanceFx: "GBPUSDT", baseSpread: 0.00016, decimals: 5 },
    { uid: "USDJPY", name: "USD / JPY", category: "forex", symbolFinnhub: "OANDA:USD_JPY", symbolBinanceFx: "JPYUSDT", baseSpread: 0.014, decimals: 3 }, // USDJPY = 1 / JPYUSDT
    { uid: "AUDUSD", name: "AUD / USD", category: "forex", symbolFinnhub: "OANDA:AUD_USD", symbolBinanceFx: "AUDUSDT", baseSpread: 0.00011, decimals: 5 },
    { uid: "USDCAD", name: "USD / CAD", category: "forex", symbolFinnhub: "OANDA:USD_CAD", symbolBinanceFx: "CADUSDT", baseSpread: 0.00015, decimals: 5 },

    // ===== CRYPTO (sesuaikan dengan UI kamu) =====
    { uid: "BTCUSDT", name: "Bitcoin / USDT", category: "crypto", symbolBinance: "BTCUSDT", symbolCoingecko: "bitcoin", baseSpread: 0.5, decimals: 2 },
    { uid: "ETHUSDT", name: "Ethereum / USDT", category: "crypto", symbolBinance: "ETHUSDT", symbolCoingecko: "ethereum", baseSpread: 0.04, decimals: 2 },
    { uid: "BNBUSDT", name: "BNB / USDT", category: "crypto", symbolBinance: "BNBUSDT", symbolCoingecko: "binancecoin", baseSpread: 0.04, decimals: 2 },
    { uid: "SOLUSDT", name: "Solana / USDT", category: "crypto", symbolBinance: "SOLUSDT", symbolCoingecko: "solana", baseSpread: 0.04, decimals: 2 },
    { uid: "XRPUSDT", name: "XRP / USDT", category: "crypto", symbolBinance: "XRPUSDT", symbolCoingecko: "ripple", baseSpread: 0.0004, decimals: 4 },
    { uid: "ADAUSDT", name: "Cardano / USDT", category: "crypto", symbolBinance: "ADAUSDT", symbolCoingecko: "cardano", baseSpread: 0.0004, decimals: 4 },
    { uid: "DOGEUSDT", name: "Dogecoin / USDT", category: "crypto", symbolBinance: "DOGEUSDT", symbolCoingecko: "dogecoin", baseSpread: 0.0004, decimals: 5 },
    { uid: "MATICUSDT", name: "Polygon / USDT", category: "crypto", symbolBinance: "MATICUSDT", symbolCoingecko: "matic-network", baseSpread: 0.0004, decimals: 4 },
    { uid: "DOTUSDT", name: "Polkadot / USDT", category: "crypto", symbolBinance: "DOTUSDT", symbolCoingecko: "polkadot", baseSpread: 0.004, decimals: 3 },
    { uid: "AVAXUSDT", name: "Avalanche / USDT", category: "crypto", symbolBinance: "AVAXUSDT", symbolCoingecko: "avalanche-2", baseSpread: 0.004, decimals: 3 },
    { uid: "LTCUSDT", name: "Litecoin / USDT", category: "crypto", symbolBinance: "LTCUSDT", symbolCoingecko: "litecoin", baseSpread: 0.04, decimals: 2 },
    { uid: "LINKUSDT", name: "Chainlink / USDT", category: "crypto", symbolBinance: "LINKUSDT", symbolCoingecko: "chainlink", baseSpread: 0.004, decimals: 3 },
    { uid: "TRXUSDT", name: "TRON / USDT", category: "crypto", symbolBinance: "TRXUSDT", symbolCoingecko: "tron", baseSpread: 0.0002, decimals: 5 },
    { uid: "UNIUSDT", name: "Uniswap / USDT", category: "crypto", symbolBinance: "UNIUSDT", symbolCoingecko: "uniswap", baseSpread: 0.004, decimals: 3 },
    { uid: "ATOMUSDT", name: "Cosmos / USDT", category: "crypto", symbolBinance: "ATOMUSDT", symbolCoingecko: "cosmos", baseSpread: 0.004, decimals: 3 },
    { uid: "ETCUSDT", name: "Ethereum Classic / USDT", category: "crypto", symbolBinance: "ETCUSDT", symbolCoingecko: "ethereum-classic", baseSpread: 0.004, decimals: 3 }
];

class VanguardApiEngineV5 {
    constructor() {
        this.currentProviderIndex = 1; // 1 = Normal (multi-source), 4 = Local only
        this.providerNames = {
            1: "MULTI-API LIVE",
            4: "SAFE LOCAL DATA"
        };
        this.poolTimer = null;
    }

    // ================== PUBLIC API ==================

    /**
     * Ambil sekali snapshot pool harga (return Promise<object>)
     */
    async fetchMarketPricePool() {
        try {
            const [finnhubFx, binanceAll, coingeckoCrypto] = await Promise.allSettled([
                this.fetchForexFromFinnhub(),
                this.fetchAllFromBinance(),
                this.fetchCryptoFromCoinGecko()
            ]);

            const merged = this.mergeAllSources({
                finnhubFx: finnhubFx.status === "fulfilled" ? finnhubFx.value : null,
                binanceAll: binanceAll.status === "fulfilled" ? binanceAll.value : null,
                coingeckoCrypto: coingeckoCrypto.status === "fulfilled" ? coingeckoCrypto.value : null
            });

            this.currentProviderIndex = 1;
            this.updateUiProviderBadges();
            return merged;
        } catch (err) {
            console.warn("[API V5] Semua sumber gagal, fallback ke local safe data:", err);
            this.currentProviderIndex = 4;
            this.updateUiProviderBadges();
            return this.generateAllFallbackData();
        }
    }

    /**
     * Mode auto-pooling: setiap POOL_INTERVAL ms akan panggil callback(data)
     * @param {(data: object) => void} onUpdate
     */
    startAutoPool(onUpdate) {
        if (this.poolTimer) clearInterval(this.poolTimer);
        this.poolTimer = setInterval(async () => {
            try {
                const data = await this.fetchMarketPricePool();
                if (typeof onUpdate === "function") onUpdate(data);
            } catch (e) {
                console.error("[API V5] Auto pool error:", e);
            }
        }, VANGUARD_API_CONFIG.POOL_INTERVAL);
    }

    stopAutoPool() {
        if (this.poolTimer) clearInterval(this.poolTimer);
        this.poolTimer = null;
    }

    async fetchMarketNews() {
        try {
            const res = await fetch(`https://finnhub.io/api/v1/news?category=forex&token=${VANGUARD_API_CONFIG.FINNHUB_KEY}`);
            if (!res.ok) return [];
            return await res.json();
        } catch {
            return [];
        }
    }

    // ================== INTERNAL FETCHERS ==================

    async fetchForexFromFinnhub() {
        const results = {};
        const fxNodes = VANGUARD_TICKER_REGISTRY.filter(x => x.category === "forex");

        for (const node of fxNodes) {
            const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(node.symbolFinnhub)}&token=${VANGUARD_API_CONFIG.FINNHUB_KEY}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("Finnhub HTTP Invalid");
            const raw = await res.json();

            if (!raw || raw.c === null || raw.c === undefined) {
                // Kalau sandbox sering kasih 0/null → biar nanti ditolong Binance/local
                continue;
            }

            results[node.uid] = {
                price: parseFloat(raw.c),
                changePct: parseFloat(raw.dp ?? 0),
                high: parseFloat(raw.h ?? raw.c),
                low: parseFloat(raw.l ?? raw.c),
                source: "FINNHUB"
            };
        }
        return results;
    }

    async fetchAllFromBinance() {
        const results = {};
        const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr`);
        if (!res.ok) throw new Error("Binance API HTTP Invalid");
        const list = await res.json();

        const bySymbol = {};
        for (const item of list) {
            bySymbol[item.symbol] = item;
        }

        for (const node of VANGUARD_TICKER_REGISTRY) {
            if (node.category === "crypto" && node.symbolBinance) {
                const item = bySymbol[node.symbolBinance];
                if (!item || parseFloat(item.lastPrice) === 0) continue;

                results[node.uid] = {
                    price: parseFloat(item.lastPrice),
                    changePct: parseFloat(item.priceChangePercent),
                    high: parseFloat(item.highPrice),
                    low: parseFloat(item.lowPrice),
                    source: "BINANCE"
                };
            }

            if (node.category === "forex" && node.symbolBinanceFx) {
                // Forex via USDT conversion
                const sym = node.symbolBinanceFx;
                const item = bySymbol[sym];
                if (!item || parseFloat(item.lastPrice) === 0) continue;

                const px = parseFloat(item.lastPrice);

                let price;
                if (node.uid === "USDJPY") {
                    // USDJPY = 1 / JPYUSDT
                    price = 1 / px;
                } else if (node.uid === "USDCAD") {
                    // USDCAD = 1 / CADUSDT
                    price = 1 / px;
                } else {
                    // EURUSD, GBPUSD, AUDUSD: XXXUSDT / 1
                    price = px;
                }

                results[node.uid] = {
                    price,
                    changePct: parseFloat(item.priceChangePercent),
                    high: price * 1.01,
                    low: price * 0.99,
                    source: "BINANCE-FX"
                };
            }
        }

        return results;
    }

    async fetchCryptoFromCoinGecko() {
        const results = {};
        const cryptoNodes = VANGUARD_TICKER_REGISTRY.filter(x => x.category === "crypto");
        const ids = cryptoNodes.map(x => x.symbolCoingecko).join(",");

        const res = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_24hr_change=true`
        );
        if (!res.ok) throw new Error("CoinGecko HTTP Invalid");

        const raw = await res.json();

        for (const node of cryptoNodes) {
            const item = raw[node.symbolCoingecko];
            if (!item || !item.usd) continue;

            const price = parseFloat(item.usd);
            results[node.uid] = {
                price,
                changePct: parseFloat(item.usd_24h_change ?? 0),
                high: price * 1.02,
                low: price * 0.98,
                source: "COINGECKO"
            };
        }

        return results;
    }

    // ================== MERGING & FALLBACK ==================

    mergeAllSources({ finnhubFx, binanceAll, coingeckoCrypto }) {
        const finalResults = {};

        for (const node of VANGUARD_TICKER_REGISTRY) {
            let data = null;

            if (node.category === "forex") {
                // Prioritas: Finnhub → Binance-FX → Local
                const fromFinnhub = finnhubFx && finnhubFx[node.uid];
                const fromBinanceFx = binanceAll && binanceAll[node.uid];

                data = fromFinnhub || fromBinanceFx || this.generateFallbackPlaceholderData(node.uid);
            } else if (node.category === "crypto") {
                // Prioritas: Binance → CoinGecko → Local
                const fromBinance = binanceAll && binanceAll[node.uid];
                const fromCg = coingeckoCrypto && coingeckoCrypto[node.uid];

                data = fromBinance || fromCg || this.generateFallbackPlaceholderData(node.uid);
            } else {
                data = this.generateFallbackPlaceholderData(node.uid);
            }

            finalResults[node.uid] = data;
        }

        return finalResults;
    }

    generateAllFallbackData() {
        const results = {};
        VANGUARD_TICKER_REGISTRY.forEach(node => {
            results[node.uid] = this.generateFallbackPlaceholderData(node.uid);
        });
        return results;
    }

    generateFallbackPlaceholderData(uid) {
        const baselines = {
            EURUSD: 1.0854,
            GBPUSD: 1.2642,
            USDJPY: 155.62,
            AUDUSD: 0.6621,
            USDCAD: 1.3645,
            BTCUSDT: 67250.00,
            ETHUSDT: 3480.00,
            BNBUSDT: 580.00,
            SOLUSDT: 150.00,
            XRPUSDT: 0.52,
            ADAUSDT: 0.45,
            DOGEUSDT: 0.16,
            MATICUSDT: 0.80,
            DOTUSDT: 7.20,
            AVAXUSDT: 32.00,
            LTCUSDT: 85.00,
            LINKUSDT: 14.00,
            TRXUSDT: 0.12,
            UNIUSDT: 8.50,
            ATOMUSDT: 9.20,
            ETCUSDT: 28.00
        };
        const val = baselines[uid] || 1.0;
        return {
            price: val,
            changePct: 0.0,
            high: val * 1.004,
            low: val * 0.996,
            source: "LOCAL"
        };
    }

    updateUiProviderBadges() {
        const badge = document.getElementById('active-api-badge');
        const b1 = document.getElementById('status-api1');
        const b4 = document.getElementById('status-api4'); // kamu bisa bikin dot khusus "LOCAL"

        if (badge) {
            const name = this.providerNames[this.currentProviderIndex] || "UNKNOWN";
            badge.innerText = name.toUpperCase();
        }

        [b1, b4].forEach(b => {
            if (b) b.className = "w-1.5 h-1.5 rounded-full bg-slate-600";
        });

        if (this.currentProviderIndex === 1 && b1) {
            b1.className = "w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse";
        }
        if (this.currentProviderIndex === 4 && b4) {
            b4.className = "w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse";
        }
    }
}

// Global instance
const apiEngineV5 = new VanguardApiEngineV5();
