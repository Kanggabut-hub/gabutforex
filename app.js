/**
 * Vanguard Forex Workstation Main Application Orchestrator
 * Fokus: Sinkronisasi Ticker, Watchlist Harga, Metrik Analytics, dan Risk Desk (Tanpa Grafik)
 */

let globalActivePairUid = "EURUSD";
let globalActiveFilter = "all";
let globalMarketDataCache = {};

// Default Ticker Registry Lokal sebagai cadangan mutlak jika window.VANGUARD_TICKER_REGISTRY tidak terbaca
const LOCAL_TICKER_REGISTRY = [
    { uid: "EURUSD", name: "EUR / USD", category: "forex", baseSpread: 0.00012, decimals: 5 },
    { uid: "GBPUSD", name: "GBP / USD", category: "forex", baseSpread: 0.00016, decimals: 5 },
    { uid: "USDJPY", name: "USD / JPY", category: "forex", baseSpread: 0.014, decimals: 3 },
    { uid: "AUDUSD", name: "AUD / USD", category: "forex", baseSpread: 0.00011, decimals: 5 },
    { uid: "USDCAD", name: "USD / CAD", category: "forex", baseSpread: 0.00015, decimals: 5 },
    { uid: "BTCUSDT", name: "Bitcoin / USDT", category: "crypto", baseSpread: 0.5, decimals: 2 },
    { uid: "ETHUSDT", name: "Ethereum / USDT", category: "crypto", baseSpread: 0.04, decimals: 2 }
];

function getTickerRegistry() {
    return window.VANGUARD_TICKER_REGISTRY || LOCAL_TICKER_REGISTRY;
}

document.addEventListener("DOMContentLoaded", async () => {
    initializeClocks();
    initKeyboardShortcuts();
    setupUiInteractionListeners();
    
    // Alur inisialisasi boot jaringan sinkronisasi awal
    await executeTerminalBootSequence();
});

function initializeClocks() {
    setInterval(() => {
        const now = new Date();
        const localClock = document.getElementById('clock-local');
        if (localClock) localClock.innerText = now.toTimeString().split(' ')[0];
        
        const ldn = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (3600000 * 1));
        const nyc = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (3600000 * -4));
        
        const clockLdn = document.getElementById('clock-ldn');
        const clockNyc = document.getElementById('clock-nyc');
        if (clockLdn) clockLdn.innerText = ldn.toTimeString().split(' ')[0];
        if (clockNyc) clockNyc.innerText = nyc.toTimeString().split(' ')[0];
    }, 1000);
}

async function executeTerminalBootSequence() {
    const logArea = document.getElementById('boot-log-screen');
    const appendLog = (text, type = "info") => {
        if (!logArea) return;
        const p = document.createElement('p');
        p.innerText = `[${new Date().toLocaleTimeString()}] ${text}`;
        if (type === "success") p.className = "text-emerald-400";
        if (type === "warn") p.className = "text-amber-400";
        logArea.appendChild(p);
        logArea.scrollTop = logArea.scrollHeight;
    };

    try {
        appendLog("Menghubungkan Pool Jaringan Pasar Keuangan Global...", "info");
        
        if (window.apiEngine && typeof window.apiEngine.updateUiProviderBadges === "function") {
            window.apiEngine.updateUiProviderBadges();
        }
        
        // 1. Ambil data harga pasar awal
        if (window.apiEngine && typeof window.apiEngine.fetchMarketPricePool === "function") {
            globalMarketDataCache = await window.apiEngine.fetchMarketPricePool();
        } else {
            throw new Error("apiEngine tidak terdefinisi secara global.");
        }
        appendLog("Sinkronisasi harga pasar berhasil diselesaikan.", "success");
        
    } catch (err) {
        console.error("Booting beralih ke engine cadangan lokal:", err);
        appendLog("Koneksi eksternal sibuk. Mengaktifkan mode data lokal aman.", "warn");
        
        if (window.apiEngine && typeof window.apiEngine.generateAllFallbackData === "function") {
            globalMarketDataCache = window.apiEngine.generateAllFallbackData();
        } else {
            // Pembuatan data statis manual jika class api.js bermasalah total
            globalMarketDataCache = {};
            getTickerRegistry().forEach(node => {
                globalMarketDataCache[node.uid] = { price: node.uid.includes("JPY") ? 155.20 : (node.uid.includes("USDT") ? 67000.00 : 1.0850), changePct: 0.15, high: 1.0900, low: 1.0800 };
            });
        }
    }

    // 2. Ambil berita tanpa 'await' agar tidak memblokir proses masuk terminal
    appendLog("Mengunduh feed ringkasan berita makroekonomi...", "info");
    updateFinancialNewsFeed(); 

    // 3. Pre-render data ke struktur UI secara instan sebelum tombol ditekan
    try {
        renderWatchlistWorkspace();
        updateSelectedPairMetricsDesk();
    } catch (uiError) {
        console.warn("Pre-rendering workspace tertunda:", uiError);
    }

    // 4. Aktifkan tombol masuk ke terminal
    activateTerminalBypassButton(appendLog);
}

function activateTerminalBypassButton(appendLog) {
    const bypassBtn = document.getElementById('btn-bypass-boot');
    if (!bypassBtn) return;
    
    bypassBtn.disabled = false;
    bypassBtn.className = "px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded text-[10px] tracking-wide transition uppercase cursor-pointer";
    
    const bootStatus = document.getElementById('boot-status');
    if (bootStatus) {
        bootStatus.innerText = "SINKRONISASI SELESAI";
        bootStatus.className = "text-emerald-400 font-bold";
    }

    bypassBtn.onclick = () => {
        const modal = document.getElementById('gateway-modal');
        if (modal) modal.classList.add('hidden');
        
        // Membangun struktur UI utama tanpa memanggil chart
        renderWatchlistWorkspace();
        updateSelectedPairMetricsDesk();
        
        // Jalankan siklus sinkronisasi berkala aman
        setInterval(syncTerminalMarketPool, window.VANGUARD_API_CONFIG?.POOL_INTERVAL || 4000);
    };
}

async function syncTerminalMarketPool() {
    try {
        if (window.apiEngine && typeof window.apiEngine.fetchMarketPricePool === "function") {
            const freshData = await window.apiEngine.fetchMarketPricePool();
            if (freshData) {
                globalMarketDataCache = freshData;
                renderWatchlistWorkspace();
                updateSelectedPairMetricsDesk();
            }
        }
    } catch (e) {
        console.error("[POOL] Pembaruan harga berkala terganggu jaringan.", e);
    }
}

function renderWatchlistWorkspace() {
    const container = document.getElementById('watchlist-container');
    if (!container) return;
    container.innerHTML = "";
    
    const registry = getTickerRegistry();
    let filteredRegistry = registry;
    if (globalActiveFilter !== "all") {
        filteredRegistry = registry.filter(x => x.category === globalActiveFilter);
    }

    const badgeCount = document.getElementById('watchlist-count-badge');
    if (badgeCount) badgeCount.innerText = `${filteredRegistry.length} Instruments`;

    filteredRegistry.forEach(node => {
        const pool = globalMarketDataCache[node.uid] || { price: 0, changePct: 0 };
        const isBullish = pool.changePct >= 0;
        const changeColor = isBullish ? "text-emerald-500" : "text-rose-500";
        const directionSign = isBullish ? "▲" : "▼";
        const isActive = node.uid === globalActivePairUid ? "watchlist-active-item" : "";

        const row = document.createElement('div');
        row.className = `p-2 bg-[#080d16] border border-slate-900 rounded flex items-center justify-between cursor-pointer hover:bg-slate-800/60 transition ${isActive}`;
        row.onclick = () => {
            globalActivePairUid = node.uid;
            renderWatchlistWorkspace();
            updateSelectedPairMetricsDesk();
        };

        row.innerHTML = `
            <div class="flex flex-col">
                <span class="text-white font-bold tracking-tight">${node.name}</span>
                <span class="text-[8px] text-slate-500 uppercase">${node.category.toUpperCase()}</span>
            </div>
            <div class="text-right flex flex-col">
                <span class="text-white font-mono-tech font-bold">${pool.price.toFixed(node.decimals || 2)}</span>
                <span class="${changeColor} text-[9px] font-bold">${directionSign} ${pool.changePct.toFixed(2)}%</span>
            </div>
        `;
        container.appendChild(row);
    });
}

function updateSelectedPairMetricsDesk() {
    const registry = getTickerRegistry();
    const node = registry.find(x => x.uid === globalActivePairUid) || { decimals: 2, baseSpread: 0.0001 };
    
    let pool = globalMarketDataCache[globalActivePairUid];
    if (!pool || isNaN(parseFloat(pool.price))) {
        pool = { price: 1.0850, high: 1.0900, low: 1.0800, changePct: 0.15 };
    }

    const chartPairLabel = document.getElementById('active-chart-pair');
    if (chartPairLabel) chartPairLabel.innerText = globalActivePairUid;
    
    let rsi = 52, atr = 0.0014, pivots = { pivot: pool.price, r1: pool.price * 1.002, s1: pool.price * 0.998 };
    let biasInfo = { bias: "NEUTRAL", color: "text-slate-400" };
    let trendStrength = "MODERATE MOMENTUM";

    // Simulasikan penghitungan jika engine math terpisah tidak terbaca
    if (window.VanguardIndicators) {
        // Buat dummy candle array untuk fungsi math rsi/atr
        const dummyCandles = Array.from({length: 20}, (_, i) => ({ close: pool.price, high: pool.high, low: pool.low }));
        rsi = window.VanguardIndicators.calculateRsi(dummyCandles, 14) || rsi;
        atr = window.VanguardIndicators.calculateAtr(dummyCandles, 14) || atr;
        pivots = window.VanguardIndicators.calculateClassicPivotNodes(pool.price, pool.high, pool.low) || pivots;
    } else {
        pivots = { pivot: (pool.high + pool.low + pool.price)/3, r1: (2 * ((pool.high + pool.low + pool.price)/3)) - pool.low, s1: (2 * ((pool.high + pool.low + pool.price)/3)) - pool.high };
    }
    
    if (window.VanguardAnalysisEngine) {
        biasInfo = window.VanguardAnalysisEngine.evaluateMarketBias(rsi, pool.changePct);
        trendStrength = window.VanguardAnalysisEngine.evaluateTrendStrength(pool.changePct);
    } else {
        biasInfo = pool.changePct >= 0 ? { bias: "BULLISH", color: "text-emerald-500" } : { bias: "BEARISH", color: "text-rose-500" };
    }

    const biasLabel = document.getElementById('analytics-bias');
    if (biasLabel) {
        biasLabel.innerText = biasInfo.bias;
        biasLabel.className = `font-bold text-xs font-mono-tech ${biasInfo.color}`;
    }
    
    const structLabel = document.getElementById('analytics-structure');
    if (structLabel) structLabel.innerText = trendStrength;
    
    const atrLabel = document.getElementById('analytics-atr');
    const spreadLabel = document.getElementById('analytics-spread-val');
    const rsiLabel = document.getElementById('analytics-rsi-val');
    
    if (atrLabel) atrLabel.innerText = atr.toFixed(node.decimals);
    if (spreadLabel) spreadLabel.innerText = `${(node.baseSpread * (10 ** node.decimals)).toFixed(1)} Pips`;
    if (rsiLabel) rsiLabel.innerText = rsi;

    const r1Label = document.getElementById('pivot-r1');
    const pLabel = document.getElementById('pivot-p');
    const s1Label = document.getElementById('pivot-s1');

    if (r1Label) r1Label.innerText = pivots.r1.toFixed(node.decimals);
    if (pLabel) pLabel.innerText = pivots.pivot.toFixed(node.decimals);
    if (s1Label) s1Label.innerText = pivots.s1.toFixed(node.decimals);

    calculateRiskAllocationOutput(pool.price);
}

function calculateRiskAllocationOutput(currentPrice) {
    const marginInput = document.getElementById('risk-margin');
    const leverageInput = document.getElementById('risk-leverage');
    if (!marginInput || !leverageInput) return;

    const margin = parseFloat(marginInput.value) || 0;
    const leverage = parseFloat(leverageInput.value) || 0;
    
    const pool = globalMarketDataCache[globalActivePairUid] || { changePct: 0.02 };
    
    const calculatedRoi = pool.changePct * leverage;
    const estimatedPnl = margin * (calculatedRoi / 100);

    const pnlLabel = document.getElementById('risk-pnl-output');
    const roiLabel = document.getElementById('risk-roi-output');

    if (pnlLabel) {
        pnlLabel.innerText = `${estimatedPnl >= 0 ? '+' : ''}$${estimatedPnl.toFixed(2)} USD`;
        pnlLabel.className = `font-bold text-xs ${estimatedPnl >= 0 ? 'text-emerald-400' : 'text-rose-500'}`;
    }
    
    if (roiLabel) {
        roiLabel.innerText = `${estimatedPnl >= 0 ? '+' : ''}${calculatedRoi.toFixed(2)}%`;
        roiLabel.className = `font-bold text-xs ${estimatedPnl >= 0 ? 'text-emerald-400' : 'text-rose-500'}`;
    }
}

async function updateFinancialNewsFeed() {
    const container = document.getElementById('news-feed-container');
    if (!container) return;
    
    try {
        if (!window.apiEngine || typeof window.apiEngine.fetchMarketNews !== "function") return;
        const news = await window.apiEngine.fetchMarketNews();
        if (!news || news.length === 0) {
            container.innerHTML = `<p class="text-slate-600 text-[9px] italic">Gagal memuat berita finansial realtime.</p>`;
            return;
        }
        
        container.innerHTML = "";
        news.slice(0, 4).forEach(item => {
            const block = document.createElement('div');
            block.className = "bg-[#04060a] p-2 border border-slate-900 rounded space-y-0.5 hover:border-slate-800 transition cursor-pointer";
            block.onclick = () => window.open(item.url, '_blank');
            block.innerHTML = `
                <span class="text-slate-500 text-[7px] block font-bold uppercase">${item.source || 'GLOBAL'} • ${new Date((item.datetime || Date.now() / 1000) * 1000).toLocaleDateString()}</span>
                <p class="text-white font-sans font-bold leading-tight hover:text-amber-400 transition">${item.headline || item.title}</p>
            `;
            container.appendChild(block);
        });
    } catch (error) {
        console.warn("Gagal memuat berita:", error);
        container.innerHTML = `<p class="text-slate-600 text-[9px] italic">Gagal memuat berita finansial realtime.</p>`;
    }
}

function setupUiInteractionListeners() {
    const tabs = [
        { id: 'tab-filter-all', value: 'all' },
        { id: 'tab-filter-majors', value: 'forex' },
        { id: 'tab-filter-crypto', value: 'crypto' }
    ];
    tabs.forEach(tab => {
        const el = document.getElementById(tab.id);
        if (el) {
            el.onclick = (e) => {
                tabs.forEach(t => {
                    const btn = document.getElementById(t.id);
                    if(btn) btn.className = "py-1 bg-slate-900 text-slate-400 border border-transparent rounded hover:bg-slate-800 transition uppercase";
                });
                e.target.className = "py-1 bg-amber-950 text-amber-400 border border-amber-900 rounded font-bold uppercase";
                globalActiveFilter = tab.value;
                renderWatchlistWorkspace();
            };
        }
    });

    ['risk-margin', 'risk-leverage'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                const pool = globalMarketDataCache[globalActivePairUid] || { price: 1.0 };
                calculateRiskAllocationOutput(pool.price);
            });
        }
    });

    const refreshBtn = document.getElementById('btn-force-refresh');
    if (refreshBtn) {
        refreshBtn.onclick = () => {
            syncTerminalMarketPool();
            updateFinancialNewsFeed();
        };
    }

    const sideBtn = document.getElementById('btn-toggle-sidebar');
    if (sideBtn) {
        sideBtn.onclick = () => {
            const sidebar = document.getElementById('terminal-sidebar');
            if (sidebar) sidebar.classList.toggle('open-sidebar');
        };
    }
}

function initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            toggleCommandPalette(true);
        }
        if (e.key === 'Escape') {
            toggleCommandPalette(false);
        }
    });

    const gs = document.getElementById('global-search');
    if (gs) gs.onfocus = () => toggleCommandPalette(true);

    const ps = document.getElementById('palette-search');
    if (ps) ps.oninput = (e) => executePaletteIncrementalFiltering(e.target.value);
}

function toggleCommandPalette(show) {
    const cp = document.getElementById('command-palette');
    if (!cp) return;
    if (show) {
        cp.classList.remove('hidden');
        const inp = document.getElementById('palette-search');
        if (inp) {
            inp.value = "";
            inp.focus();
        }
        executePaletteIncrementalFiltering("");
    } else {
        cp.classList.add('hidden');
    }
}

function executePaletteIncrementalFiltering(query) {
    const resContainer = document.getElementById('palette-results');
    if (!resContainer) return;
    resContainer.innerHTML = "";
    
    const normalized = query.toUpperCase();
    const registry = getTickerRegistry();
    const hits = registry.filter(x => x.uid.includes(normalized) || x.name.toUpperCase().includes(normalized));
    
    if (hits.length === 0) {
        resContainer.innerHTML = `<div class="p-3 text-slate-500 text-center text-[10px]">Instrumen pasar tidak terdaftar.</div>`;
        return;
    }

    hits.forEach(node => {
        const row = document.createElement('div');
        row.className = "p-2 hover:bg-amber-950/40 hover:text-amber-400 rounded cursor-pointer transition flex justify-between items-center text-slate-300";
        row.innerHTML = `<span>${node.name}</span><span class="text-[9px] text-slate-600 bg-slate-900 px-1 rounded">${node.category.toUpperCase()}</span>`;
        row.onclick = () => {
            globalActivePairUid = node.uid;
            toggleCommandPalette(false);
            renderWatchlistWorkspace();
            updateSelectedPairMetricsDesk();
        };
        resContainer.appendChild(row);
    });
}
