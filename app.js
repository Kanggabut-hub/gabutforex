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
        apiEngine.updateUiProviderBadges();
        
        // 1. Ambil data harga pasar awal
        globalMarketDataCache = await apiEngine.fetchMarketPricePool();
        appendLog("Sinkronisasi harga pasar berhasil diselesaikan.", "success");
        
    } catch (err) {
        console.error(err);
        appendLog(`Koneksi eksternal sibuk. Mengaktifkan mode data lokal aman.`, "warn");
        globalMarketDataCache = apiEngine.generateAllFallbackData();
    }

    // 2. Ambil berita tanpa menggunakan 'await' agar tidak memblokir proses booting utama jika API News lambat
    appendLog("Mengunduh feed ringkasan berita makroekonomi...", "info");
    updateFinancialNewsFeed(); 

    // 3. Pastikan tombol selalu aktif di akhir sekuens
    activateTerminalBypassButton(appendLog);
}

async function updateFinancialNewsFeed() {
    const container = document.getElementById('news-feed-container');
    if (!container) return;
    
    try {
        const news = await apiEngine.fetchMarketNews();
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