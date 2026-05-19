/**
 * Vanguard Quant Terminal - Core Engine Orchestrator (MANDIRI & ANTI-STUCK)
 * Berjalan langsung tanpa dependensi luar dan memaksa modal boot tertutup.
 */

let coreMemoryCache = [];
let currentActiveFilter = 'all';
let currentActivePage = 1;
let currentSearchQuery = '';
let rowsPerPage = 10;
let selectedPairUidForModal = 'EURUSD';

// 1. DAFTAR LENGKAP INSTRUMEN (Forex, Stock Market, Crypto, Commodities)
const VANGUARD_TICKER_REGISTRY = [
    // FOREIGN CURRENCIES (FOREX LENGKAP)
    { uid: "EURUSD", name: "EUR / USD", category: "forex", baseSpread: 0.00012, decimals: 5 },
    { uid: "GBPUSD", name: "GBP / USD", category: "forex", baseSpread: 0.00016, decimals: 5 },
    { uid: "USDJPY", name: "USD / JPY", category: "forex", baseSpread: 0.014, decimals: 3 },
    { uid: "AUDUSD", name: "AUD / USD", category: "forex", baseSpread: 0.00011, decimals: 5 },
    { uid: "USDCAD", name: "USD / CAD", category: "forex", baseSpread: 0.00015, decimals: 5 },
    { uid: "USDCHF", name: "USD / CHF", category: "forex", baseSpread: 0.00013, decimals: 5 },
    { uid: "NZDUSD", name: "NZD / USD", category: "forex", baseSpread: 0.00014, decimals: 5 },
    { uid: "EURGBP", name: "EUR / GBP", category: "forex", baseSpread: 0.00015, decimals: 5 },
    { uid: "EURJPY", name: "EUR / JPY", category: "forex", baseSpread: 0.018, decimals: 3 },
    { uid: "GBPJPY", name: "GBP / JPY", category: "forex", baseSpread: 0.022, decimals: 3 },
    
    // STOCK MARKET (SAHAM GLOBAL)
    { uid: "AAPL", name: "Apple Inc.", category: "stocks", baseSpread: 0.05, decimals: 2 },
    { uid: "TSLA", name: "Tesla Inc.", category: "stocks", baseSpread: 0.08, decimals: 2 },
    { uid: "NVDA", name: "NVIDIA Corp.", category: "stocks", baseSpread: 0.12, decimals: 2 },
    { uid: "MSFT", name: "Microsoft Corp.", category: "stocks", baseSpread: 0.07, decimals: 2 },
    { uid: "AMZN", name: "Amazon.com Inc.", category: "stocks", baseSpread: 0.06, decimals: 2 },
    { uid: "GOOGL", name: "Alphabet Inc.", category: "stocks", baseSpread: 0.05, decimals: 2 },
    
    // CRYPTO ASSETS
    { uid: "BTCUSDT", name: "Bitcoin / USDT", category: "crypto", baseSpread: 1.50, decimals: 2 },
    { uid: "ETHUSDT", name: "Ethereum / USDT", category: "crypto", baseSpread: 0.15, decimals: 2 },
    { uid: "SOLUSDT", name: "Solana / USDT", category: "crypto", baseSpread: 0.02, decimals: 2 },
    
    // COMMODITIES
    { uid: "XAUUSD", name: "Gold / USD", category: "commodities", baseSpread: 0.25, decimals: 2 },
    { uid: "XAGUSD", name: "Silver / USD", category: "commodities", baseSpread: 0.02, decimals: 3 },
    { uid: "USOIL", name: "Crude Oil WTI", category: "commodities", baseSpread: 0.03, decimals: 2 }
];

// Langsung jalankan fungsi inisialisasi tanpa menunggu DOMContentLoaded agar tidak kalah cepat dari script HTML
initializeClocks();
generateFallbackMarketMemory();

// Fungsi Clock / Jam Berjalan
function initializeClocks() {
    setInterval(() => {
        const now = new Date();
        const localClock = document.getElementById('clock-local');
        if (localClock) localClock.innerText = now.toTimeString().split(' ')[0];
        
        const ldnTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (3600000 * 1));
        const nycTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (3600000 * -4));
        
        const clockLdn = document.getElementById('clock-ldn');
        const clockNyc = document.getElementById('clock-nyc');
        if (clockLdn) clockLdn.innerText = ldnTime.toTimeString().split(' ')[0];
        if (clockNyc) clockNyc.innerText = nycTime.toTimeString().split(' ')[0];
    }, 1000);
}

// Generate Data Harga Dummy Mandiri
function generateFallbackMarketMemory() {
    coreMemoryCache = VANGUARD_TICKER_REGISTRY.map(node => {
        let basePrice = 1.0850;
        if (node.uid.includes("JPY")) basePrice = 155.40;
        else if (node.uid === "XAUUSD") basePrice = 2350.00;
        else if (node.uid === "XAGUSD") basePrice = 29.50;
        else if (node.uid === "USOIL") basePrice = 78.20;
        else if (node.uid === "BTCUSDT") basePrice = 67250.00;
        else if (node.uid === "ETHUSDT") basePrice = 3500.00;
        else if (node.uid === "SOLUSDT") basePrice = 175.00;
        else if (node.category === "stocks") basePrice = 120.00 + (Math.random() * 150);

        return {
            uid: node.uid,
            name: node.name,
            category: node.category,
            price: basePrice,
            change24h: (Math.random() * 4) - 2.0,
            high24h: basePrice * 1.012,
            low24h: basePrice * 0.988,
            volume24h: 2000000 + Math.floor(Math.random() * 8000000),
            baseSpread: node.baseSpread,
            decimals: node.decimals
        };
    });
}

// Fungsi utama yang dipanggil secara aman dari window onload atau langsung
window.addEventListener("load", () => {
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

    appendLog("Menghubungkan Pool Jaringan Pasar Keuangan Global...", "info");
    appendLog("Sinkronisasi data instrumen selesai.", "success");
    appendLog("Mengunduh feed ringkasan berita makroekonomi...", "info");
    
    updateMacroNewsFeed();
    setupUiListeners();
    compileActiveFilterSorting();

    // Aktifkan tombol bypass
    const bypassBtn = document.getElementById('btn-bypass-boot');
    if (bypassBtn) {
        bypassBtn.disabled = false;
        bypassBtn.className = "px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded text-[10px] tracking-wide transition uppercase cursor-pointer";
        
        const bootStatus = document.getElementById('boot-status');
        if (bootStatus) {
            bootStatus.innerText = "SINKRONISASI SELESAI";
            bootStatus.className = "text-emerald-400 font-bold";
        }

        // PAKSA MODAL HILANG SAAT DIKLIK
        bypassBtn.onclick = () => {
            const modal = document.getElementById('gateway-modal');
            if (modal) {
                modal.style.display = 'none'; // Cara paling mutlak menghilangkan elemen di CSS
                modal.classList.add('hidden');
            }
            
            compileActiveFilterSorting();
            setInterval(liveTickSimulation, 2000); // Simulasi harga berjalan realtime
        };
    }
});

function liveTickSimulation() {
    coreMemoryCache.forEach(item => {
        const tickMove = (Math.random() - 0.5) * (item.price * 0.0003);
        item.price += tickMove;
    });
    compileActiveFilterSorting();
}

function compileActiveFilterSorting() {
    const tableBody = document.getElementById('market-ticker-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = "";

    let filtered = coreMemoryCache;
    if (currentActiveFilter !== 'all') {
        filtered = coreMemoryCache.filter(x => x.category === currentActiveFilter);
    }

    if (currentSearchQuery.trim() !== "") {
        const searchUpper = currentSearchQuery.toUpperCase();
        filtered = filtered.filter(x => x.uid.includes(searchUpper) || x.name.toUpperCase().includes(searchUpper));
    }

    const totalItems = filtered.length;
    const startIndex = (currentActivePage - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, totalItems);
    const paginatedItems = filtered.slice(startIndex, endIndex);

    const infoLabel = document.getElementById('pagination-info-label');
    if (infoLabel) {
        infoLabel.innerText = `SHOWING ${totalItems > 0 ? startIndex + 1 : 0} - ${endIndex} OF ${totalItems} NODES`;
    }

    if (paginatedItems.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-[11px] text-slate-600 italic font-mono-tech">TIDAK ADA DATA INSTRUMEN YANG COCOK</td></tr>`;
        return;
    }

    paginatedItems.forEach(node => {
        const isBullish = node.change24h >= 0;
        const bgBadge = isBullish ? "bg-emerald-950/30 text-emerald-400 border-emerald-900/50" : "bg-rose-950/30 text-rose-400 border-rose-900/50";
        const sign = isBullish ? "+" : "";

        const tr = document.createElement('tr');
        tr.className = "border-b border-slate-900/60 hover:bg-slate-900/30 transition cursor-pointer";
        tr.onclick = () => launchCalculationWorkspaceModal(node.uid);

        tr.innerHTML = `
            <td class="p-3 font-bold text-white tracking-tight">${node.name} <span class="text-[9px] text-slate-500 block font-mono-tech uppercase">${node.uid} / ${node.category}</span></td>
            <td class="p-3 font-mono-tech font-bold text-slate-200 text-right text-xs">${node.price.toFixed(node.decimals)}</td>
            <td class="p-3 text-right text-xs"><span class="px-2 py-0.5 border rounded text-[10px] font-bold font-mono-tech ${bgBadge}">${sign}${node.change24h.toFixed(2)}%</span></td>
            <td class="p-3 font-mono-tech text-slate-400 text-right text-xs">${node.high24h.toFixed(node.decimals)}</td>
            <td class="p-3 font-mono-tech text-slate-400 text-right text-xs">${node.low24h.toFixed(node.decimals)}</td>
            <td class="p-3 font-mono-tech text-slate-500 text-right text-[10px]">${node.volume24h.toLocaleString()}</td>
            <td class="p-3 text-right"><button class="px-2 py-1 bg-slate-900 border border-slate-800 text-slate-400 rounded text-[9px] font-bold font-mono-tech hover:border-amber-600 hover:text-amber-400 transition uppercase">QUANT PANEL</button></td>
        `;
        tableBody.appendChild(tr);
    });
}

function launchCalculationWorkspaceModal(uid) {
    selectedPairUidForModal = uid;
    const node = coreMemoryCache.find(x => x.uid === uid);
    if (!node) return;

    const modal = document.getElementById('modal-calculation-desk');
    if (modal) modal.classList.remove('hidden');

    const title = document.getElementById('modal-target-pair-title');
    if (title) title.innerText = `${node.name} [${node.uid}]`;

    document.getElementById('calc-margin').value = 100;
    document.getElementById('calc-leverage').value = 20;
    
    executeCalculatedRoiPnLFormula(node.change24h);
}

function executeCalculatedRoiPnLFormula(change24h) {
    const margin = parseFloat(document.getElementById('calc-margin').value) || 0;
    const leverage = parseFloat(document.getElementById('calc-leverage').value) || 0;

    const roi = change24h * leverage;
    const pnl = margin * (roi / 100);

    const roiLabel = document.getElementById('calc-roi-output');
    const pnlLabel = document.getElementById('calc-pnl-output');

    if (roiLabel) {
        roiLabel.innerText = `${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%`;
        roiLabel.className = `font-bold font-mono-tech ${roi >= 0 ? 'text-emerald-400' : 'text-rose-500'}`;
    }
    if (pnlLabel) {
        pnlLabel.innerText = `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} USD`;
        pnlLabel.className = `font-bold font-mono-tech ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-500'}`;
    }
}

function updateMacroNewsFeed() {
    const container = document.getElementById('news-feed-container');
    if (!container) return;
    container.innerHTML = `
        <div class="p-2 border border-slate-900 bg-[#04060a] rounded space-y-1">
            <span class="text-[7px] text-slate-500 block font-bold font-mono-tech">FED WATCH • JUST NOW</span>
            <p class="text-white font-bold leading-tight text-[11px]">Proyeksi Suku Bunga Global Diprediksi Stabil Hingga Akhir Kuartal.</p>
        </div>
        <div class="p-2 border border-slate-900 bg-[#04060a] rounded space-y-1">
            <span class="text-[7px] text-slate-500 block font-bold font-mono-tech">MARKET MACRO • 15 Mins Ago</span>
            <p class="text-white font-bold leading-tight text-[11px]">Likuiditas Volume Perdagangan Saham Sektor Teknologi Meningkat Pesat.</p>
        </div>
    `;
}

function setupUiListeners() {
    const searchInput = document.getElementById('global-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearchQuery = e.target.value;
            currentActivePage = 1;
            compileActiveFilterSorting();
        });
    }

    ['calc-margin', 'calc-leverage'].forEach(id => {
        const inputEl = document.getElementById(id);
        if (inputEl) {
            inputEl.addEventListener('input', () => {
                if (selectedPairUidForModal) {
                    const node = coreMemoryCache.find(x => x.uid === selectedPairUidForModal);
                    if (node) executeCalculatedRoiPnLFormula(node.change24h);
                }
            });
        }
    });

    const closeModalBtn = document.getElementById('btn-close-modal');
    if (closeModalBtn) {
        closeModalBtn.onclick = () => {
            const modal = document.getElementById('modal-calculation-desk');
            if (modal) modal.classList.add('hidden');
        };
    }

    const filters = ['all', 'forex', 'stocks', 'crypto', 'commodities'];
    filters.forEach(filterId => {
        const btn = document.getElementById(`filter-${filterId}`);
        if (btn) {
            btn.onclick = (e) => {
                filters.forEach(f => {
                    const b = document.getElementById(`filter-${f}`);
                    if (b) b.className = "px-3 py-1 text-slate-400 bg-slate-900/40 border border-slate-800/80 rounded font-bold transition uppercase";
                });
                e.target.className = "px-3 py-1 bg-amber-950/60 text-amber-400 border border-amber-900/80 rounded font-bold transition uppercase";
                currentActiveFilter = filterId;
                currentActivePage = 1;
                compileActiveFilterSorting();
            };
        }
    });

    const prevBtn = document.getElementById('pagination-prev-btn');
    const nextBtn = document.getElementById('pagination-next-btn');

    if (prevBtn) {
        prevBtn.onclick = () => {
            if (currentActivePage > 1) {
                currentActivePage--;
                compileActiveFilterSorting();
            }
        };
    }
    if (nextBtn) {
        nextBtn.onclick = () => {
            let filteredCount = coreMemoryCache.filter(x => currentActiveFilter === 'all' || x.category === currentActiveFilter).length;
            if (currentActivePage * rowsPerPage < filteredCount) {
                currentActivePage++;
                compileActiveFilterSorting();
            }
        };
    }
}
