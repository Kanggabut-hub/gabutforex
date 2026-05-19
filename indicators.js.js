/**
 * Mathematical Financial Indicator Engine
 * Perhitungan matematis murni (RSI, ATR, Pivot Points) berbasis data historis ril
 */

class VanguardIndicators {
    static calculateRsi(candles, period = 14) {
        if (candles.length < period) return 50.0;
        let gains = 0, losses = 0;

        for (let i = 1; i <= period; i++) {
            const diff = candles[candles.length - i].close - candles[candles.length - i - 1].close;
            if (diff > 0) gains += diff;
            else losses -= diff;
        }

        if (losses === 0) return 100;
        const rs = (gains / period) / (losses / period);
        return Math.round(100 - (100 / (1 + rs)));
    }

    static calculateAtr(candles, period = 14) {
        if (candles.length < 2) return 0.001;
        let trSum = 0;
        const limit = Math.min(candles.length, period);
        
        for (let i = 1; i < limit; i++) {
            const h = candles[i].high;
            const l = candles[i].low;
            const prevC = candles[i-1].close;
            const tr = Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC));
            trSum += tr;
        }
        return trSum / limit;
    }

    static calculateClassicPivotNodes(currentPrice, high24h, low24h) {
        const p = (high24h + low24h + currentPrice) / 3;
        const r1 = (2 * p) - low24h;
        const s1 = (2 * p) - high24h;
        return { pivot: p, r1: r1, s1: s1 };
    }
}